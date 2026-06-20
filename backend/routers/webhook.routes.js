/**
 * @fileoverview Webhook routes for Stripe integration
 * @module routers/webhook
 */

import express from 'express';
import { stripeWebhook } from '../controllers/StripeWebhook.controller.js';

const router = express.Router();

/* -------------------------------------------------------------------------- */
/*                                Webhook Routes                              */
/* -------------------------------------------------------------------------- */

/**
 * @route POST /api/webhook
 * @description Handle incoming Stripe webhook events
 * @access Public (Secret verified in controller)
 */
router.post('/', stripeWebhook);

export default router;
