/**
 * @file ServiceMenuModel.js
 * @description Mongoose model for concierge or other services offered at a property.
 */

import mongoose from "mongoose";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ServiceMenu
 * @property {mongoose.Schema.Types.ObjectId} propertyId - Reference to the Property.
 * @property {string} serviceName - Name of the service.
 * @property {number} price - Price for the service.
 * @property {string} description - Brief description of the service.
 * @property {boolean} isAvailable - Availability status of the service.
 */
const serviceMenuSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  serviceName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  description: {
    type: String
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// ─── INDEXES ─────────────────────────────────────────────────────────────────

serviceMenuSchema.index({
  propertyId: 1,
  serviceName: 1
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * ServiceMenuModel.
 */
const ServiceMenuModel = mongoose.model('ServiceMenu', serviceMenuSchema);

export default ServiceMenuModel;
