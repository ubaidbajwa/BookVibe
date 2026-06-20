/**
 * @fileoverview Wishlist management routes
 * @module routers/wishlist
 */

import express from 'express';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import {
  toggleWishlist,
  getMyWishlist,
  checkWishlist
} from '../controllers/Wishlist.controller.js';

const router = express.Router();

/* -------------------------------------------------------------------------- */
/*                               Wishlist Routes                              */
/* -------------------------------------------------------------------------- */

/**
 * @route POST /api/wishlist/toggle
 * @description Add or remove a property from user's wishlist
 * @access Private
 */
router.post('/toggle', isAuthenticated, toggleWishlist);

/**
 * @route GET /api/wishlist/my
 * @description Get all properties in user's wishlist
 * @access Private
 */
router.get('/my', isAuthenticated, getMyWishlist);

/**
 * @route GET /api/wishlist/check/:propertyId
 * @description Check if a specific property is in user's wishlist
 * @access Private
 */
router.get('/check/:propertyId', isAuthenticated, checkWishlist);

export default router;
