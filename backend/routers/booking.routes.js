/**
 * @file booking.routes.js
 * @description Express router for managing property bookings, payments, and refunds.
 */

import express from 'express';
import {
  createBooking,
  checkAvailability,
  previewCancelRefund,
  cancelWithRefund,
  deleteBooking,
  hostDeleteBooking,
  adminDeleteBooking,
  getSingleBooking,
  getHostBookings,
  getHostDashboardStats,
  getHostPayments,
  getGuestBookings,
  getAdminBookings,
  getAdminRefunds,
  requestRefund,
  getRefundRequests,
  updateRefundStatus,
  adminProcessRefund,
  confirmCashPayment,
  releaseDeposit,
  claimDeposit,
  verifyStripePayment,
} from '../controllers/Booking.controller.js';
import {
  getHostEarnings
} from '../controllers/HostEarnings.controller.js';
import {
  isAuthenticated,
  isAuthorized
} from '../middlewares/authMiddleware.js';
import { requireAdminGate } from '../middlewares/adminGate.js';

const router = express.Router();

// ─── GUEST ROUTES ────────────────────────────────────────────────────────────

/**
 * @route POST /api/bookings/create-booking
 * @desc Create a new booking.
 */
router.post('/create-booking', isAuthenticated, isAuthorized('guest', 'host'), createBooking);

/**
 * @route POST /api/bookings/check-availability
 * @desc Check if a property is available for specific dates.
 */
router.post('/check-availability', isAuthenticated, checkAvailability);

/**
 * @route GET /api/bookings/my-bookings
 * @desc Get bookings for the authenticated guest.
 */
router.get('/my-bookings', isAuthenticated, isAuthorized('guest', 'host'), getGuestBookings);

/**
 * @route POST /api/bookings/:id/verify-payment
 * @desc Verify a Stripe checkout payment server-side (webhook fallback).
 */
router.post('/:id/verify-payment', isAuthenticated, isAuthorized('guest', 'host'), verifyStripePayment);

// ─── HOST ROUTES ─────────────────────────────────────────────────────────────

/**
 * @route GET /api/bookings/host/all-bookings
 * @desc Get all bookings for properties owned by the host.
 */
router.get('/host/all-bookings', isAuthenticated, isAuthorized('host'), getHostBookings);

/**
 * @route GET /api/bookings/host/dashboard-stats
 * @desc Get booking statistics for the host dashboard.
 */
router.get('/host/dashboard-stats', isAuthenticated, isAuthorized('host'), getHostDashboardStats);

/**
 * @route GET /api/bookings/host/earnings
 * @desc Get total earnings for the host.
 */
router.get('/host/earnings', isAuthenticated, isAuthorized('host'), getHostEarnings);

/**
 * @route GET /api/bookings/host/payments
 * @desc Get payment history for the host.
 */
router.get('/host/payments', isAuthenticated, isAuthorized('host'), getHostPayments);

/**
 * @route GET /api/bookings/host/refunds
 * @desc Get refund requests for the host to review.
 */
router.get('/host/refunds', isAuthenticated, isAuthorized('host'), getRefundRequests);

/**
 * @route PATCH /api/bookings/host/:id/confirm-cash
 * @desc Confirm receipt of cash payment from a guest.
 */
router.patch('/host/:id/confirm-cash', isAuthenticated, isAuthorized('host'), confirmCashPayment);

/**
 * @route PATCH /api/bookings/host/:id/release-deposit
 * @desc Release a held security deposit.
 */
router.patch('/host/:id/release-deposit', isAuthenticated, isAuthorized('host'), releaseDeposit);

/**
 * @route PATCH /api/bookings/host/:id/claim-deposit
 * @desc Claim a security deposit due to damages.
 */
router.patch('/host/:id/claim-deposit', isAuthenticated, isAuthorized('host'), claimDeposit);

/**
 * @route DELETE /api/bookings/host/:id
 * @desc Host-side deletion/cancellation of a booking.
 */
router.delete('/host/:id', isAuthenticated, isAuthorized('host'), hostDeleteBooking);

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────────

/**
 * @route DELETE /api/bookings/admin/:id
 * @desc Administrative deletion of any booking.
 */
router.delete('/admin/:id', isAuthenticated, isAuthorized('admin'), requireAdminGate, adminDeleteBooking);

/**
 * @route GET /api/bookings/admin/refunds
 * @desc Get all refund requests for admin review.
 */
router.get('/admin/refunds', isAuthenticated, isAuthorized('admin'), requireAdminGate, getAdminRefunds);

/**
 * @route PATCH /api/bookings/admin/refund/:id
 * @desc Admin processing of a refund.
 */
router.patch('/admin/refund/:id', isAuthenticated, isAuthorized('admin'), requireAdminGate, adminProcessRefund);

/**
 * @route GET /api/bookings/admin/all-bookings
 * @desc Retrieve all bookings on the platform.
 */
router.get('/admin/all-bookings', isAuthenticated, isAuthorized('admin'), requireAdminGate, getAdminBookings);

// ─── PARAMETERIZED & GENERAL ROUTES ──────────────────────────────────────────

/**
 * @route GET /api/bookings/:id/cancel-preview
 * @desc Preview refund amount before confirming cancellation.
 */
router.get('/:id/cancel-preview', isAuthenticated, isAuthorized('guest', 'host'), previewCancelRefund);

/**
 * @route POST /api/bookings/:id/cancel
 * @desc Cancel a booking and process eligible refunds.
 */
router.post('/:id/cancel', isAuthenticated, isAuthorized('guest', 'host'), cancelWithRefund);

/**
 * @route GET /api/bookings/:id
 * @desc Get details of a single booking.
 */
router.get('/:id', isAuthenticated, getSingleBooking);

/**
 * @route DELETE /api/bookings/:id
 * @desc Guest-side deletion of a booking.
 */
router.delete('/:id', isAuthenticated, isAuthorized('guest', 'host'), deleteBooking);

/**
 * @route POST /api/bookings/:id/refund-request
 * @desc Manually request a refund for a booking.
 */
router.post('/:id/refund-request', isAuthenticated, isAuthorized('guest', 'host'), requestRefund);

/**
 * @route PATCH /api/bookings/:id/refund-status
 * @desc Update the status of a refund request (Host).
 */
router.patch('/:id/refund-status', isAuthenticated, isAuthorized('host'), updateRefundStatus);

export default router;
