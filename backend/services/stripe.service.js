/**
 * @fileoverview Stripe service for managing payments and webhooks
 * @module services/stripe
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service class for Stripe-related operations
 */
class StripeService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  /* -------------------------------------------------------------------------- */
  /*                               Checkout Logic                               */
  /* -------------------------------------------------------------------------- */

  /**
   * Creates a Stripe checkout session for a booking
   * @param {Object} params - Session parameters
   * @returns {Promise<Object>} The created checkout session
   */
  async createCheckoutSession({ bookingId, userId, property, checkIn, checkOut, stayDays, totalPrice }) {
    const bId = bookingId.toString();
    const checkoutQuery = new URLSearchParams({
      checkIn,
      checkOut,
      totalPrice: String(totalPrice || 0),
      bookingId: bId,
    }).toString();

    return await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      metadata: {
        bookingId: bId,
        userId: userId.toString(),
        propertyId: property._id.toString(),
      },
      payment_intent_data: {
        metadata: {
          bookingId: bId,
          userId: userId.toString(),
          propertyId: property._id.toString(),
        },
      },
      success_url: `${process.env.CLIENT_URL}/booking-payment/checkout-success?${checkoutQuery}`,
      cancel_url: `${process.env.CLIENT_URL}/booking-payment/checkout-cancel?${checkoutQuery}`,
      line_items: [{
        price_data: {
          currency: 'pkr',
          unit_amount: Math.round(totalPrice * 100),
          product_data: {
            name: `${property.name} - ${property.type}`,
            description: `Stay from ${checkIn} to ${checkOut} (${stayDays} nights)`,
          },
        },
        quantity: 1,
      }]
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                                Webhook Logic                               */
  /* -------------------------------------------------------------------------- */

  /**
   * Constructs a Stripe event from a raw payload and signature
   * @param {Buffer|string} payload - The raw request body
   * @param {string} sig - The stripe-signature header
   * @param {string} secret - The webhook signing secret
   * @returns {Object} The verified Stripe event
   */
  constructEvent(payload, sig, secret) {
    return this.stripe.webhooks.constructEvent(payload, sig, secret);
  }
}

export default new StripeService();
