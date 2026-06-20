/**
 * @file webPush.js
 * @description Web Push subscribe/unsubscribe helpers. This is what lets a
 * notification reach the user even when the site is closed — a Service Worker
 * registered once keeps running in the background and receives push events
 * straight from the browser vendor's push service.
 */

import axios from "axios";
import { getAuthConfig } from "./authConfig";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

/**
 * @function urlBase64ToUint8Array
 * @description Converts the VAPID public key (base64url string) into the
 * Uint8Array format the Push API's applicationServerKey expects.
 * @param {string} base64String
 * @returns {Uint8Array}
 */
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

/**
 * @function isPushSupported
 * @returns {boolean} Whether this browser can support Web Push at all.
 */
export const isPushSupported = () => {
  return "serviceWorker" in navigator && "PushManager" in window;
};

/**
 * @function subscribeToPush
 * @description Registers the service worker (if not already), requests
 * notification permission, creates a push subscription, and saves it on
 * the backend against the logged-in user.
 * @returns {Promise<boolean>} True on success.
 */
export const subscribeToPush = async () => {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const { data } = await axios.get(`${BASE}/push/vapid-public-key`, getAuthConfig());
    if (!data?.success) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    const sub = subscription.toJSON();
    await axios.post(
      `${BASE}/push/subscribe`,
      { endpoint: sub.endpoint, keys: sub.keys },
      getAuthConfig()
    );

    return true;
  } catch (error) {
    console.error("[webPush] subscribe failed:", error.message);
    return false;
  }
};

/**
 * @function unsubscribeFromPush
 * @description Cancels the browser's push subscription and removes it from
 * the backend so this device stops receiving push notifications.
 * @returns {Promise<void>}
 */
export const unsubscribeFromPush = async () => {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await axios.post(`${BASE}/push/unsubscribe`, { endpoint }, getAuthConfig());
  } catch (error) {
    console.error("[webPush] unsubscribe failed:", error.message);
  }
};
