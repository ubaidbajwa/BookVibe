/**
 * @file BookingModel.js
 * @description Mongoose model for property bookings, including pricing, payment, and guest details.
 */

import mongoose from "mongoose";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Booking
 * @property {mongoose.Schema.Types.ObjectId} propertyId - Reference to the Property.
 * @property {mongoose.Schema.Types.ObjectId} subUnitId - Selected sub-unit ID (for Hotels/Hostels).
 * @property {mongoose.Schema.Types.ObjectId} userId - Reference to the Guest.
 * @property {Date} checkIn - Check-in date.
 * @property {Date} checkOut - Check-out date.
 * @property {string} stayType - Type of stay (nightly, weekly, monthly).
 * @property {number} totalPrice - Total calculated price.
 * @property {string} paymentMethod - Method of payment (stripe, arrival).
 * @property {string} paymentStatus - Status of payment.
 * @property {string} bookingStatus - Status of booking.
 * @property {Array} selectedAddOns - List of dynamic services selected.
 * @property {Object} breakfast - Breakfast selection details.
 * @property {Object} lunch - Lunch selection details.
 * @property {Object} dinner - Dinner selection details.
 */
const bookingSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  
  // ── MULTI-UNIT SUPPORT ──
  subUnitId: {
    type: mongoose.Schema.Types.ObjectId, // Optional: refers to a subUnit within the property
    default: null
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
    required: true
  },

  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  stayDays: { type: Number, default: 0 },

  stayType: {
    type: String,
    enum: ['nightly', 'weekly', 'monthly'],
    default: 'nightly'
  },

  totalPrice: { type: Number, required: true },

  paymentMethod: {
    type: String,
    enum: ['stripe', 'arrival'],
    required: true
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },

  // Timestamp of when payment was confirmed — drives the cancellation/refund tier.
  paidAt: { type: Date },

  bookingStatus: {
    type: String,
    // 'staying' = guest currently checked in (set by the lifecycle cron between
    // check-in and check-out); 'completed' = stay finished.
    enum: ['pending', 'confirmed', 'staying', 'completed', 'cancel'],
    default: 'pending'
  },

  // ── DYNAMIC ADD-ONS TRACKING ──
  selectedAddOns: [{
    serviceName: String,
    price: Number,
    quantity: { type: Number, default: 1 },
    billingType: String,
    subtotal: Number
  }],

  // Meal selections (Legacy)
  breakfast: { title: String, price: Number },
  lunch: { title: String, price: Number },
  dinner: { title: String, price: Number },
  homemadeFoodSelected: { type: Boolean, default: false },

  // Trust Engine / Security
  requiresSecurityDeposit: { type: Boolean, default: false },
  riskScore: { type: Number, default: 0 },
  damageDepositStatus: {
    type: String,
    enum: ['none', 'held', 'released', 'claimed'],
    default: 'none'
  },

  // Stripe Integration
  stripeSessionId: String,
  stripePaymentIntentId: String,

  // Cancellation & Refunds
  refundStatus: {
    type: String,
    enum: ['none', 'requested', 'processing', 'approved', 'rejected'],
    default: 'none'
  },
  refundAmount: { type: Number, default: 0 },
  refundPercent: { type: Number, default: 0 },
  refundReason: String,
  refundRequestedAt: Date,
  refundResolvedAt: Date,
  refundRejectedReason: String,

  // Platform fee debt tracking for cash-on-arrival bookings.
  // Set to true by recordCashBookingDebt() after the fee is charged to the host's
  // outstandingDebt counter. Prevents double-recording if confirmCashPayment is
  // called more than once, and lets cancelWithRefund() reverse the debt correctly.
  debtRecorded: { type: Boolean, default: false },

  // Soft Deletion for Ledger Preservation
  guestDeleted: { type: Boolean, default: false },
  hostDeleted: { type: Boolean, default: false },

}, { timestamps: true });

// ─── INDEXES ─────────────────────────────────────────────────────────────────

bookingSchema.index({ propertyId: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ userId: 1 });

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────

/**
 * Pre-save middleware to set confirmed status for pay-on-arrival bookings.
 */
bookingSchema.pre('save', function (next) {
  if (this.isNew && this.paymentMethod === 'arrival') {
    this.bookingStatus = 'confirmed';
  }

  // Stamp paidAt the first time a booking becomes paid (drives refund tiers).
  if (this.isModified('paymentStatus') && this.paymentStatus === 'paid' && !this.paidAt) {
    this.paidAt = new Date();
  }

  // Validate dates
  if (this.checkIn >= this.checkOut) {
    return next(new Error('Check-out must be after check-in'));
  }

  next();
});

/**
 * Stamp paidAt when a booking is marked paid via an update query (findByIdAndUpdate,
 * updateOne, etc.) which bypasses the 'save' hook above.
 */
bookingSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
  const update = this.getUpdate() || {};
  const set = update.$set || update;
  const becomingPaid = set.paymentStatus === 'paid';
  const paidAtAlreadySet = set.paidAt !== undefined || (update.$set && update.$set.paidAt !== undefined);
  if (becomingPaid && !paidAtAlreadySet) {
    if (update.$set) update.$set.paidAt = new Date();
    else update.paidAt = new Date();
    this.setUpdate(update);
  }
  next();
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * BookingModel.
 */
const BookingModel = mongoose.model("BookingModel", bookingSchema);

export default BookingModel;
