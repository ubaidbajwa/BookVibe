import Review from '../models/ReviewModel.js';
import Booking from '../models/BookingModel.js';
import Property from '../models/PropertyModel.js';
import { notifyHost } from '../utils/notificationHelper.js';

const REVIEW_WINDOW_DAYS = 15;

/**
 * Creates a new review for a property after a stay has begun.
 * 
 * Rules:
 * 1. Guest must have their own booking.
 * 2. Booking must not be cancelled.
 * 3. Payment must be "paid" or "arrival" method.
 * 4. Check-in date must have passed.
 * 5. Review must be within 15 days of check-in.
 * 6. Minimum 1 night stay required.
 * 7. Only one review per booking.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const createReview = async (req, res) => {
  try {
    const {
      bookingId,
      rating,
      title,
      comment,
      categories
    } = req.body;

    if (!bookingId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and rating required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be 1-5'
      });
    }

    const booking = await Booking.findById(bookingId).populate('propertyId');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Rule 1: Sirf apni booking pe review
    if (String(booking.userId) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not your booking'
      });
    }

    // Rule 2: Cancelled booking pe review nahi
    if (booking.bookingStatus === 'cancel') {
      return res.status(400).json({
        success: false,
        message: 'Cannot review cancelled booking'
      });
    }

    // Rule 3: Payment confirmed honi chahiye
    if (booking.paymentStatus !== 'paid' && booking.paymentMethod !== 'arrival') {
      return res.status(400).json({
        success: false,
        message: 'Review only allowed after payment is confirmed'
      });
    }

    // Rule 4: Check-in date aa chuki ho (stay shuru ho gayi)
    const now = new Date();
    const checkInDate = new Date(booking.checkIn);
    if (checkInDate > now) {
      return res.status(400).json({
        success: false,
        message: 'Can only review after your stay begins'
      });
    }

    // Rule 5: 15 din ka window — check-in ke baad
    const daysSinceCheckIn = Math.floor((now - checkInDate) / (1000 * 60 * 60 * 24));
    if (daysSinceCheckIn > REVIEW_WINDOW_DAYS) {
      return res.status(400).json({
        success: false,
        message: `Review window has expired (${REVIEW_WINDOW_DAYS} days after check-in)`
      });
    }

    // Rule 6: Minimum 1 raat stay
    if (booking.stayDays < 1) {
      return res.status(400).json({
        success: false,
        message: 'Minimum 1 night stay required to leave a review'
      });
    }

    // Rule 7: Duplicate check
    const existing = await Review.findOne({
      booking: bookingId
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Already reviewed this booking'
      });
    }

    // Check-out guzri hai ya nahi — for verified badge
    const checkOutDate = new Date(booking.checkOut);
    const stayCompleted = checkOutDate <= now;

    // Create review
    const review = await Review.create({
      property: booking.propertyId._id,
      booking: bookingId,
      guest: req.user._id,
      host: booking.propertyId.hostBy,
      rating,
      title,
      comment,
      categories,
      isVerifiedStay: stayCompleted, // Only true if checkout passed
      stayDuration: booking.stayDays,
      paymentVerified: booking.paymentStatus === 'paid',
    });

    // Update property average rating
    const allReviews = await Review.find({
      property: booking.propertyId._id,
      isVisible: true
    });
    const avgRating = (allReviews.reduce((s, r) => {
      return s + r.rating;
    }, 0) / allReviews.length).toFixed(1);

    await Property.findByIdAndUpdate(booking.propertyId._id, {
      rating: avgRating,
      reviewCount: allReviews.length,
    });

    // Notify host
    await notifyHost(booking.propertyId.hostBy, 'review:new', {
      title: 'New Review',
      message: `${req.user.username} left a ${rating}-star review on ${booking.propertyId.name}`,
      type: 'booking',
      severity: 'info',
      link: `/host/accommodations/${booking.propertyId._id}`,
      propertyId: booking.propertyId._id,
      bookingId,
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted!',
      review
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * Retrieves public reviews for a specific property.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const getPropertyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
        property: req.params.propertyId,
        isVisible: true
      })
      .populate('guest', 'username profileImage')
      .sort({
        createdAt: -1
      })
      .lean();

    const stats = {
      total: reviews.length,
      average: reviews.length ?
        (reviews.reduce((s, r) => {
          return s + r.rating;
        }, 0) / reviews.length).toFixed(1) :
        0,
      distribution: [5, 4, 3, 2, 1].map((star) => {
        return {
          star,
          count: reviews.filter((r) => {
            return r.rating === star;
          }).length,
        };
      }),
    };

    res.json({
      success: true,
      reviews,
      stats
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * Retrieves reviews written by the logged-in guest.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
        guest: req.user._id
      })
      .populate('property', 'name images type')
      .sort({
        createdAt: -1
      });

    res.json({
      success: true,
      reviews
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * Checks if a guest is allowed to review a specific booking.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const canReview = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      return res.json({
        success: true,
        canReview: false,
        reason: 'Booking not found'
      });
    }

    if (String(booking.userId) !== String(req.user._id)) {
      return res.json({
        success: true,
        canReview: false,
        reason: 'Not your booking'
      });
    }

    if (booking.bookingStatus === 'cancel') {
      return res.json({
        success: true,
        canReview: false,
        reason: 'Booking was cancelled'
      });
    }

    if (booking.paymentStatus !== 'paid' && booking.paymentMethod !== 'arrival') {
      return res.json({
        success: true,
        canReview: false,
        reason: 'Payment not confirmed'
      });
    }

    // Check from check-IN date (not checkout)
    const now = new Date();
    const checkInDate = new Date(booking.checkIn);

    if (checkInDate > now) {
      return res.json({
        success: true,
        canReview: false,
        reason: 'Stay has not started yet'
      });
    }

    // 15-day window from check-in
    const daysSinceCheckIn = Math.floor((now - checkInDate) / (1000 * 60 * 60 * 24));
    if (daysSinceCheckIn > REVIEW_WINDOW_DAYS) {
      return res.json({
        success: true,
        canReview: false,
        reason: `Review window expired (${REVIEW_WINDOW_DAYS} days)`
      });
    }

    const existing = await Review.findOne({
      booking: req.params.bookingId
    });
    if (existing) {
      return res.json({
        success: true,
        canReview: false,
        reason: 'Already reviewed',
        reviewId: existing._id
      });
    }

    const daysLeft = REVIEW_WINDOW_DAYS - daysSinceCheckIn;

    res.json({
      success: true,
      canReview: true,
      daysLeft
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * Allows a host to reply to a review left on their property.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const replyToReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    if (String(review.host) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not your property review'
      });
    }

    if (review.hostReply?.text) {
      return res.status(400).json({
        success: false,
        message: 'Already replied'
      });
    }

    review.hostReply = {
      text: req.body.reply,
      repliedAt: new Date()
    };
    await review.save();

    res.json({
      success: true,
      message: 'Reply added',
      review
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/**
 * Hides a review (Admin action).
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const deleteReview = async (req, res) => {
  try {
    await Review.findByIdAndUpdate(req.params.id, {
      isVisible: false
    });

    res.json({
      success: true,
      message: 'Review hidden'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

export {
  createReview,
  getPropertyReviews,
  getMyReviews,
  canReview,
  replyToReview,
  deleteReview,
};
