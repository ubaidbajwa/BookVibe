/**
 * @file review.routes.js
 * @description Express router for property reviews and host replies.
 */

import express from 'express';
import {
  isAuthenticated,
  isAuthorized
} from '../middlewares/authMiddleware.js';
import {
  createReview,
  getPropertyReviews,
  getMyReviews,
  canReview,
  replyToReview,
  deleteReview,
} from '../controllers/Review.controller.js';

const router = express.Router();

// ─── GUEST ROUTES ────────────────────────────────────────────────────────────

/**
 * @route GET /api/reviews/can-review/:bookingId
 * @desc Check if the guest is eligible to review a specific booking.
 */
router.get('/can-review/:bookingId', isAuthenticated, canReview);

/**
 * @route POST /api/reviews
 * @desc Submit a new review for a stay.
 */
router.post('/', isAuthenticated, isAuthorized('guest', 'host'), createReview);

/**
 * @route GET /api/reviews/my-reviews
 * @desc Get reviews written by the authenticated guest.
 */
router.get('/my-reviews', isAuthenticated, isAuthorized('guest', 'host'), getMyReviews);

// ─── PUBLIC ROUTES ───────────────────────────────────────────────────────────

/**
 * @route GET /api/reviews/property/:propertyId
 * @desc Get all reviews for a specific property.
 */
router.get('/property/:propertyId', getPropertyReviews);

// ─── HOST ROUTES ─────────────────────────────────────────────────────────────

/**
 * @route POST /api/reviews/:id/reply
 * @desc Post a host reply to a guest review.
 */
router.post('/:id/reply', isAuthenticated, isAuthorized('host'), replyToReview);

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────────

/**
 * @route DELETE /api/reviews/:id
 * @desc Administrative deletion (hiding) of a review.
 */
router.delete('/:id', isAuthenticated, isAuthorized('admin'), deleteReview);

export default router;
