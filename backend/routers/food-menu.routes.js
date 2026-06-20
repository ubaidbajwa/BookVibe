/**
 * @file food-menu.routes.js
 * @description Express router for managing property food menus and processing food orders.
 */

import express from 'express';
import {
  addFoodItem,
  updateFoodItem,
  deleteFoodItem,
  getPropertyFoodMenu
} from '../controllers/FoodMenu.controller.js';
import {
  createFoodOrder,
  updateFoodOrderStatus,
  getGuestFoodOrders,
  getHostFoodOrders
} from '../controllers/FoodOrder.controller.js';
import {
  isAuthenticated,
  isAuthorized
} from '../middlewares/authMiddleware.js';

const router = express.Router();

// ─── MENU MANAGEMENT ROUTES ──────────────────────────────────────────────────

/**
 * @route POST /api/food/add
 * @desc Add a new item to the property food menu (Host).
 */
router.post('/add', isAuthenticated, isAuthorized('host'), addFoodItem);

/**
 * @route PUT /api/food/:id
 * @desc Update an existing food menu item (Host).
 */
router.put('/:id', isAuthenticated, isAuthorized('host'), updateFoodItem);

/**
 * @route DELETE /api/food/:id
 * @desc Delete a food menu item (Host).
 */
router.delete('/:id', isAuthenticated, isAuthorized('host'), deleteFoodItem);

/**
 * @route GET /api/food/property/:propertyId
 * @desc Get the full food menu for a specific property.
 */
router.get('/property/:propertyId', getPropertyFoodMenu);

// ─── ORDER MANAGEMENT ROUTES ─────────────────────────────────────────────────

/**
 * @route POST /api/food/orders
 * @desc Create a new food order.
 */
router.post('/orders', isAuthenticated, createFoodOrder);

/**
 * @route PUT /api/food/orders/:id/status
 * @desc Update the status of a food order (Host).
 */
router.put('/orders/:id/status', isAuthenticated, isAuthorized('host'), updateFoodOrderStatus);

/**
 * @route GET /api/food/orders/guest
 * @desc Get food orders for the authenticated guest.
 */
router.get('/orders/guest', isAuthenticated, getGuestFoodOrders);

/**
 * @route GET /api/food/orders/host
 * @desc Get food orders for properties owned by the host.
 */
router.get('/orders/host', isAuthenticated, isAuthorized('host'), getHostFoodOrders);

export default router;
