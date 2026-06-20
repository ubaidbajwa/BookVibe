import Stripe from 'stripe';
import BookingModel from '../models/BookingModel.js';
import ProcessedWebhookEvent from '../models/ProcessedWebhookEvent.js';
import notificationService from '../services/notification.service.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Extracts the booking ID from the Stripe object metadata.
 * 
 * @param {Object} obj - The Stripe object containing metadata.
 * @returns {string|null} The extracted booking ID or null if not found.
 */
const pickBookingIdFromMetadata = (obj = {}) => {
  return obj?.metadata?.bookingId || obj?.metadata?.booking_id || null;
};

/**
 * Populates a booking with property and user details.
 * 
 * @param {Object} query - The Mongoose query object.
 * @returns {Promise<Object|null>} The populated booking document.
 */
const populateBooking = (query) => {
  return BookingModel.findOne(query)
    .populate('propertyId', 'name hostBy')
    .populate('userId', 'username');
};

/**
 * Resolves a booking based on session ID, payment intent ID, or metadata booking ID.
 * 
 * @param {Object} params - The resolution parameters.
 * @param {string|null} params.sessionId - The Stripe session ID.
 * @param {string|null} params.paymentIntentId - The Stripe payment intent ID.
 * @param {string|null} params.metadataBookingId - The booking ID from metadata.
 * @returns {Promise<Object|null>} The resolved booking document.
 */
const resolveBooking = async ({
  sessionId = null,
  paymentIntentId = null,
  metadataBookingId = null
}) => {
  if (metadataBookingId) {
    const byMetadata = await populateBooking({
      _id: metadataBookingId
    });
    if (byMetadata) {
      return byMetadata;
    }
  }

  if (sessionId) {
    const bySession = await populateBooking({
      stripeSessionId: sessionId
    });
    if (bySession) {
      return bySession;
    }
  }

  if (paymentIntentId) {
    const byIntent = await populateBooking({
      stripePaymentIntentId: paymentIntentId
    });
    if (byIntent) {
      return byIntent;
    }
  }

  return null;
};

/**
 * Marks a booking as paid and sends notifications.
 * 
 * @param {Object} booking - The booking document.
 * @param {string|null} paymentIntentId - The Stripe payment intent ID.
 * @param {string} source - The source of the payment update.
 * @returns {Promise<Object>} The updated booking document.
 */
const markBookingPaid = async (booking, paymentIntentId = null, source = 'webhook') => {
  if (!booking || booking.paymentStatus === 'paid') {
    return booking;
  }

  booking.paymentStatus = 'paid';
  booking.bookingStatus = 'confirmed';
  booking.expiresAt = undefined; // cancel TTL so MongoDB won't auto-delete this doc

  if (paymentIntentId && !booking.stripePaymentIntentId) {
    booking.stripePaymentIntentId = paymentIntentId;
  }

  await booking.save();

  await notificationService.notifyHost(booking.propertyId.hostBy, 'booking:payment', {
    type: 'payment',
    severity: 'success',
    title: 'Payment Received',
    message: `Payment received for ${booking.propertyId.name}`,
    link: `/host/bookings/${booking._id}`,
    bookingId: booking._id,
    propertyId: booking.propertyId._id,
    data: {
      source
    },
  });

  await notificationService.notifyUser(booking.userId, 'booking:payment', {
    type: 'payment',
    severity: 'success',
    title: 'Booking Confirmed',
    message: `Your payment for ${booking.propertyId.name} was received successfully.`,
    link: '/my-bookings',
    bookingId: booking._id,
    propertyId: booking.propertyId._id,
    data: {
      source
    },
  });

  console.log(`[Webhook] ✅ Booking ${booking._id} marked as PAID via ${source}`);
  return booking;
};

/**
 * Marks a booking as failed and sends notifications.
 * 
 * @param {Object} booking - The booking document.
 * @param {string} reason - The reason for failure.
 * @returns {Promise<Object>} The updated booking document.
 */
const markBookingFailed = async (booking, reason = 'Payment failed') => {
  // Only act on bookings still awaiting payment. The schema's paymentStatus enum
  // is ['pending','paid','failed','refunded'] — 'pending' is the unpaid state, so
  // the old 'unpaid' guard never matched and abandoned/failed Stripe checkouts were
  // never released, leaving them 'pending' and silently blocking those dates.
  if (!booking || booking.paymentStatus !== 'pending') {
    return booking;
  }

  booking.paymentStatus = 'failed';
  if (reason === 'checkout.session.expired') {
    booking.bookingStatus = 'cancel';
  }

  await booking.save();

  await notificationService.notifyUser(booking.userId, 'booking:payment', {
    type: 'payment',
    severity: 'danger',
    title: 'Payment Failed',
    message: reason === 'checkout.session.expired' ?
      `Payment session expired for ${booking.propertyId.name}.` :
      `Payment failed for ${booking.propertyId.name}. Please try again.`,
    link: '/my-bookings',
    bookingId: booking._id,
    propertyId: booking.propertyId._id,
    data: {
      reason
    },
  });

  console.log(`[Webhook] ❌ Booking ${booking._id} marked as FAILED (${reason})`);
  return booking;
};

/**
 * Handles Stripe webhook events.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('[Webhook] Missing stripe-signature or webhook secret');
    return res.status(400).json({
      message: 'Webhook signature missing',
      success: false
    });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ── Atomic insert-first idempotency ─────────────────────────────────────────
  // Insert the event record BEFORE executing business logic.
  // The unique index on eventId makes this atomic: two concurrent webhook
  // deliveries race to insert; only one wins, the other gets an 11000 error
  // and returns 200 immediately — completely eliminating the read-then-write
  // race condition in the old findOne-first approach.
  try {
    await ProcessedWebhookEvent.create({ eventId: event.id, eventType: event.type });
  } catch (insertErr) {
    if (insertErr.code === 11000) {
      console.log(`[Webhook] Duplicate event already processed or in-flight: ${event.id}`);
      return res.status(200).json({ received: true, duplicate: true });
    }
    console.error('[Webhook] Failed to record event:', insertErr.message);
    return res.status(500).json({ received: false, error: 'Failed to record event' });
  }

  // Execute business logic — if it fails we delete the record so Stripe can retry.
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        {
          const session = event.data.object;
          if (session.payment_status !== 'paid') {
            break;
          }

          const booking = await resolveBooking({
            sessionId: session.id,
            paymentIntentId: session.payment_intent || null,
            metadataBookingId: pickBookingIdFromMetadata(session),
          });

          if (!booking) {
            console.error(`[Webhook] No booking found for checkout.session.completed | session=${session.id}`);
            break;
          }

          await markBookingPaid(booking, session.payment_intent || null, 'checkout.session.completed');
          break;
        }

      case 'checkout.session.expired':
        {
          const session = event.data.object;
          const booking = await resolveBooking({
            sessionId: session.id,
            paymentIntentId: session.payment_intent || null,
            metadataBookingId: pickBookingIdFromMetadata(session),
          });
          if (!booking) {
            break;
          }
          await markBookingFailed(booking, 'checkout.session.expired');
          break;
        }

      case 'payment_intent.succeeded':
        {
          const intent = event.data.object;
          const booking = await resolveBooking({
            paymentIntentId: intent.id,
            metadataBookingId: pickBookingIdFromMetadata(intent),
          });
          if (!booking) {
            console.error(`[Webhook] No booking found for payment_intent.succeeded | intent=${intent.id}`);
            break;
          }
          await markBookingPaid(booking, intent.id, 'payment_intent.succeeded');
          break;
        }

      case 'payment_intent.payment_failed':
        {
          const intent = event.data.object;
          const booking = await resolveBooking({
            paymentIntentId: intent.id,
            metadataBookingId: pickBookingIdFromMetadata(intent),
          });
          if (!booking) {
            break;
          }
          await markBookingFailed(booking, 'payment_intent.payment_failed');
          break;
        }

      case 'charge.refunded':
        {
          const charge = event.data.object;
          const booking = await resolveBooking({
            paymentIntentId: charge.payment_intent || null,
            metadataBookingId: pickBookingIdFromMetadata(charge),
          });
          if (!booking) {
            break;
          }

          booking.refundStatus = 'approved';
          booking.refundResolvedAt = new Date();
          await booking.save();

          await notificationService.notifyUser(booking.userId, 'refund:updated', {
            type: 'refund',
            severity: 'success',
            title: 'Refund Confirmed',
            message: `Your refund for ${booking.propertyId.name} has been processed.`,
            link: '/my-bookings',
            bookingId: booking._id,
            propertyId: booking.propertyId._id,
          });

          console.log(`[Webhook] 💰 Booking ${booking._id} refund confirmed`);
          break;
        }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    // Business logic failed — delete the event record so Stripe retries.
    await ProcessedWebhookEvent.deleteOne({ eventId: event.id }).catch(() => {});
    console.error('[Webhook] Handler error:', error);
    return res.status(500).json({ received: false, error: 'Handler error — will retry' });
  }
};

export {
  stripeWebhook,
  markBookingPaid
};
