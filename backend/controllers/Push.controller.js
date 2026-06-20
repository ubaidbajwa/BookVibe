/**
 * @file Push Controller
 * @description Manages Web Push subscriptions (the browser/device endpoints a user
 * has granted permission on) so notifications can be delivered even when the site
 * is closed.
 */

import PushSubscription from '../models/PushSubscriptionModel.js';

/**
 * Returns the VAPID public key the frontend needs to create a push subscription.
 * @route GET /api/v1/push/vapid-public-key
 */
const getVapidPublicKey = (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ success: false, message: 'Push notifications are not configured on this server.' });
  }
  res.json({ success: true, publicKey: process.env.VAPID_PUBLIC_KEY });
};

/**
 * Saves (or refreshes) a push subscription for the authenticated user.
 * Idempotent on `endpoint` — re-subscribing the same browser just updates the keys.
 * @route POST /api/v1/push/subscribe
 */
const subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, message: 'Invalid subscription payload' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        endpoint,
        keys,
        userId: req.user._id,
        userAgent: req.headers['user-agent'] || '',
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Removes a push subscription belonging to the authenticated user (e.g. when they
 * toggle "Browser Push" off, or the browser reports the subscription expired).
 * @route POST /api/v1/push/unsubscribe
 */
const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, message: 'endpoint is required' });
    }

    // Scoped to the requester's own userId — a user can only remove their own subscription.
    await PushSubscription.findOneAndDelete({ endpoint, userId: req.user._id });

    res.json({ success: true, message: 'Unsubscribed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export { getVapidPublicKey, subscribe, unsubscribe };
