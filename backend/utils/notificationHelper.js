/**
 * @fileoverview Backward-compatible shim for notification services
 * @module utils/notificationHelper
 */

import svc from "../services/notification.service.js";

/* -------------------------------------------------------------------------- */
/*                                Service Shims                               */
/* -------------------------------------------------------------------------- */

/**
 * Notifies a user (Shim)
 * @param {string} recipient - User ID
 * @param {string} event - Socket event
 * @param {Object} payload - Notification data
 */
export const notifyUser = (recipient, event, payload) => svc.notifyUser(recipient, event, payload);

/**
 * Notifies a host (Shim)
 * @param {string} hostId - Host ID
 * @param {string} event - Socket event
 * @param {Object} payload - Notification data
 */
export const notifyHost = (hostId, event, payload) => svc.notifyHost(hostId, event, payload);

/**
 * Notifies admin (Shim)
 * @param {string} event - Socket event
 * @param {Object} payload - Notification data
 * @param {string|null} prefKey - Optional settings.notifications key to gate recipients by
 */
export const notifyAdmin = (event, payload, prefKey) => svc.notifyAdmin(event, payload, prefKey);

/**
 * Notifies multiple users (Shim)
 * @param {Array<string>} ids - List of user IDs
 * @param {string} event - Socket event
 * @param {Object} payload - Notification data
 */
export const notifyUsers = (ids, event, payload) => svc.notifyUsers(ids, event, payload);

/**
 * Broadcasts to all users (Shim)
 * @param {string} event - Socket event
 * @param {Object} payload - Notification data
 */
export const broadcastAll = (event, payload) => svc.broadcastAll(event, payload);

/* -------------------------------------------------------------------------- */
/*                                Legacy Shims                                 */
/* -------------------------------------------------------------------------- */

/**
 * Legacy wrapper for sending a single notification
 */
export const sendNotification = ({
  recipient,
  type,
  title,
  message,
  bookingId = null,
  propertyId = null,
  link = '',
  severity = 'info',
  data = {}
}) => svc.notifyUser(recipient, 'notification', {
  type,
  title,
  message,
  bookingId,
  propertyId,
  link,
  severity,
  data
});

/**
 * Legacy wrapper for sending an admin notification
 */
export const sendAdminNotification = ({
  type = 'system',
  title,
  message,
  bookingId = null,
  propertyId = null,
  link = '',
  severity = 'info',
  data = {}
}) => svc.notifyAdmin('notification', {
  type,
  title,
  message,
  bookingId,
  propertyId,
  link,
  severity,
  data
});

/**
 * Checks if notification should be sent for a user (Shim)
 */
export const shouldSendNotification = (userId, type) => svc.shouldSendNotification(userId, type);
