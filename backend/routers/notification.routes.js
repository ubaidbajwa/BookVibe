/**
 * @file notification.routes.js
 * @description Express router for managing user notifications.
 */

import express from 'express';
import {
  isAuthenticated
} from '../middlewares/authMiddleware.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  deleteMultipleNotifications,
  getUnreadCount,
} from '../controllers/Notification.controller.js';

const router = express.Router();

// ─── NOTIFICATION ROUTES ─────────────────────────────────────────────────────

/**
 * @route GET /api/notifications
 * @desc Get all notifications for the authenticated user.
 */
router.get('/', isAuthenticated, getNotifications);

/**
 * @route GET /api/notifications/unread-count
 * @desc Get the count of unread notifications.
 */
router.get('/unread-count', isAuthenticated, getUnreadCount);

/**
 * @route PATCH /api/notifications/read-all
 * @desc Mark all notifications as read.
 */
router.patch('/read-all', isAuthenticated, markAllAsRead);

/**
 * @route PATCH /api/notifications/:id/read
 * @desc Mark a specific notification as read.
 */
router.patch('/:id/read', isAuthenticated, markAsRead);

/**
 * @route DELETE /api/notifications/clear-all
 * @desc Delete all notifications for the user.
 */
router.delete('/clear-all', isAuthenticated, clearAllNotifications);

/**
 * @route DELETE /api/notifications/bulk
 * @desc Delete multiple selected notifications.
 */
router.delete('/bulk', isAuthenticated, deleteMultipleNotifications);

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete a specific notification.
 */
router.delete('/:id', isAuthenticated, deleteNotification);

export default router;
