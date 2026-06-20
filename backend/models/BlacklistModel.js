/**
 * @file BlacklistModel.js
 * @description Mongoose model for the platform-wide ban list. A blacklisted CNIC,
 * email, or phone can never be used to register a new BookVibe account. Entries are
 * created by admins (manually, or when resolving a complaint with "Block & Blacklist")
 * and can be removed to lift the ban.
 */

import mongoose from 'mongoose';

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Blacklist
 * @property {string} cnicNumber - Banned CNIC number.
 * @property {string} email - Banned email address (lowercased).
 * @property {string} phone - Banned phone number.
 * @property {string} reason - Why this identity was banned.
 * @property {mongoose.Schema.Types.ObjectId} user - The account that was blocked (if any).
 * @property {mongoose.Schema.Types.ObjectId} complaint - The complaint that triggered the ban (if any).
 * @property {mongoose.Schema.Types.ObjectId} blacklistedBy - Admin who created the entry.
 */
const blacklistSchema = new mongoose.Schema({
  cnicNumber: {
    type: String,
    trim: true,
    index: {
      unique: true,
      sparse: true
    },
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    index: {
      unique: true,
      sparse: true
    },
  },
  phone: {
    type: String,
    trim: true,
    index: {
      unique: true,
      sparse: true
    },
  },
  reason: {
    type: String,
    maxlength: 1000,
    default: 'Banned by admin',
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
  },
  complaint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
  },
  blacklistedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
  },
}, {
  timestamps: true
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * Blacklist model.
 */
const Blacklist = mongoose.models.Blacklist || mongoose.model('Blacklist', blacklistSchema);

export default Blacklist;
