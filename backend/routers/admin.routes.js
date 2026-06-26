/**
 * @file admin.routes.js
 * @description Express router for administrative management, including user, host, property, and KYC verification.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  isAuthenticated,
  isAuthorized
} from '../middlewares/authMiddleware.js';
import {
  getAdminStats,
  getAllUsers,
  getRecentUsers,
  getAllHosts,
  getPendingHosts,
  verifyHost,
  blockUser,
  unblockUser,
  adminDeleteUser,
  getAnalytics,
  getAdminComplaints,
  getAdminComplaintDetail,
  updateAdminComplaint,
  sendAdminComplaintMessage,
  getBlacklist,
  addBlacklistEntry,
  removeBlacklistEntry,
  verifyAdminPin,
  verifyProperty,
} from '../controllers/Admin.controller.js';
import {
  getKycQueue,
  verifyKyc
} from '../controllers/Admin.kyc.controller.js';
import { requireAdminGate } from '../middlewares/adminGate.js';

const router = express.Router();

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────

// All routes require admin role
router.use(isAuthenticated, isAuthorized('admin'));

// ─── SECURITY: PIN GATE ──────────────────────────────────────────────────────

/**
 * Strict limiter on PIN attempts — a 6-digit PIN is the admin second factor, so
 * a stolen admin session must not be able to brute-force it. 5 attempts per
 * 15 minutes per IP makes enumeration of the 10^6 keyspace infeasible.
 */
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    code: 'ADMIN_GATE_REQUIRED',
    message: 'Too many PIN attempts. Please try again in 15 minutes.',
  },
});

/**
 * @route POST /api/v1/user/admin/verify-pin
 * @desc Verify the admin security PIN and issue a gate token.
 *       Defined BEFORE the gate guard — this is how the gate token is obtained.
 */
router.post('/verify-pin', pinLimiter, verifyAdminPin);

// Every admin data/action route below requires a valid gate token (second factor).
router.use(requireAdminGate);

// ─── DASHBOARD ROUTES ────────────────────────────────────────────────────────

/**
 * @route GET /api/admin/stats
 * @desc Get high-level administrative statistics for the dashboard.
 */
router.get('/stats', getAdminStats);

/**
 * @route GET /api/admin/analytics
 * @desc Get detailed platform analytics.
 */
router.get('/analytics', getAnalytics);

/**
 * @route GET /api/admin/recent-users
 * @desc Get a list of recently joined users.
 */
router.get('/recent-users', getRecentUsers);

// ─── USER MANAGEMENT ROUTES ──────────────────────────────────────────────────

/**
 * @route GET /api/admin/all-users
 * @desc Retrieve all registered users.
 */
router.get('/all-users', getAllUsers);

/**
 * @route PATCH /api/admin/block/:id
 * @desc Block a user by their ID.
 */
router.patch('/block/:id', blockUser);

/**
 * @route PATCH /api/admin/unblock/:id
 * @desc Unblock a user by their ID.
 */
router.patch('/unblock/:id', unblockUser);

/**
 * @route DELETE /api/admin/delete/:id
 * @desc Permanently delete a user account.
 */
router.delete('/delete/:id', adminDeleteUser);

// ─── HOST & PROPERTY MANAGEMENT ROUTES ───────────────────────────────────────

/**
 * @route GET /api/admin/all-hosts
 * @desc Retrieve all hosts.
 */
router.get('/all-hosts', getAllHosts);

/**
 * @route GET /api/admin/pending-hosts
 * @desc Retrieve hosts awaiting verification.
 */
router.get('/pending-hosts', getPendingHosts);

/**
 * @route PATCH /api/admin/verify-host/:id
 * @desc Manually verify a host account.
 */
router.patch('/verify-host/:id', verifyHost);

/**
 * @route PATCH /api/admin/verify-property/:id
 * @desc Manually verify a property listing.
 */
router.patch('/verify-property/:id', verifyProperty);

// ─── KYC VERIFICATION QUEUE ROUTES ───────────────────────────────────────────

/**
 * @route GET /api/admin/kyc-queue
 * @desc Get the queue of users waiting for KYC verification.
 */
router.get('/kyc-queue', getKycQueue);

/**
 * @route PATCH /api/admin/verify-kyc/:id
 * @desc Perform administrative KYC verification for a user.
 */
router.patch('/verify-kyc/:id', verifyKyc);

// ─── COMPLAINT MANAGEMENT ROUTES ─────────────────────────────────────────────

/**
 * @route GET /api/admin/complaints
 * @desc Retrieve all complaints filed on the platform.
 */
router.get('/complaints', getAdminComplaints);

/**
 * @route GET /api/admin/complaint/:id
 * @desc Retrieve a single complaint with offender KYC + evidence for review.
 */
router.get('/complaint/:id', getAdminComplaintDetail);

/**
 * @route PATCH /api/admin/complaint/:id
 * @desc Update the status or respond to a complaint.
 */
router.patch('/complaint/:id', updateAdminComplaint);

/**
 * @route POST /api/admin/complaint/:id/message
 * @desc Post an admin reply into the complaint thread and notify both parties.
 */
router.post('/complaint/:id/message', sendAdminComplaintMessage);

// ─── BLACKLIST MANAGEMENT ROUTES ─────────────────────────────────────────────

/**
 * @route GET /api/admin/blacklist
 * @desc List all permanent ban (blacklist) entries.
 */
router.get('/blacklist', getBlacklist);

/**
 * @route POST /api/admin/blacklist
 * @desc Manually blacklist a CNIC / email / phone.
 */
router.post('/blacklist', addBlacklistEntry);

/**
 * @route DELETE /api/admin/blacklist/:id
 * @desc Remove a blacklist entry (lifts the ban).
 */
router.delete('/blacklist/:id', removeBlacklistEntry);

export default router;
