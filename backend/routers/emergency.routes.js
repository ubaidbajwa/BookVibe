/**
 * @file emergency.routes.js
 * @description Express router for emergency services, such as medical SOS triggers.
 */

import express from 'express';
import {
  triggerMedicalSOS
} from '../controllers/Emergency.controller.js';
import {
  isAuthenticated
} from '../middlewares/authMiddleware.js';

const router = express.Router();

// ─── EMERGENCY ROUTES ────────────────────────────────────────────────────────

/**
 * @route POST /api/emergency/sos
 * @desc Trigger a medical SOS alert for a stay.
 */
router.post('/sos', isAuthenticated, triggerMedicalSOS);

export default router;
