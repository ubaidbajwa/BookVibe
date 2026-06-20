/**
 * @file ReviewModel.js
 * @description Mongoose model for comprehensive property reviews, including categorical ratings and host replies.
 */

import mongoose from 'mongoose';

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Review
 * @property {mongoose.Schema.Types.ObjectId} property - Reference to the Property.
 * @property {mongoose.Schema.Types.ObjectId} booking - Reference to the associated Booking.
 * @property {mongoose.Schema.Types.ObjectId} guest - Reference to the Guest user.
 * @property {mongoose.Schema.Types.ObjectId} host - Reference to the Host user.
 * @property {number} rating - Overall numerical rating (1-5).
 * @property {string} title - Brief headline of the review.
 * @property {string} comment - Detailed review feedback.
 * @property {Object} categories - Individual rating scores for cleanliness, location, etc.
 * @property {boolean} isVerifiedStay - Whether the review is from a verified booking.
 * @property {number} stayDuration - Duration of the stay in days.
 * @property {boolean} paymentVerified - Whether payment for the stay was confirmed.
 * @property {Object} hostReply - Optional reply from the host to the review.
 * @property {boolean} isVisible - Visibility flag for administrative control.
 */
const reviewSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BookingModel',
    required: true,
    unique: true, // One review per booking
  },
  guest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
    required: true,
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
    required: true,
  },

  // ── Rating & Content ──
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  title: {
    type: String,
    maxlength: 100,
  },
  comment: {
    type: String,
    maxlength: 1000,
  },

  // ── Category Ratings (optional — detailed feedback) ──
  categories: {
    cleanliness: {
      type: Number,
      min: 1,
      max: 5
    },
    location: {
      type: Number,
      min: 1,
      max: 5
    },
    value: {
      type: Number,
      min: 1,
      max: 5
    },
    communication: {
      type: Number,
      min: 1,
      max: 5
    },
    accuracy: {
      type: Number,
      min: 1,
      max: 5
    },
  },

  // ── Verified Stay Badge ──
  isVerifiedStay: {
    type: Boolean,
    default: false,
  },
  stayDuration: {
    type: Number,
    default: 0,
  },
  paymentVerified: {
    type: Boolean,
    default: false,
  },

  // ── Host Reply ──
  hostReply: {
    text: {
      type: String,
      maxlength: 500
    },
    repliedAt: {
      type: Date
    },
  },

  // ── Visibility (admin can hide) ──
  isVisible: {
    type: Boolean,
    default: true,
  },

}, {
  timestamps: true
});

// ─── INDEXES ─────────────────────────────────────────────────────────────────

reviewSchema.index({
  property: 1,
  createdAt: -1
});

reviewSchema.index({
  guest: 1
});

reviewSchema.index({
  host: 1
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * Review model.
 */
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

export default Review;
