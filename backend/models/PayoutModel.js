/**
 * @file PayoutModel.js
 * @description Mongoose model for tracking host earnings payouts and platform fees.
 */

import mongoose from 'mongoose';

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Payout
 * @property {mongoose.Schema.Types.ObjectId} hostId - Reference to the Host.
 * @property {Array<mongoose.Schema.Types.ObjectId>} bookings - List of bookings included in this payout.
 * @property {number} amount - Total gross amount.
 * @property {number} platformFee - BookVibe commission.
 * @property {number} netAmount - Final amount to be paid to host.
 * @property {string} status - Current status of the payout.
 * @property {string} paymentMethod - Method used for payout.
 * @property {string} transactionRef - Reference ID for the transaction.
 * @property {string} transactionNote - Optional note for the transaction.
 * @property {mongoose.Schema.Types.ObjectId} processedBy - Admin who processed the payout.
 * @property {Date} processedAt - Timestamp when processing started.
 * @property {Date} completedAt - Timestamp when payout was completed.
 */
const payoutSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
    required: true,
  },

  // Konsi bookings ka paisa diya ja raha hai
  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BookingModel',
  }],

  // Total amount
  amount: {
    type: Number,
    required: true,
    min: 0,
  },

  // Platform fee (BookVibe commission)
  platformFee: {
    type: Number,
    default: 0,
  },

  // Final amount host ko milega
  netAmount: {
    type: Number,
    required: true,
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },

  // Payment method used
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'easypaisa', 'jazzcash'],
    required: true,
  },

  // Transaction reference (admin fill karega after transfer)
  transactionRef: {
    type: String
  },
  transactionNote: {
    type: String
  },

  // Who processed it
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },

}, {
  timestamps: true
});

// ─── INDEXES ─────────────────────────────────────────────────────────────────

payoutSchema.index({
  hostId: 1,
  status: 1
});

payoutSchema.index({
  status: 1,
  createdAt: -1
});

// Prevents two concurrent pending/processing payouts for the same host
payoutSchema.index({
  hostId: 1
}, {
  unique: true,
  partialFilterExpression: {
    status: {
      $in: ['pending', 'processing']
    }
  },
  name: 'one_active_payout_per_host',
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * Payout model.
 */
const Payout = mongoose.models.Payout || mongoose.model('Payout', payoutSchema);

export default Payout;
