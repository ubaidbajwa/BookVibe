import {
  useEffect,
  useState,
  useCallback,
} from "react";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import useSocket from "../hooks/useSocket";
import { getAuthConfig } from "../utils/authConfig";
import { setUser } from "../redux/slices/authSlice";
import { SocketContext } from "./SocketContext";

const SocketProvider = ({ children }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const userId = user?.user?._id;
  const isBrowserPushEnabled = user?.user?.settings?.notifications?.browserPush !== false;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleNotification = useCallback(
    (data) => {
      if (!data?.title) return;

      // When admin approves/rejects KYC, sync session so the under-review gate
      // lifts immediately without requiring logout+login.
      if (data.type === "verification") {
        if (data.severity === "success") dispatch(setUser({ isVerified: "verified" }));
        else if (data.severity === "danger") dispatch(setUser({ isVerified: "rejected" }));
      }

      setNotifications((prev) => {
        if (prev.some((n) => n.id === data.id)) return prev;
        return [{ ...data, isRead: false, receivedAt: new Date().toISOString() }, ...prev].slice(0, 100);
      });
      setUnreadCount((prev) => prev + 1);


      if (isBrowserPushEnabled && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(data.title, { body: data.message, icon: "/favicon.ico", tag: data.id });
        } catch {
          // ignore
        }
      }
    },
    [isBrowserPushEnabled, dispatch]
  );

  // Syncs "marked as read" across this user's other open tabs via the server
  // re-broadcasting notification:read to the user's room.
  const handleNotificationRead = useCallback((data) => {
    if (!data?.id) return;
    setNotifications((prev) => {
      const target = prev.find((n) => (n.id || n._id) === data.id);
      if (!target || target.isRead) return prev;
      setUnreadCount((c) => Math.max(0, c - 1));
      return prev.map((n) => ((n.id || n._id) === data.id ? { ...n, isRead: true } : n));
    });
  }, []);

  const { socket, emit, isConnected } = useSocket({
    onNotification: handleNotification,
    onNotificationRead: handleNotificationRead,
  });

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const fetchInitialNotifications = async () => {
      try {
        const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
        const response = await axios.get(`${BASE}/notifications?limit=100`, getAuthConfig());
        if (response.data.success) {
          setNotifications(
            response.data.notifications.map((n) => ({
              id: n._id,
              type: n.type,
              severity: n.severity,
              title: n.title,
              message: n.message,
              link: n.link,
              isRead: n.isRead,
              receivedAt: n.createdAt,
              data: n.data,
            }))
          );
          setUnreadCount(response.data.unreadCount || 0);
        }
      } catch {
        // silent
      }
    };

    fetchInitialNotifications();
  }, [userId]);

  const markRead = useCallback(
    async (id) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      emit("notification:read", { id });
      try {
        const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
        await axios.patch(`${BASE}/notifications/${id}/read`, {}, getAuthConfig());
      } catch {
        // optimistic — ignore
      }
    },
    [emit]
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
      await axios.patch(`${BASE}/notifications/read-all`, {}, getAuthConfig());
    } catch {
      // optimistic — ignore
    }
  }, []);

  const clearAll = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    try {
      const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
      await axios.delete(`${BASE}/notifications/clear-all`, getAuthConfig());
    } catch {
      // optimistic — ignore
    }
  }, []);

  const deleteNotification = useCallback(async (id) => {
    setNotifications((prev) => {
      const target = prev.find((n) => (n.id || n._id) === id);
      if (target && !target.isRead) setUnreadCount((c) => Math.max(0, c - 1));
      return prev.filter((n) => (n.id || n._id) !== id);
    });
    try {
      const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
      await axios.delete(`${BASE}/notifications/${id}`, getAuthConfig());
    } catch {
      // optimistic — ignore
    }
  }, []);

  const deleteNotifications = useCallback(async (ids) => {
    const idSet = new Set(ids);
    setNotifications((prev) => {
      const removed = prev.filter((n) => idSet.has(n.id || n._id));
      setUnreadCount((c) => Math.max(0, c - removed.filter((n) => !n.isRead).length));
      return prev.filter((n) => !idSet.has(n.id || n._id));
    });
    try {
      const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
      await axios.delete(`${BASE}/notifications/bulk`, { ...getAuthConfig(), data: { ids } });
    } catch {
      // optimistic — ignore
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{ notifications, unreadCount, markRead, markAllRead, clearAll, deleteNotification, deleteNotifications, isConnected, socket }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
