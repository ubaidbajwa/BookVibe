/**
 * @file useSocket.js
 * @description Socket.io Connection Hook
 *
 * Manages the shared Socket.io client instance for the entire app.
 * The instance is module-level (singleton) so a single TCP connection is reused
 * across all components that call this hook.
 */

import { useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { io } from "socket.io-client";
import { getStoredAuthToken } from "../utils/authConfig";

// --- Constants ---

// Derive the Socket.io server URL from the same env var as the REST API
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL?.replace("/api/v1", "") ||
  "http://localhost:3000";

// Module-level singleton — shared across all useSocket() callers
let socketInstance = null;

// --- Public Utilities ---

/**
 * @function getSocket
 * @description Returns the current socket instance (may be null before first connection).
 * @returns {Object|null} The current socket instance.
 */
export const getSocket = () => {
  return socketInstance;
};

// --- Hook ---

/**
 * @function useSocket
 * @description Custom hook to manage the Socket.io connection and event listeners.
 * @param {Object} handlers - Map of event-name -> callback.
 * @returns {Object} An object containing the socket instance, emit function, and connection status.
 */
const useSocket = (handlers = {}) => {
  // --- State & Selectors ---
  const { user } = useSelector((state) => {
    return state.auth;
  });

  const userId = user?.user?._id;
  const userRole = user?.user?.role;

  // --- Refs ---
  // Keep the handlers in a ref so they can change on every render without
  // triggering a re-subscription of socket event listeners
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // --- Callbacks ---

  /**
   * @function connect
   * @description Creates a new Socket.io connection (or returns the existing one).
   */
  const connect = useCallback(() => {
    // If the socket is already open, return it as-is
    if (socketInstance?.connected) {
      return socketInstance;
    }

    // `auth` is a function (not a static object) so socket.io re-evaluates it
    // before EVERY (re)connection attempt. The access token is short-lived and
    // is silently refreshed by the REST interceptor; reading it fresh here means
    // a reconnect after a token refresh/expiry re-authenticates with the current
    // token instead of a stale one (which would silently drop the user from their
    // notification rooms until a full page reload).
    socketInstance = io(SOCKET_URL, {
      auth: (cb) => cb({ token: getStoredAuthToken() }),
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    // After (re-)connection, re-join the user's rooms
    socketInstance.on("connect", () => {
      if (!userId) {
        return;
      }

      socketInstance.emit("join:room", `user:${userId}`);

      if (userRole === "host") {
        socketInstance.emit("join:room", `host:${userId}`);
      }

      if (userRole === "admin") {
        socketInstance.emit("join:room", "admin");
      }
    });

    // Suppress connection errors — the socket will retry automatically
    socketInstance.on("connect_error", (_err) => {
      /* Silent fail — reconnection is handled by socket.io's built-in retry */
    });

    socketInstance.on("disconnect", (_reason) => {
      /* Session manager logs persistent disconnects if needed */
    });

    return socketInstance;
  }, [userId, userRole]);

  // --- Effects ---

  /**
   * Main subscription effect.
   * Registers listeners for notifications and named events.
   */
  useEffect(
    () => {
      // Setup:
      // Do nothing while the user is not authenticated
      if (!userId) {
        return;
      }

      const socket = connect();

      // Collect cleanup functions so we can remove listeners on unmount
      const cleanups = [];

      /* ── Generic notification listener ───────────────────────────────── */
      const onNotification = (data) => {
        handlersRef.current.onNotification?.(data);
      };
      socket.on("notification", onNotification);
      cleanups.push(() => {
        return socket.off("notification", onNotification);
      });

      /* ── Named event listeners ────────────────────────────────────────── */
      const events = [
        "booking:new",
        "booking:cancelled",
        "booking:payment",
        "refund:requested",
        "refund:updated",
        "host:verified",
        "complaint:new",
        "complaint:updated",
        "user:blocked",
        "notification:read",
        "payment:info:verified",
        "payment:info:submitted",
        "payout:requested",
        "payout:updated",
      ];

      events.forEach((event) => {
        const handler = (data) => {
          // Convert 'booking:new' -> 'bookingNew' -> 'onBookingNew'
          const camelCase = event.replace(/:([a-z])/g, (_, char) => {
            return char.toUpperCase();
          });
          const handlerKey = `on${camelCase.charAt(0).toUpperCase()}${camelCase.slice(1)}`;

          handlersRef.current[handlerKey]?.(data);

          // Also call the catch-all handler if the caller provided one
          handlersRef.current.onAnyEvent?.(event, data);
        };

        socket.on(event, handler);
        cleanups.push(() => {
          return socket.off(event, handler);
        });
      });

      // Cleanup:
      return () => {
        cleanups.forEach((cleanup) => {
          return cleanup();
        });
      };
    },
    // Dependency Array:
    [
      userId, // Re-subscribe if the authenticated user changes
      connect, // Included for exhaustive-deps
    ]
  );

  /**
   * Disconnect effect.
   * Tears down the socket entirely on logout.
   */
  useEffect(
    () => {
      // Setup:
      if (!userId && socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }

      // Cleanup:
      return () => {};
    },
    // Dependency Array:
    [
      userId, // Watches for logout event
    ]
  );

  /**
   * @function emit
   * @description Sends an event through the socket if connected.
   */
  const emit = useCallback((event, data) => {
    if (socketInstance?.connected) {
      socketInstance.emit(event, data);
    }
  }, []);

  return {
    socket: socketInstance,
    emit,
    isConnected: socketInstance?.connected || false,
  };
};

export default useSocket;
