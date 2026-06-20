/**
 * @file WishListModel.js
 * @description Mongoose model for user property wishlists.
 */

import mongoose from 'mongoose';

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Wishlist
 * @property {mongoose.Schema.Types.ObjectId} userId - Reference to the User.
 * @property {mongoose.Schema.Types.ObjectId} propertyId - Reference to the Property.
 * @property {string} note - Personal note for the wishlisted item.
 */
const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAndHost',
    required: true,
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
  },
  note: {
    type: String,
    maxlength: 300
  },
}, {
  timestamps: true
});

// ─── INDEXES ─────────────────────────────────────────────────────────────────

// Compound unique index: A user can only have a specific property once in their wishlist.
// IMPORTANT: If you cannot add more than one DIFFERENT property, check MongoDB Compass 
// and ensure there is NO unique index on 'userId' alone.
wishlistSchema.index({
  userId: 1,
  propertyId: 1
}, {
  unique: true
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * Wishlist model.
 */
const Wishlist = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema);

export default Wishlist;
