/**
 * @file PropertyModel.js
 * @description Mongoose model for properties, including pricing, stay types, verification, and house rules.
 */

import mongoose from "mongoose";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Property
 * @property {string} name - Property name.
 * @property {string} type - Accommodation type (e.g., Room, Apartment, House, Hotel, Hostel).
 * @property {string} city - Property city.
 * @property {string} country - Property country.
 * @property {string} address - Detailed address.
 * @property {Object} coordinates - Latitude and longitude.
 * @property {number} price - Base nightly price (legacy/fallback).
 * @property {Object} pricing - Tiered pricing (nightly, weekly, monthly).
 * @property {Array} stayTypes - Supported stay durations.
 * @property {number} minStay - Minimum nights per stay.
 * @property {number} maxStay - Maximum nights per stay.
 * @property {Array} amenities - List of amenities.
 * @property {string} description - Property description.
 * @property {Object} foodServices - Food availability and details.
 * @property {Object} medicalServices - Medical support details.
 * @property {Object} houseRules - Property rules and guest limits.
 * @property {Object} damagePolicy - Damage deposit requirements.
 * @property {string} cancellationPolicy - Cancellation tier.
 * @property {Array} images - List of property images.
 * @property {Array} ownershipDocuments - Verification documents.
 * @property {mongoose.Schema.Types.ObjectId} hostBy - Reference to the Host.
 * @property {boolean} available - Visibility status.
 * @property {string} verificationStatus - Admin verification tier.
 */
const propertySchema = new mongoose.Schema({
  name: { type: String, required: true },
  listingType: { 
    type: String, 
    enum: ["single", "multi"], 
    default: "single" 
  },
  type: { 
    type: String, 
    required: true,
    enum: ["Room", "Apartment", "House", "Hotel", "Hostel", "Guest House", "Plaza"] 
  },
  city: { type: String, required: true },
  country: { type: String, required: true },
  address: { type: String, required: true },
  coordinates: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
  },
  
  // Legacy / Fallback price
  price: { type: Number, required: true },

  // ── MULTI-UNIT SUPPORT (Hotels / Hostels / Plazas) ──
  subUnits: [{
    roomNo: { type: String }, // e.g., "101", "A-12"
    name: { type: String, required: true }, // e.g., "Deluxe Double", "3-Seater Dorm"
    description: { type: String },
    floor: { type: String }, // e.g., "Ground", "1st", "Basement"
    block: { type: String }, // e.g., "Block A", "Female Wing"
    unitType: { 
      type: String, 
      enum: ["Entire Home", "Single", "Double", "Suite", "Dorm Bed", "Office", "Shop"],
      required: true 
    },
    basePrice: { type: Number, required: true }, // Nightly
    pricing: {
      weekly: { type: Number },
      monthly: { type: Number },
    },
    stayTypes: {
      type: [String],
      enum: ["nightly", "weekly", "monthly"],
      default: ["nightly"],
    },
    capacity: { type: Number, default: 1 },
    amenities: [String],
    images: [
      {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    available: { type: Boolean, default: true },
  }],

  // ── DYNAMIC ADD-ON SERVICES ──
  addOnServices: [{
    serviceName: { type: String, required: true }, // e.g., "Laundry", "Mess"
    price: { type: Number, required: true },
    billingType: { 
      type: String, 
      enum: ['per_day', 'per_night', 'per_stay', 'per_person', 'per_item'],
      default: 'per_stay'
    },
  }],

  // ── SMART PRICING TIERS (for single-unit properties) ──
  pricing: {
    nightly: { type: Number },
    weekly: { type: Number }, // Price per week
    monthly: { type: Number }, // Price per month
    weeklyDiscount: { type: Number, default: 0 },
    monthlyDiscount: { type: Number, default: 0 },
  },

  stayTypes: {
    type: [String],
    enum: ["nightly", "weekly", "monthly"],
    default: ["nightly"],
  },

  minStay: { type: Number, default: 1 },
  maxStay: { type: Number, default: 365 },

  checkInTime: { type: String, default: "14:00" },
  checkOutTime: { type: String, default: "11:00" },
  flexibleCheckIn: { type: Boolean, default: false },

  amenities: { type: [String], default: [] },
  description: { type: String, required: true },

  foodServices: {
    available: { type: Boolean, default: false },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    price: { type: Number, default: 0 },
  },

  medicalServices: {
    available: { type: Boolean, default: false },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
  },

  houseRules: {
    smokingAllowed: { type: Boolean, default: false },
    petsAllowed: { type: Boolean, default: false },
    partiesAllowed: { type: Boolean, default: false },
    quietHoursStart: { type: String, default: "22:00" },
    quietHoursEnd: { type: String, default: "07:00" },
    maxGuests: { type: Number, default: 2 },
    customRules: [String],
  },

  damagePolicy: {
    depositRequired: { type: Boolean, default: false },
    depositAmount: { type: Number, default: 0 },
    damageRules: { type: String, default: "" },
  },

  cancellationPolicy: {
    type: String,
    enum: ["flexible", "moderate", "strict"],
    default: "moderate",
  },

  // When true, only identity-verified (KYC-passed) guests may book this property.
  onlyVerifiedGuests: { type: Boolean, default: false },

  images: [
    {
      public_id: { type: String, required: true },
      url: { type: String, required: true },
    },
  ],

  ownershipDocuments: [
    {
      public_id: { type: String, required: true },
      url: { type: String, required: true },
      docType: { type: String, default: 'utility_bill' }
    }
  ],

  hostBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserAndHost",
    required: true,
  },

  available: { type: Boolean, default: true },
  
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

// ─── INDEXES ─────────────────────────────────────────────────────────────────

// Full-text search index
propertySchema.index({ 
  name: 'text', 
  city: 'text', 
  country: 'text', 
  type: 'text',
  address: 'text'
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * Property model.
 */
const PropertyModel = mongoose.model("Property", propertySchema);

export default PropertyModel;
