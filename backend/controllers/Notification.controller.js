/**
 * @file Notification Controller
 * @description Handles user notifications, including fetching, marking as read, and deleting.
 */

// Section: Imports
import Notification from '../models/NotificationModel.js';

// Section: Notification Operations

/**
 * Retrieves the notifications for the logged-in user.
 * @route GET /api/v1/notifications
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const getNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ recipient: req.user._id }),
    ]);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.json({
      success: true,
      notifications,
      unreadCount,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Marks a single notification as read.
 * @route PATCH /api/v1/notifications/:id/read
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id
      },
      {
        isRead: true
      },
      {
        new: true
      }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Not found'
      });
    }

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Marks all notifications for the logged-in user as read.
 * @route PATCH /api/v1/notifications/read-all
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipient: req.user._id,
        isRead: false
      },
      {
        isRead: true
      }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Deletes a single notification.
 * @route DELETE /api/v1/notifications/:id
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const deleteNotification = async (req, res) => {
  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id
    });

    res.json({
      success: true,
      message: 'Deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Deletes all notifications for the logged-in user.
 * @route DELETE /api/v1/notifications
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const clearAll = async (req, res) => {
  try {
    await Notification.deleteMany({
      recipient: req.user._id
    });

    res.json({
      success: true,
      message: 'All cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Deletes multiple notifications in bulk.
 * @route DELETE /api/v1/notifications/bulk
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const deleteMultipleNotifications = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((id) => {
        return Boolean(id);
      })
      : [];

    if (!ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Notification ids are required'
      });
    }

    await Notification.deleteMany({
      _id: {
        $in: ids
      },
      recipient: req.user._id
    });

    res.json({
      success: true,
      message: 'Selected notifications deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves the count of unread notifications for the logged-in user.
 * @route GET /api/v1/notifications/unread-count
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
  clearAll as clearAllNotifications,
  deleteMultipleNotifications,
  getUnreadCount,
};
