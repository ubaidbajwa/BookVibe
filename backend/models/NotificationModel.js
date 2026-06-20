/**
 * @file NotificationModel.js
 * @description Mongoose model for system notifications sent to users and hosts.
 */

import mongoose from "mongoose";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Notification
 * @property {mongoose.Schema.Types.ObjectId} recipient - User who receives the notification.
 * @property {string} type - Category of notification.
 * @property {string} severity - Visual severity level.
 * @property {string} title - Brief headline of the notification.
 * @property {string} message - Detailed content of the notification.
 * @property {string} link - Optional URL for redirection.
 * @property {boolean} isRead - Flag if the notification has been read.
 * @property {mongoose.Schema.Types.ObjectId} bookingId - Associated booking if applicable.
 * @property {mongoose.Schema.Types.ObjectId} propertyId - Associated property if applicable.
 * @property {Object} data - Additional metadata for the notification.
 */
const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "UserAndHost",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["booking", "payment", "refund", "property", "complaint", "verification", "system", "emergency", "food"],
    required: true,
  },
  severity: {
    type: String,
    enum: ["info", "warning", "danger", "success", "neutral"],
    default: "info",
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  link: {
    type: String,
    default: "",
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BookingModel",
    default: null,
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Property",
    default: null,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true
});

// ─── INDEXES ─────────────────────────────────────────────────────────────────

notificationSchema.index({
  recipient: 1,
  isRead: 1,
  createdAt: -1
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * Notification model.
 */
const NotificationModel = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

export default NotificationModel;
