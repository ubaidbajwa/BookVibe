/**
 * @file PendingVerificationModel.js
 * @description Mongoose model for temporary storage of OTP verification records.
 */

import mongoose from "mongoose";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PendingVerification
 * @property {string} email - Email being verified.
 * @property {string} phone - Phone number being verified.
 * @property {string} otpType - Type of OTP (email/phone).
 * @property {string} otpHash - Hashed OTP value.
 * @property {boolean} verified - Flag if verification succeeded.
 * @property {string} username - Optional username linked to verification.
 * @property {Date} expiresAt - TTL for the verification record.
 */
const pendingVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    default: null,
    lowercase: true,
  },
  phone: {
    type: String,
    default: null,
  },
  otpType: {
    type: String,
    enum: ['email', 'phone'],
    required: true,
  },
  otpHash: {
    type: String,
    default: null,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  username: {
    type: String,
    default: '',
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true
});

// ─── INDEXES ─────────────────────────────────────────────────────────────────

// TTL Index — MongoDB automatically deletes expired records
pendingVerificationSchema.index({
  expiresAt: 1
}, {
  expireAfterSeconds: 0
});

pendingVerificationSchema.index({
  email: 1,
  otpType: 1
});

pendingVerificationSchema.index({
  phone: 1,
  otpType: 1
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * PendingVerification model.
 */
const PendingVerification = mongoose.model("PendingVerification", pendingVerificationSchema);

export default PendingVerification;
