/**
 * @file verification.routes.js
 * @description Express router for AI-powered identity verification (OCR, Face Match, Liveness).
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  previewCnicOcr,
  previewFaceMatch,
  previewLiveness,
  extractCnicData,
  matchFace,
  checkLiveness,
  fullKycVerification,
  resubmitVerification,
} from '../controllers/Verification.controller.js';
import {
  isAuthenticated
} from '../middlewares/authMiddleware.js';

const router = express.Router();

// ─── RATE LIMITING ───────────────────────────────────────────────────────────

/**
 * Rate limit for public verification endpoints to prevent resource exhaustion.
 */
const publicVerifyLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again in 15 minutes.'
  },
});

// ─── PUBLIC PRE-REGISTRATION ROUTES ──────────────────────────────────────────

/**
 * @route POST /api/verify/cnic-ocr
 * @desc OCR preview for CNIC image (Rate-limited).
 */
router.post('/cnic-ocr', publicVerifyLimit, previewCnicOcr);

/**
 * @route POST /api/verify/face-match
 * @desc Face match preview (Selfie vs CNIC) (Rate-limited).
 */
router.post('/face-match', publicVerifyLimit, previewFaceMatch);

/**
 * @route POST /api/verify/liveness
 * @desc Liveness check preview (Rate-limited).
 */
router.post('/liveness', publicVerifyLimit, previewLiveness);

// ─── AUTHENTICATED VERIFICATION ROUTES ───────────────────────────────────────

/**
 * @route POST /api/verify/cnic/extract
 * @desc Extract data from CNIC for an authenticated user.
 */
router.post('/cnic/extract', isAuthenticated, extractCnicData);

/**
 * @route POST /api/verify/face/match
 * @desc Perform face matching for an authenticated user.
 */
router.post('/face/match', isAuthenticated, matchFace);

/**
 * @route POST /api/verify/liveness/check
 * @desc Perform liveness check for an authenticated user.
 */
router.post('/liveness/check', isAuthenticated, checkLiveness);

/**
 * @route POST /api/verify/kyc/full
 * @desc Execute the full KYC verification pipeline.
 */
router.post('/kyc/full', isAuthenticated, fullKycVerification);

/**
 * @route POST /api/verify/resubmit
 * @desc Re-submit documents after admin rejection (rejected accounts only).
 */
router.post('/resubmit', isAuthenticated, resubmitVerification);

export default router;
