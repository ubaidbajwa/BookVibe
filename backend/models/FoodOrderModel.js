/**
 * @file FoodOrderModel.js
 * @description Mongoose model for food orders linked to a booking.
 */

import mongoose from "mongoose";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FoodOrder
 * @property {mongoose.Schema.Types.ObjectId} bookingId - Reference to the Booking.
 * @property {mongoose.Schema.Types.ObjectId} propertyId - Reference to the Property.
 * @property {mongoose.Schema.Types.ObjectId} hostId - Reference to the Host (UserAndHost).
 * @property {mongoose.Schema.Types.ObjectId} guestId - Reference to the Guest (UserAndHost).
 * @property {Array<Object>} items - List of food items in the order.
 * @property {number} totalPrice - Total price of the food order.
 * @property {string} status - Current status of the order.
 * @property {Date} orderDate - Date when the order was placed.
 * @property {Date} deliveryTime - Expected or actual delivery time.
 * @property {string} notes - Additional notes for the order.
 */
const foodOrderSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BookingModel",
    required: true,
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
    required: true,
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserAndHost",
    required: true,
  },
  guestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserAndHost",
    required: true,
  },
  items: [{
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodMenuModel"
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      default: 1
    },
    servingAt: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "other"]
    },
  }],
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "preparing", "delivered", "cancelled"],
    default: "pending",
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  deliveryTime: {
    type: Date
  },
  notes: {
    type: String
  },
}, {
  timestamps: true
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * FoodOrderModel.
 */
const FoodOrderModel = mongoose.model("FoodOrder", foodOrderSchema);

export default FoodOrderModel;
