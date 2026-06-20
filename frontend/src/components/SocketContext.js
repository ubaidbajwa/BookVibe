/**
 * @file SocketContext.js
 * @description Shared notification context + hook, split out from SocketProvider.jsx
 * so the provider file only exports a component (keeps React Fast Refresh working).
 * Consumers import `useNotifications` from here; the provider supplies the value.
 */

import { createContext, useContext } from "react";

export const SocketContext = createContext({
  notifications: [],
  unreadCount: 0,
  markRead: () => {},
  markAllRead: () => {},
  clearAll: () => {},
  deleteNotification: () => {},
  deleteNotifications: () => {},
  isConnected: false,
  socket: null,
});

/**
 * Access the live notification state + actions provided by SocketProvider.
 * @returns {Object} notifications, unreadCount, markRead, markAllRead, clearAll,
 *   deleteNotification, deleteNotifications, isConnected, socket.
 */
export const useNotifications = () => useContext(SocketContext);
