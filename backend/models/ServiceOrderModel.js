/**
 * @file ServiceOrderModel.js
 * @description Mongoose model for service orders (concierge services) associated with a booking.
 */

import mongoose from "mongoose";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ServiceOrder
 * @property {mongoose.Schema.Types.ObjectId} bookingId - Reference to the Booking.
 * @property {mongoose.Schema.Types.ObjectId} serviceId - Reference to the ServiceMenu item.
 * @property {mongoose.Schema.Types.ObjectId} propertyId - Reference to the Property.
 * @property {mongoose.Schema.Types.ObjectId} userId - Reference to the User who ordered.
 * @property {number} quantity - Number of units ordered.
 * @property {number} priceAtOrder - Unit price at the time of order.
 * @property {number} totalPrice - Total calculated price.
 * @property {string} status - Current status of the service order.
 */
const serviceOrderSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BookingModel',
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceMenu',
    required: true
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  priceAtOrder: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// ─── INDEXES ─────────────────────────────────────────────────────────────────

serviceOrderSchema.index({
  bookingId: 1
});

serviceOrderSchema.index({
  userId: 1
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * ServiceOrderModel.
 */
const ServiceOrderModel = mongoose.model('ServiceOrder', serviceOrderSchema);

export default ServiceOrderModel;
