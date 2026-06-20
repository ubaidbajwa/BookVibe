/**
 * @file Complaintmodel.js
 * @description Mongoose model for handling complaints between guests and hosts.
 */

import mongoose from 'mongoose';

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Complaint
 * @property {mongoose.Schema.Types.ObjectId} complainant - User who filed the complaint.
 * @property {string} complainantRole - Role of the complainant (guest/host).
 * @property {mongoose.Schema.Types.ObjectId} against - User the complaint is against.
 * @property {string} againstRole - Role of the user the complaint is against.
 * @property {mongoose.Schema.Types.ObjectId} booking - Associated booking.
 * @property {mongoose.Schema.Types.ObjectId} property - Associated property.
 * @property {string} subject - Brief summary of the issue.
 * @property {string} description - Detailed description of the complaint.
 * @property {string} category - Category of the complaint.
 * @property {Array<{url: string, publicId: string}>} evidence - Supporting evidence (images/docs).
 * @property {Array<Object>} responses - Communication thread regarding the complaint.
 * @property {string} status - Current status of the complaint.
 * @property {string} adminResponse - Response from administrative staff.
 * @property {string} adminAction - Action taken by administration.
 * @property {Date} resolvedAt - Timestamp when the complaint was resolved.
 * @property {mongoose.Schema.Types.ObjectId} resolvedBy - Admin user who resolved the complaint.
 */
const complaintSchema = new mongoose.Schema({
  complainant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
    required: true
  },
  complainantRole: {
    type: String,
    enum: ['guest', 'host'],
    required: true
  },
  against: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
    required: true
  },
  againstRole: {
    type: String,
    enum: ['guest', 'host'],
    required: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BookingModel'
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['property_issue', 'behavior', 'payment', 'safety', 'fraud', 'other'],
    default: 'other'
  },
  evidence: [{
    url: String,
    publicId: String,
    type: {
      type: String,
      enum: ['image', 'video'],
      default: 'image'
    }
  }],
  responses: [{
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserAndHost'
    },
    text: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
  }],
  conversationThread: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserAndHost',
      required: true
    },
    senderRole: {
      type: String,
      enum: ['Admin', 'Host', 'Guest'],
      required: true
    },
    messageText: {
      type: String,
      required: true,
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['open', 'reviewing', 'resolved', 'dismissed'],
    default: 'open',
    index: true
  },
  adminResponse: {
    type: String,
    maxlength: 1000
  },
  adminAction: {
    type: String,
    enum: ['none', 'warning', 'warn_both', 'blocked', 'refunded'],
    default: 'none'
  },
  warnTarget: {
    type: String,
    enum: ['complainant', 'against', null],
    default: null
  },
  // True once the offender's CNIC/email/phone has been added to the platform blacklist.
  blacklisted: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost'
  },
}, {
  timestamps: true
});

// ─── INDEXES ─────────────────────────────────────────────────────────────────

complaintSchema.index({
  complainant: 1,
  createdAt: -1
});

complaintSchema.index({
  against: 1
});

complaintSchema.index({
  status: 1,
  createdAt: -1
});

complaintSchema.index({
  property: 1
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * Complaint model.
 */
const Complaint = mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema);

export default Complaint;
