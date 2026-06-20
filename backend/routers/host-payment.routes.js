/**
 * @file host-payment.routes.js
 * @description Express router for host financial management, including payout requests and payment info.
 */

import express from 'express';
import {
  isAuthenticated,
  isAuthorized
} from '../middlewares/authMiddleware.js';
import { requireAdminGate } from '../middlewares/adminGate.js';
import {
  savePaymentInfo,
  getMyPaymentInfo,
  getEarningsSummary,
  requestPayout,
  getMyPayouts,
  getAllPayoutRequests,
  processPayout,
  verifyHostPaymentInfo,
  getAllPaymentInfo,
} from '../controllers/HostPayment.controller.js';

const router = express.Router();

// ─── HOST ROUTES ─────────────────────────────────────────────────────────────

/**
 * @route POST /api/host-payments/payment-info
 * @desc Save or update host withdrawal payment information.
 */
router.post('/payment-info', isAuthenticated, isAuthorized('host'), savePaymentInfo);

/**
 * @route GET /api/host-payments/payment-info
 * @desc Get the authenticated host's payment information.
 */
router.get('/payment-info', isAuthenticated, isAuthorized('host'), getMyPaymentInfo);

/**
 * @route GET /api/host-payments/earnings
 * @desc Get a summary of earnings and pending balances for the host.
 */
router.get('/earnings', isAuthenticated, isAuthorized('host'), getEarningsSummary);

/**
 * @route POST /api/host-payments/request-payout
 * @desc Request a payout of earned funds.
 */
router.post('/request-payout', isAuthenticated, isAuthorized('host'), requestPayout);

/**
 * @route GET /api/host-payments/payouts
 * @desc Get payout history for the authenticated host.
 */
router.get('/payouts', isAuthenticated, isAuthorized('host'), getMyPayouts);

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────────

/**
 * @route GET /api/host-payments/admin/payouts
 * @desc Get all pending and processed payout requests.
 */
router.get('/admin/payouts', isAuthenticated, isAuthorized('admin'), requireAdminGate, getAllPayoutRequests);

/**
 * @route GET /api/host-payments/admin/payment-info
 * @desc List every host's saved payment info (pending-verification first).
 */
router.get('/admin/payment-info', isAuthenticated, isAuthorized('admin'), requireAdminGate, getAllPaymentInfo);

/**
 * @route PATCH /api/host-payments/admin/payouts/:id
 * @desc Process and complete a host payout request.
 */
router.patch('/admin/payouts/:id', isAuthenticated, isAuthorized('admin'), requireAdminGate, processPayout);

/**
 * @route PATCH /api/host-payments/admin/verify/:hostId
 * @desc Verify a host's payment information for withdrawals.
 */
router.patch('/admin/verify/:hostId', isAuthenticated, isAuthorized('admin'), requireAdminGate, verifyHostPaymentInfo);

export default router;
