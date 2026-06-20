// --- Imports ---

import Stripe from "stripe";
import BookingModel from "../models/BookingModel.js";
import UserAndHostModel from "../models/UserAndHostModel.js";
import bookingService from "../services/booking.service.js";
import notificationService from "../services/notification.service.js";
import paymentService from "../services/payment.service.js";
import { markBookingPaid } from "./StripeWebhook.controller.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLATFORM_FEE_PERCENT = 10;
const HOST_DEBT_LIMIT = 10000; // PKR

// --- Guest Controllers ---

/**
 * Creates a new booking for a property.
 * recomputes total price server-side to prevent price manipulation.
 * 
 * @async
 * @function createBooking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const createBooking = async (req, res) => {
  try {
    const {
      propertyId,
      subUnitId,
      checkIn,
      checkOut,
      paymentMethod,
      selectedAddOns,
      totalPrice: _ignored,
      ...food
    } = req.body;
    const result = await bookingService.createBooking({
      propertyId,
      subUnitId,
      userId: req.user._id,
      checkIn,
      checkOut,
      paymentMethod,
      selectedAddOns,
      ...food
    });
    res.status(result.session ? 200 : 201).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Verifies a Stripe checkout payment directly against the Stripe API.
 * Fallback for environments where webhooks can't reach the server (e.g. local
 * dev without the Stripe CLI). The session status is fetched server-side from
 * Stripe, so the client cannot forge a "paid" state.
 *
 * @async
 * @function verifyStripePayment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const verifyStripePayment = async (req, res) => {
  try {
    const booking = await BookingModel.findOne({
      _id: req.params.id,
      userId: req.user._id
    })
      .populate('propertyId', 'name hostBy')
      .populate('userId', 'username');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        paymentStatus: 'paid',
        message: 'Payment already confirmed',
        booking: {
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          totalPrice: booking.totalPrice,
          propertyName: booking.propertyId?.name,
        },
      });
    }

    if (booking.paymentMethod !== 'stripe' || !booking.stripeSessionId) {
      return res.status(400).json({
        success: false,
        message: 'This booking has no Stripe checkout session to verify'
      });
    }

    const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);

    if (session.payment_status === 'paid') {
      await markBookingPaid(booking, session.payment_intent || null, 'client-verify');
      return res.status(200).json({
        success: true,
        paymentStatus: 'paid',
        message: 'Payment verified and booking confirmed',
        booking: {
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          totalPrice: booking.totalPrice,
          propertyName: booking.propertyId?.name,
        },
      });
    }

    return res.status(200).json({
      success: true,
      paymentStatus: booking.paymentStatus,
      message: `Stripe reports payment as "${session.payment_status}"`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Checks if a property is available for the specified dates.
 *
 * @async
 * @function checkAvailability
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const checkAvailability = async (req, res) => {
  try {
    const {
      propertyId,
      subUnitId,
      checkIn,
      checkOut
    } = req.body;
    const isAvailable = await bookingService.checkAvailability(
      propertyId, checkIn, checkOut, subUnitId
    );
    res.json({
      success: true,
      isBooked: !isAvailable,
    
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves all bookings made by the authenticated guest.
 * 
 * @async
 * @function getGuestBookings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getGuestBookings = async (req, res) => {
  try {
    const bookings = await bookingService.getGuestBookings(req.user._id);
    res.json({
      success: true,
      bookings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Cancels a booking and notifies the host and guest.
 * 
 * @async
 * @function cancelBooking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const cancelBooking = async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.id).populate('propertyId', 'name hostBy');
    if (!booking || booking.userId.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    // Paid bookings must go through cancelWithRefund so refund eligibility is tracked.
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Paid bookings must be cancelled via the cancel-with-refund endpoint to ensure refund eligibility is calculated.',
      });
    }
    if (booking.bookingStatus === 'cancel') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled.' });
    }
    booking.bookingStatus = 'cancel';
    await booking.save();
    // Notify host
    await notificationService.notifyHost(booking.propertyId.hostBy, 'booking:cancelled', {
      type: 'booking',
      severity: 'warning',
      title: 'Booking Cancelled',
      message: `${req.user.username} cancelled booking for ${booking.propertyId.name}`,
      bookingId: booking._id,
      propertyId: booking.propertyId._id,
    });
    // Notify guest
    await notificationService.notifyUser(booking.userId, 'booking:cancelled', {
      type: 'booking',
      severity: 'warning',
      title: 'Booking Cancelled',
      message: `Your booking for ${booking.propertyId.name} has been cancelled.`,
      bookingId: booking._id,
      propertyId: booking.propertyId._id,
      link: '/my-bookings',
    });
    res.json({
      success: true,
      message: 'Cancelled'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Provides a preview of the refund amount if a booking were to be cancelled.
 * 
 * @async
 * @function previewCancelRefund
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const previewCancelRefund = async (req, res) => {
  try {
    const refundInfo = await bookingService.getRefundPreview(req.params.id, req.user._id);
    res.json({
      success: true,
      refundInfo
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Cancels a booking and initiates the refund process based on the cancellation policy.
 * 
 * @async
 * @function cancelWithRefund
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const cancelWithRefund = async (req, res) => {
  try {
    const {
      reason
    } = req.body;
    const result = await bookingService.cancelWithRefund(req.params.id, req.user._id, reason);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Requests a refund for a booking.
 * 
 * @async
 * @function requestRefund
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const requestRefund = async (req, res) => {
  try {
    const {
      reason
    } = req.body;
    const booking = await BookingModel.findById(req.params.id).populate('propertyId', 'name hostBy');
    if (!booking || booking.userId.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ success: false, message: 'Only paid bookings are eligible for a refund request.' });
    }
    if (booking.bookingStatus === 'cancel' && booking.refundStatus === 'none') {
      return res.status(400).json({ success: false, message: 'This cancelled booking has no payment to refund.' });
    }
    if (booking.refundStatus !== 'none') {
      return res.status(400).json({ success: false, message: 'A refund request already exists for this booking.' });
    }
    booking.refundStatus = 'requested';
    booking.refundReason = reason;
    booking.refundRequestedAt = new Date();
    await booking.save();
    await notificationService.notifyHost(booking.propertyId.hostBy, 'refund:requested', {
      type: 'refund',
      title: 'Refund Requested',
      message: `Guest requested refund for ${booking.propertyId.name}`,
      bookingId: booking._id,
      propertyId: booking.propertyId._id,
    });
    res.json({
      success: true,
      message: 'Requested'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// --- Host Controllers ---

/**
 * Retrieves all bookings for properties owned by the authenticated host.
 * 
 * @async
 * @function getHostBookings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getHostBookings = async (req, res) => {
  try {
    const bookings = await bookingService.getHostBookings(req.user._id);
    res.json({
      success: true,
      bookings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves dashboard statistics for the authenticated host.
 * 
 * @async
 * @function getHostDashboardStats
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getHostDashboardStats = async (req, res) => {
  try {
    const { stats, recentBookings } = await bookingService.getHostDashboardStats(req.user._id);
    res.json({
      success: true,
      stats,
      recentBookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves payment history for the authenticated host.
 * 
 * @async
 * @function getHostPayments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getHostPayments = async (req, res) => {
  try {
    const payments = await bookingService.getHostPayments(req.user._id);
    res.json({
      success: true,
      payments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves refund requests for properties owned by the authenticated host.
 * 
 * @async
 * @function getRefundRequests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getRefundRequests = async (req, res) => {
  try {
    const refunds = await bookingService.getRefundRequests(req.user._id);
    res.json({
      success: true,
      refunds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Updates the refund status of a booking (host approves or rejects a guest's
 * refund request; approving a Stripe booking triggers the actual Stripe refund).
 *
 * @async
 * @function updateRefundStatus
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const updateRefundStatus = async (req, res) => {
  try {
    const {
      refundStatus,
      rejectedReason
    } = req.body;

    const booking = await BookingModel.findById(req.params.id).populate('propertyId', 'hostBy name');
    if (!booking) return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
    if (booking.propertyId?.hostBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Not your property'
      });
    }

    // Guard: once approved, real money has already moved via Stripe — the record
    // is terminal and must never be changed either way (including re-rejecting it).
    if (booking.refundStatus === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'This refund has already been approved and cannot be changed.',
      });
    }

    // Guard: a refund already in-flight (admin or a previous attempt set it to
    // 'processing') must not be re-triggered here. Without this, a host could fire
    // a SECOND Stripe refund while the first is still settling. Recovery of a stuck
    // 'processing' record is handled from the admin panel.
    if (booking.refundStatus === 'processing') {
      return res.status(400).json({
        success: false,
        message: 'This refund is already being processed. Please wait for it to settle.',
      });
    }

    if (refundStatus === 'approved') {
      if (booking.paymentMethod === 'stripe') {
        if (!booking.stripePaymentIntentId) {
          return res.status(400).json({
            success: false,
            message: 'Cannot process Stripe refund: no payment intent ID on this booking.',
          });
        }
        if (!booking.refundAmount || booking.refundAmount <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Refund amount is zero — cancellation policy does not allow a refund for this booking.',
          });
        }

        booking.refundStatus = 'processing';
        await booking.save();

        try {
          const amountInSmallestUnit = Math.round(
            parseFloat(booking.refundAmount.toFixed(2)) * 100
          );

          // Idempotency key is keyed ONLY on the booking id — deliberately identical
          // to the admin path's key (adminProcessRefund). A booking is only ever
          // refunded once, so if both the host and admin paths fire for the same
          // booking+amount, Stripe returns the original refund instead of issuing a
          // second one. Diverging keys here would defeat that protection.
          await stripe.refunds.create(
            {
              payment_intent: booking.stripePaymentIntentId,
              amount: amountInSmallestUnit,
            },
            { idempotencyKey: `refund_${booking._id}` }
          );
        } catch (stripeError) {
          booking.refundStatus = 'requested';
          await booking.save();
          return res.status(502).json({
            success: false,
            message: `Stripe refund failed: ${stripeError.message}`,
          });
        }
      }

      booking.refundStatus = 'approved';
      booking.refundResolvedAt = new Date();
      await booking.save();

      await notificationService.notifyUser(booking.userId, 'refund:updated', {
        type: 'refund',
        title: 'Refund Approved',
        message: `Your refund for ${booking.propertyId?.name} was approved by the host.`,
        link: '/my-bookings',
      });
      return res.json({ success: true, refundStatus: 'approved' });

    } else if (refundStatus === 'rejected') {
      booking.refundStatus = 'rejected';
      booking.refundResolvedAt = new Date();
      if (rejectedReason) booking.refundRejectedReason = rejectedReason;
      await booking.save();

      await notificationService.notifyUser(booking.userId, 'refund:updated', {
        type: 'refund',
        title: 'Refund Rejected',
        message: `Your refund request for ${booking.propertyId?.name} was rejected by the host.`,
        link: '/my-bookings',
      });
      return res.json({ success: true, refundStatus: 'rejected' });
    }

    return res.status(400).json({ success: false, message: 'Invalid status' });

  } catch (error) {
    console.error('[updateRefundStatus]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Confirms a cash payment for a booking (exclusive to cash-on-arrival).
 * 
 * @async
 * @function confirmCashPayment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const confirmCashPayment = async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.id).populate('propertyId', 'hostBy name');
    if (!booking) return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
    if (booking.propertyId?.hostBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Not your property'
      });
    }

    // Guard: this endpoint is exclusively for cash-on-arrival bookings
    if (booking.paymentMethod !== 'arrival') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm cash payment on a booking with payment method '${booking.paymentMethod}'.`,
      });
    }

    // Guard: idempotency — if cash was already confirmed, return success without
    // re-recording the debt. Without this, a double-click or duplicate API call
    // would invoke recordCashBookingDebt() a second time; the debtRecorded flag
    // inside that function now blocks the second write, but catching it here
    // avoids the extra DB round-trip and gives a clear response.
    if (booking.paymentStatus === 'paid' && booking.debtRecorded) {
      return res.json({
        success: true,
        message: 'Cash payment already confirmed'
      });
    }

    // HOST_DEBT_LIMIT guard
    // Accepting a cash booking increases the host's commission debt to BookVibe
    // (10% platform fee). If confirming this booking would push the debt over
    // PKR 10,000, reject — the host must settle their balance first.
    const host = await UserAndHostModel.findById(req.user._id).select('outstandingDebt');
    const pendingFee = Math.round((booking.totalPrice || 0) * PLATFORM_FEE_PERCENT / 100);
    const projected = (host?.outstandingDebt || 0) + pendingFee;

    if (projected > HOST_DEBT_LIMIT) {
      return res.status(403).json({
        success: false,
        code: 'HOST_DEBT_LIMIT',
        message: `Accepting this booking would bring your outstanding BookVibe commission to PKR ${projected.toLocaleString()}, exceeding the PKR ${HOST_DEBT_LIMIT.toLocaleString()} limit. Please settle your balance before accepting new cash bookings.`,
        outstandingDebt: host?.outstandingDebt || 0,
        pendingFee,
        projectedDebt: projected,
      });
    }

    booking.paymentStatus = 'paid';
    await booking.save();

    await paymentService.recordCashBookingDebt(booking._id);
    res.json({
      success: true,
      message: 'Cash payment confirmed & commission debt recorded'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Releases the damage deposit for a booking.
 * 
 * @async
 * @function releaseDeposit
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const releaseDeposit = async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.id).populate('propertyId', 'hostBy');
    if (!booking) return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
    if (booking.propertyId?.hostBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Not your property'
      });
    }
    booking.damageDepositStatus = 'released';
    await booking.save();
    res.json({
      success: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Claims the damage deposit for a booking.
 * 
 * @async
 * @function claimDeposit
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const claimDeposit = async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.id).populate('propertyId', 'hostBy');
    if (!booking) return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
    if (booking.propertyId?.hostBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Not your property'
      });
    }
    booking.damageDepositStatus = 'claimed';
    await booking.save();
    res.json({
      success: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Soft deletes a booking made by the guest (only for cancelled/unpaid).
 * 
 * @async
 * @function deleteBooking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const deleteBooking = async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.id);
    if (!booking) return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Allow deletion for: cancelled, completed, or any status whose checkout date
    // has already passed (cron may not have flipped the status to 'completed' yet).
    const checkoutPassed = booking.checkOut < new Date();
    const isDeletable = booking.bookingStatus === 'cancel'
      || booking.bookingStatus === 'completed'
      || (checkoutPassed && ['confirmed', 'staying'].includes(booking.bookingStatus));

    if (!isDeletable) {
      return res.status(400).json({
        success: false,
        message: 'Only cancelled or completed bookings can be deleted from your history.',
      });
    }

    if (booking.paymentStatus === 'paid') {
      // Soft-delete to preserve the financial ledger
      booking.guestDeleted = true;
      await booking.save();
    } else {
      // Hard delete if it was never paid
      await BookingModel.findByIdAndDelete(req.params.id);
    }

    res.json({
      success: true,
      message: 'Deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Soft deletes a booking for a property owned by the host (only for cancelled/unpaid).
 * 
 * @async
 * @function hostDeleteBooking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const hostDeleteBooking = async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.id).populate('propertyId', 'hostBy');
    if (!booking) return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
    if (booking.propertyId?.hostBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Not your property'
      });
    }

    // Same logic as guest delete: also allow removal when checkout has passed
    // but cron hasn't flipped the status to 'completed' yet.
    const checkoutPassed = booking.checkOut < new Date();
    const isDeletable = booking.bookingStatus === 'cancel'
      || booking.bookingStatus === 'completed'
      || (checkoutPassed && ['confirmed', 'staying'].includes(booking.bookingStatus));

    if (!isDeletable) {
      return res.status(400).json({
        success: false,
        message: 'Only cancelled or completed bookings can be deleted from your history.',
      });
    }

    if (booking.paymentStatus === 'paid') {
      // Soft-delete to preserve the financial ledger
      booking.hostDeleted = true;
      await booking.save();
    } else {
      // Hard delete if it was never paid
      await BookingModel.findByIdAndDelete(req.params.id);
    }

    res.json({
      success: true,
      message: 'Deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// --- Admin / Shared Controllers ---

/**
 * Retrieves a single booking's details, enforcing ownership and role-based access.
 * 
 * @async
 * @function getSingleBooking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getSingleBooking = async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.id)
      .populate('propertyId')
      .populate('userId', 'username email phone profileImage');

    if (!booking) return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });

    const callerId = req.user._id.toString();
    const role = req.user.role;

    if (role === 'admin') {
      // Admin sees everything
      return res.json({
        success: true,
        booking
      });
    }

    if (role === 'guest') {
      const bookingOwnerId = booking.userId?._id?.toString() ?? booking.userId?.toString();
      if (bookingOwnerId !== callerId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: not your booking'
        });
      }
      return res.json({
        success: true,
        booking
      });
    }

    if (role === 'host') {
      if (booking.propertyId?.hostBy?.toString() !== callerId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: not your property'
        });
      }
      return res.json({
        success: true,
        booking
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Unauthorized'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves all bookings for administrative review.
 * 
 * @async
 * @function getAdminBookings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getAdminBookings = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      BookingModel.find()
        .populate({ path: 'propertyId', select: 'name images city hostBy', populate: { path: 'hostBy', select: 'username' } })
        .populate('userId', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BookingModel.countDocuments(),
    ]);

    res.json({
      success: true,
      bookings,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves all bookings with active refund requests for administrative review.
 * 
 * @async
 * @function getAdminRefunds
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getAdminRefunds = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const query = { refundStatus: { $ne: 'none' } };

    const [refunds, total] = await Promise.all([
      BookingModel.find(query)
        .populate('propertyId', 'name images')
        .populate('userId', 'username email')
        .sort({ refundRequestedAt: -1 })
        .skip(skip)
        .limit(limit),
      BookingModel.countDocuments(query),
    ]);

    res.json({
      success: true,
      refunds,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Processes a refund request, calling Stripe API for stripe payments.
 * 
 * @async
 * @function adminProcessRefund
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const adminProcessRefund = async (req, res) => {
  try {
    const {
      status
    } = req.body;

    if (!['completed', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'completed' or 'rejected'.",
      });
    }

    const booking = await BookingModel.findById(req.params.id)
      .populate('propertyId', 'name images')
      .populate('userId', 'username email');
    if (!booking) return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });

    // Guard: once approved, real money has already moved via Stripe (or the cash
    // equivalent) — the record is terminal and must never be changed either way.
    if (booking.refundStatus === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'This refund has already been approved and cannot be changed.',
      });
    }

    // Guard: nothing to process if no refund was ever requested for this booking.
    if (booking.refundStatus === 'none') {
      return res.status(400).json({
        success: false,
        message: 'This booking has no refund request to process.',
      });
    }

    if (status === 'completed') {
      if (booking.paymentMethod === 'stripe') {
        if (!booking.stripePaymentIntentId) {
          return res.status(400).json({
            success: false,
            message: 'Cannot process Stripe refund: no payment intent ID on this booking.',
          });
        }
        if (!booking.refundAmount || booking.refundAmount <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Refund amount is zero — cancellation policy does not allow a refund for this booking.',
          });
        }

        // Mark as 'processing' and persist BEFORE calling Stripe.
        // If the server crashes after Stripe succeeds but before our save,
        // the next admin attempt sees 'processing' and can investigate rather
        // than issuing a second refund.
        booking.refundStatus = 'processing';
        await booking.save();

        try {
          // Safe float → integer conversion: clamp to 2 decimal places first to
          // avoid floating-point drift (e.g. 1500.000000001 * 100 = 150000.0000001).
          const amountInSmallestUnit = Math.round(
            parseFloat(booking.refundAmount.toFixed(2)) * 100
          );

          // Idempotency key prevents Stripe issuing a second refund if we
          // retry after a network failure between Stripe and our server.
          await stripe.refunds.create(
            {
              payment_intent: booking.stripePaymentIntentId,
              amount: amountInSmallestUnit,
            },
            { idempotencyKey: `refund_${booking._id}` }
          );
        } catch (stripeError) {
          // Revert to 'requested' so admin can retry after investigating.
          booking.refundStatus = 'requested';
          await booking.save();
          return res.status(502).json({
            success: false,
            message: `Stripe refund failed: ${stripeError.message}`,
          });
        }
      }

      // Cash bookings: refund handled offline by admin.
      booking.refundStatus = 'approved';
      booking.refundResolvedAt = new Date();
    } else {
      booking.refundStatus = 'rejected';
      booking.refundResolvedAt = new Date();
    }

    await booking.save();

    await notificationService.notifyUser(booking.userId, 'refund:updated', {
      type: 'refund',
      title: `Refund ${booking.refundStatus}`,
      message: `Your refund for ${booking.propertyId?.name} was ${booking.refundStatus} by admin.`,
      link: '/my-bookings',
    });

    res.json({
      success: true,
      refundStatus: booking.refundStatus
    });
  } catch (error) {
    console.error('[adminProcessRefund]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Deletes any booking (admin only).
 * 
 * @async
 * @function adminDeleteBooking
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const adminDeleteBooking = async (req, res) => {
  try {
    const deleted = await BookingModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({
      success: false,
      message: 'Booking not found'
    });
    res.json({
      success: true,
      message: 'Deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
