/**
 * @file FoodMenuModel.js
 * @description Mongoose model for food menu items associated with a property.
 */

import mongoose from "mongoose";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FoodMenu
 * @property {string} foodname - Name of the food item.
 * @property {number} foodprice - Price of the food item.
 * @property {string} servingAt - Time of day the item is served (breakfast, lunch, etc.).
 * @property {mongoose.Schema.Types.ObjectId} propertyId - Reference to the associated Property.
 */
const foodMenuSchema = new mongoose.Schema({
  foodname: {
    type: String,
    required: true,
  },
  foodprice: {
    type: Number,
    required: true,
  },
  servingAt: {
    type: String,
    enum: ["breakfast", "lunch", "dinner", "other"],
    required: true,
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
    required: true,
  },
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * FoodMenuModel.
 */
const FoodMenuModel = mongoose.model("FoodMenuModel", foodMenuSchema);

export default FoodMenuModel;
