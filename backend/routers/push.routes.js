/**
 * @file push.routes.js
 * @description Express router for Web Push subscription management.
 */

import express from 'express';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import { getVapidPublicKey, subscribe, unsubscribe } from '../controllers/Push.controller.js';

const router = express.Router();

/**
 * @route GET /api/v1/push/vapid-public-key
 * @desc Get the VAPID public key needed to create a push subscription.
 */
router.get('/vapid-public-key', isAuthenticated, getVapidPublicKey);

/**
 * @route POST /api/v1/push/subscribe
 * @desc Save a push subscription for the authenticated user's current browser/device.
 */
router.post('/subscribe', isAuthenticated, subscribe);

/**
 * @route POST /api/v1/push/unsubscribe
 * @desc Remove a push subscription for the authenticated user's current browser/device.
 */
router.post('/unsubscribe', isAuthenticated, unsubscribe);

export default router;
