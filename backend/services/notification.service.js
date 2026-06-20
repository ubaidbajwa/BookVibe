/**
 * @fileoverview Notification service for managing system, email, and SMS alerts
 * @module services/notification
 */

import NotificationModel from "../models/NotificationModel.js";
import UserAndHost from "../models/UserAndHostModel.js";
import PushSubscription from "../models/PushSubscriptionModel.js";
import { getIO } from "../config/socket.js";
import twilio from "twilio";
import webpush from "web-push";

// MED-1 fix: 'emergency' and 'food' were absent — both normalized to 'system',
// breaking any frontend filter that reads notification type.
const ALLOWED_TYPES = new Set(["booking", "payment", "refund", "property", "complaint", "verification", "system", "emergency", "food"]);
const ALLOWED_SEVERITIES = new Set(["info", "warning", "danger", "success", "neutral"]);

const twilioClient = (process.env.TWILIO_ACCOUNT_SID?.startsWith("AC") || process.env.TWILIO_SID?.startsWith("AC")) && process.env.TWILIO_AUTH_TOKEN
  ? twilio((process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID), process.env.TWILIO_AUTH_TOKEN)
  : null;

// Web Push (real OS/device notifications, delivered even when the site is closed)
const vapidConfigured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Service class for notification-related operations
 */
class NotificationService {
  /* -------------------------------------------------------------------------- */
  /*                               Normalization                                */
  /* -------------------------------------------------------------------------- */

  /**
   * Normalizes the notification type
   * @param {string} type - The notification type
   * @returns {string} Normalized type
   */
  normalizeType(type) {
    return ALLOWED_TYPES.has(type) ? type : "system";
  }

  /**
   * Normalizes the notification severity
   * @param {string} severity - The notification severity
   * @returns {string} Normalized severity
   */
  normalizeSeverity(severity) {
    return ALLOWED_SEVERITIES.has(severity) ? severity : "info";
  }

  /* -------------------------------------------------------------------------- */
  /*                                  SMS Logic                                 */
  /* -------------------------------------------------------------------------- */

  /**
   * Sends a critical SMS alert via Twilio
   * @param {string} to - The recipient's phone number
   * @param {string} message - The message content
   * @returns {Promise<void>}
   */
  async sendCriticalSMS(to, message) {
    if (!twilioClient) return;
    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to,
      });
    } catch (error) {
      console.error(`[Twilio] SMS failed to ${to}:`, error.message);
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               Settings Logic                               */
  /* -------------------------------------------------------------------------- */

  /**
   * Checks if a user has enabled notifications for a specific type
   * @param {string} userId - The ID of the user
   * @param {string} notificationType - The type of notification
   * @returns {Promise<boolean>} True if notification should be sent
   */
  async shouldSendNotification(userId, notificationType) {
    try {
      const user = await UserAndHost.findById(userId).select("settings").lean();
      if (!user?.settings?.notifications) return true;

      const n = user.settings.notifications;
      const map = {
        booking: n.emailBookings,
        payment: n.emailPayments,
        refund: n.emailPayments,
        property: n.emailBookings,
        complaint: true,
        verification: true,
        system: true,
        emergency: true,
        food: true,
      };

      return map[notificationType] !== false;
    } catch {
      return true;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               Internal Helpers                             */
  /* -------------------------------------------------------------------------- */

  /**
   * Builds a notification document for database storage
   * @private
   */
  buildDocument({
    recipient,
    type,
    severity,
    title,
    message,
    link = "",
    bookingId = null,
    propertyId = null,
    data = {},
  }) {
    return {
      recipient,
      type: this.normalizeType(type),
      severity: this.normalizeSeverity(severity),
      title,
      message,
      link,
      bookingId,
      propertyId,
      data,
    };
  }

  /**
   * Emits a notification via Socket.IO to a specific room
   * @private
   */
  emitToRoom(room, event, notification) {
    try {
      const io = getIO();
      io.to(room).emit("notification", notification);
      if (event) io.to(room).emit(event, notification);
    } catch {
      // Silently skip if socket is not available
    }
  }

  /**
   * Emits a raw socket event without creating a database record
   * @param {string} room - The room to emit to
   * @param {string} event - The event name
   * @param {Object} data - The event data
   */
  emitRaw(room, event, data = {}) {
    try {
      const io = getIO();
      io.to(room).emit(event, data);
    } catch {
      // Silently skip if socket is not available
    }
  }

  /**
   * Delivers a real Web Push notification to every browser/device the user has
   * subscribed from — this is the only delivery path that still reaches the user
   * when the site itself is closed (socket emits only reach an open, connected tab).
   * Gated on the user's own `settings.notifications.browserPush` preference, which
   * doubles as "send me push notifications" now that real push exists.
   * Fire-and-forget: never awaited by callers, never throws.
   * @private
   */
  async sendWebPush(userId, notification) {
    if (!vapidConfigured || !userId) return;
    try {
      const user = await UserAndHost.findById(userId).select("settings.notifications.browserPush").lean();
      if (user?.settings?.notifications?.browserPush === false) return;

      const subscriptions = await PushSubscription.find({ userId }).lean();
      if (!subscriptions.length) return;

      const payload = JSON.stringify({
        title: notification.title,
        message: notification.message,
        link: notification.link,
        id: notification._id.toString(),
        type: notification.type,
      });

      await Promise.all(subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload
          );
        } catch (err) {
          // 404/410 = the browser revoked or expired this subscription — stop trying it.
          if (err.statusCode === 404 || err.statusCode === 410) {
            await PushSubscription.findByIdAndDelete(sub._id).catch(() => {});
          }
        }
      }));
    } catch (error) {
      console.error("[NotificationService] sendWebPush error:", error.message);
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               Public API                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * Notifies a regular user
   * @param {string} recipient - The user ID
   * @param {string} event - The socket event name
   * @param {Object} payload - The notification payload
   * @returns {Promise<Object|null>} The created notification or null
   */
  async notifyUser(recipient, event, payload = {}) {
    try {
      const type = this.normalizeType(payload.type);

      // In-app notifications (DB record + socket) are always delivered — they are
      // the core bell/feed and must not be suppressed by the email-channel toggles.
      // Per-channel opt-outs are applied at their own channel: web push respects
      // `browserPush` inside sendWebPush(); email/SMS are gated where they're sent.
      const notification = await NotificationModel.create(this.buildDocument({
        recipient,
        type,
        severity: payload.severity,
        title: payload.title,
        message: payload.message,
        link: payload.link,
        bookingId: payload.bookingId,
        propertyId: payload.propertyId,
        data: payload.data,
      }));

      if (payload.critical) {
        const user = await UserAndHost.findById(recipient).select("phone").lean();
        if (user?.phone) {
          // Non-blocking SMS
          this.sendCriticalSMS(user.phone, `[BookVibe CRITICAL] ${payload.title}: ${payload.message}`);
        }
      }

      const socketPayload = this.formatSocketPayload(notification);
      this.emitToRoom(`user:${recipient.toString()}`, event, socketPayload);
      this.sendWebPush(recipient, notification);
      return notification;
    } catch (error) {
      console.error("[NotificationService] notifyUser error:", error.message);
      return null;
    }
  }

  /**
   * Notifies a host
   * @param {string} hostId - The host ID
   * @param {string} event - The socket event name
   * @param {Object} payload - The notification payload
   * @returns {Promise<Object|null>} The created notification or null
   */
  async notifyHost(hostId, event, payload = {}) {
    try {
      const type = this.normalizeType(payload.type);

      // In-app notifications are always delivered (see notifyUser). Channel opt-outs
      // (browserPush for web push, etc.) are applied at each channel, not here.
      const notification = await NotificationModel.create(this.buildDocument({
        recipient: hostId,
        type,
        severity: payload.severity,
        title: payload.title,
        message: payload.message,
        link: payload.link,
        bookingId: payload.bookingId,
        propertyId: payload.propertyId,
        data: payload.data,
      }));

      if (payload.critical) {
        const host = await UserAndHost.findById(hostId).select("phone").lean();
        if (host?.phone) {
          // Non-blocking SMS
          this.sendCriticalSMS(host.phone, `[BookVibe CRITICAL] ${payload.title}: ${payload.message}`);
        }
      }

      const socketPayload = this.formatSocketPayload(notification);
      this.emitToRoom(`host:${hostId.toString()}`, event, socketPayload);
      this.sendWebPush(hostId, notification);
      return notification;
    } catch (error) {
      console.error("[NotificationService] notifyHost error:", error.message);
      return null;
    }
  }

  /**
   * Notifies all active admins, optionally gated by a per-admin alert preference.
   * @param {string} event - The socket event name
   * @param {Object} payload - The notification payload
   * @param {string|null} prefKey - Key under settings.notifications that must not be
   *   explicitly false for an admin to receive this (e.g. 'notifyNewUsers'). When
   *   omitted, every admin is notified (existing behavior, used for alerts that
   *   have no dedicated preference yet, e.g. payout/KYC requests).
   * @returns {Promise<Array>} List of created notification records
   */
  async notifyAdmin(event, payload = {}, prefKey = null) {
    try {
      const admins = await UserAndHost.find({ role: "admin", isDeleted: false })
        .select("_id settings.notifications")
        .lean();
      if (!admins.length) return [];

      const targetAdmins = prefKey
        ? admins.filter((a) => a.settings?.notifications?.[prefKey] !== false)
        : admins;
      if (!targetAdmins.length) return [];

      const docs = await NotificationModel.insertMany(
        targetAdmins.map((admin) => this.buildDocument({
          recipient: admin._id,
          type: payload.type || "system",
          severity: payload.severity,
          title: payload.title,
          message: payload.message,
          link: payload.link,
          bookingId: payload.bookingId,
          propertyId: payload.propertyId,
          data: payload.data,
        }))
      );

      // Emit to each targeted admin's own room rather than the shared 'admin' room —
      // a broadcast to the shared room would reach admins who opted out via prefKey.
      docs.forEach((doc) => {
        const socketPayload = this.formatSocketPayload(doc);
        this.emitToRoom(`user:${doc.recipient.toString()}`, event, socketPayload);
        this.sendWebPush(doc.recipient, doc);
      });

      return docs;
    } catch (error) {
      console.error("[NotificationService] notifyAdmin error:", error.message);
      return [];
    }
  }

  /**
   * Formats a notification document for socket emission
   * @param {Object} notification - The database document
   * @returns {Object} Formatted payload
   */
  formatSocketPayload(notification) {
    return {
      id: notification._id.toString(),
      _id: notification._id,
      type: notification.type,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      isRead: notification.isRead,
      bookingId: notification.bookingId,
      propertyId: notification.propertyId,
      data: notification.data,
      createdAt: notification.createdAt,
    };
  }

  /**
   * Notifies multiple users at once
   * @param {Array<string>} userIds - List of user IDs
   * @param {string} event - The socket event name
   * @param {Object} payload - The notification payload
   */
  async notifyUsers(userIds = [], event, payload = {}) {
    return Promise.all(userIds.map(id => this.notifyUser(id, event, payload)));
  }

  /**
   * Broadcasts an event to all connected clients
   * @param {string} event - The socket event name
   * @param {Object} payload - The broadcast payload
   */
  async broadcastAll(event, payload = {}) {
    try {
      const io = getIO();
      io.emit(event, { ...payload, createdAt: new Date().toISOString() });
    } catch (error) {
      console.error("[NotificationService] broadcastAll error:", error.message);
    }
  }
}

export default new NotificationService();
