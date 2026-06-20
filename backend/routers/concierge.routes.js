/**
 * @file concierge.routes.js
 * @description Express router for property services (concierge) management and ordering.
 */

import express from 'express';
import {
  addService,
  orderService,
  getPropertyServices,
  deleteService,
} from '../controllers/Concierge.controller.js';
import {
  isAuthenticated,
  isAuthorized
} from '../middlewares/authMiddleware.js';

const router = express.Router();

// ─── MANAGEMENT & ORDERING ROUTES ────────────────────────────────────────────

/**
 * @route POST /api/concierge/add-service
 * @desc Add a new service to a property (Host only).
 */
router.post('/add-service', isAuthenticated, isAuthorized('host'), addService);

/**
 * @route POST /api/concierge/order-service
 * @desc Order a service for a booking (Guest only).
 */
router.post('/order-service', isAuthenticated, isAuthorized('guest'), orderService);

// ─── PUBLIC ROUTES ───────────────────────────────────────────────────────────

/**
 * @route GET /api/concierge/property/:propertyId
 * @desc Get all available services for a specific property.
 */
router.get('/property/:propertyId', getPropertyServices);

/**
 * @route DELETE /api/concierge/service/:id
 * @desc Delete a concierge service (Host only).
 */
router.delete('/service/:id', isAuthenticated, isAuthorized('host'), deleteService);

export default router;
