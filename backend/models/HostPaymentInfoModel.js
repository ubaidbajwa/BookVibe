/**
 * @file HostPaymentInfoModel.js
 * @description Mongoose model for host payment information and withdrawal methods.
 */

import mongoose from 'mongoose';

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} HostPaymentInfo
 * @property {mongoose.Schema.Types.ObjectId} hostId - Reference to the Host (UserAndHost).
 * @property {string} paymentMethod - Preferred payment method (bank_transfer, easypaisa, jazzcash).
 * @property {Object} bankDetails - Details for bank transfer.
 * @property {Object} mobileWallet - Details for mobile wallet transfer.
 * @property {boolean} isVerified - Whether the payment info is verified by admin.
 * @property {Date} verifiedAt - Timestamp of verification.
 * @property {mongoose.Schema.Types.ObjectId} verifiedBy - Admin who verified the info.
 */
const hostPaymentInfoSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
    required: true,
    unique: true, // One payment info per host
  },

  // ── Payment Method Type ──
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'easypaisa', 'jazzcash'],
    required: true,
  },

  // ── Bank Transfer Details ──
  bankDetails: {
    bankName: {
      type: String
    },
    accountTitle: {
      type: String
    },
    accountNumber: {
      type: String
    },
    iban: {
      type: String
    },
    branchCode: {
      type: String
    },
  },

  // ── EasyPaisa / JazzCash Details ──
  mobileWallet: {
    provider: {
      type: String,
      enum: ['easypaisa', 'jazzcash']
    },
    accountName: {
      type: String
    },
    phoneNumber: {
      type: String
    },
  },

  // ── Verification ──
  isVerified: {
    type: Boolean,
    default: false, // Verified by Admin
  },
  verifiedAt: {
    type: Date
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
  },

}, {
  timestamps: true
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * HostPaymentInfo model.
 */
const HostPaymentInfo = mongoose.models.HostPaymentInfo || mongoose.model('HostPaymentInfo', hostPaymentInfoSchema);

export default HostPaymentInfo;
