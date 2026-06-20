import mongoose from 'mongoose';
import PropertyModel from '../models/PropertyModel.js';
import Wishlist from '../models/WishListModel.js';

/**
 * Toggles a property in the user's wishlist (adds if not present, removes if it is).
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const toggleWishlist = async (req, res) => {
  try {
    const {
      propertyId
    } = req.body;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: 'Property ID required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid property ID'
      });
    }

    const property = await PropertyModel.findById(propertyId).select('_id');
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const existing = await Wishlist.findOne({
      userId: req.user._id,
      propertyId: property._id
    });

    if (existing) {
      await Wishlist.deleteOne({
        _id: existing._id
      });
      return res.json({
        success: true,
        message: 'Removed from wishlist',
        wishlisted: false
      });
    }

    try {
      await Wishlist.create({
        userId: req.user._id,
        propertyId: property._id
      });
    } catch (err) {
      if (err?.code === 11000) {
        // This case should theoretically be caught by the findOne check above.
        // If it still hits here, it might be a race condition or a different unique index (e.g., on userId alone).
        return res.status(400).json({
          success: false,
          message: 'Already in wishlist or database constraint error. If this is a different property, please check your database indexes.',
          wishlisted: true
        });
      }
      throw err;
    }

    return res.status(201).json({
      success: true,
      message: 'Added to wishlist',
      wishlisted: true
    });
  } catch (err) {
    console.error('toggleWishlist error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to update wishlist'
    });
  }
};

/**
 * Retrieves the wishlist for the logged-in user.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const getMyWishlist = async (req, res) => {
  try {
    const items = await Wishlist.find({ userId: req.user._id })
      .populate({
        path: 'propertyId',
        select: '_id name type city price images available pricing listingType'
      })
      .sort({ createdAt: -1 })
      .lean();

    // Transform populated items into a flat list of properties
    const wishlist = items
      .filter(item => item.propertyId && typeof item.propertyId === 'object') // Filter out items where property might have been deleted or not populated
      .map(item => ({
        ...item.propertyId,
        _id: item.propertyId._id.toString(), // Ensure _id is a string for frontend
        wishlistedAt: item.createdAt
      }));

    return res.json({
      success: true,
      wishlist
    });
  } catch (err) {
    console.error('getMyWishlist error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to load wishlist'
    });
  }
};

/**
 * Checks if a specific property is in the user's wishlist.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const checkWishlist = async (req, res) => {
  try {
    const exists = await Wishlist.findOne({
      userId: req.user._id,
      propertyId: req.params.propertyId
    });

    res.json({
      success: true,
      wishlisted: Boolean(exists)
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

export {
  toggleWishlist,
  getMyWishlist,
  checkWishlist
};
