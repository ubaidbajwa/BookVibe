/**
 * AdminNavbar.jsx
 *
 * The top navigation bar for the Admin Panel. It includes a mobile sidebar toggle,
 * a real-time notification system via SocketProvider, and an administrative profile dropdown.
 * The component manages dropdown visibility and handles administrative sign-out logic.
 *
 * @module AdminNavbar
 */

import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logout, logoutUser, reset } from '../../redux/slices/authSlice';
import { useNotifications } from '../../components/SocketContext';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, LogOut, User, Settings, Menu, Shield, Bell,
  CalendarClock, Wallet, ShieldAlert, Info, CheckCircle, ChevronRight,
} from 'lucide-react';

/* ── CONSTANTS & MAPPINGS ── */

const P = import.meta.env.VITE_ADMIN_PATH || 'ctrl-bv5ap6';

/**
 * Maps notification type strings to the appropriate Lucide icon component.
 */
const iconMap = {
  booking: CalendarClock,
  payment: Wallet,
  refund: ShieldAlert,
  property: Info,
  complaint: ShieldAlert,
  verification: CheckCircle,
  system: Bell,
};

/* ── UTILITY FUNCTIONS ── */

/**
 * Formats a date into a relative human-readable "time ago" string.
 *
 * @param {string|Date} date - The date to format.
 * @returns {string} Relative time string.
 */
const timeAgo = (date) => {
  if (!date) {
    return '';
  }

  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (s < 60) {
    return 'Just now';
  }
  if (s < 3600) {
    return `${Math.floor(s / 60)}m ago`;
  }
  if (s < 86400) {
    return `${Math.floor(s / 3600)}h ago`;
  }
  return `${Math.floor(s / 86400)}d ago`;
};

/* ── MAIN COMPONENT ── */

/**
 * AdminNavbar Component.
 *
 * @param {Object} props - Component properties.
 * @param {Function} props.setOpenSidebar - State setter for mobile sidebar visibility.
 * @returns {JSX.Element}
 */
const AdminNavbar = ({ setOpenSidebar }) => {
  const dispatch = useDispatch();
  const nav = useNavigate();

  /* ── DATA SOURCE ── */

  // Pull the current user object from the auth Redux slice
  const u = useSelector((s) => {
    return s.auth.user?.user;
  });
  const avatar = u?.profileImage?.url || u?.profileImage || '';

  // Real-time notifications sourced from the shared SocketProvider context
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  /* ── STATE MANAGEMENT ── */

  /** @type {[boolean, Function]} Whether the profile dropdown is open */
  const [dd, setDd] = useState(false);

  /** @type {[boolean, Function]} Whether the notification dropdown is open */
  const [notif, setNotif] = useState(false);

  // Ref for the profile dropdown container — used to detect outside clicks
  const ref = useRef(null);

  // Ref for the notification dropdown container — used to detect outside clicks
  const nRef = useRef(null);

  /* ── EFFECTS ── */

  /**
   * Effect: Close both dropdowns when the user clicks outside either of them.
   */
  useEffect(
    () => {
      /**
       * Handler that checks if the click fell outside both dropdown containers.
       * @param {Event} e - Mousedown event.
       */
      const handleOutsideClick = (e) => {
        if (ref.current && !ref.current.contains(e.target)) {
          setDd(false);
        }
        if (nRef.current && !nRef.current.contains(e.target)) {
          setNotif(false);
        }
      };

      document.addEventListener('mousedown', handleOutsideClick);

      // Cleanup: remove the listener when the component unmounts
      return () => {
        return document.removeEventListener('mousedown', handleOutsideClick);
      };
    },
    // Dependencies: Runs once on mount
    []
  );

  /* ── EVENT HANDLERS ── */

  /**
   * Clear the admin gate session token, dispatch logout actions, and go to home.
   */
  const handleLogout = () => {
    sessionStorage.removeItem('bv_admin_gate');
    dispatch(logoutUser());
    dispatch(logout());
    dispatch(reset());
    nav('/');
  };

  /**
   * Handle clicking a notification: mark it read, close the dropdown, navigate if possible.
   *
   * @param {Object} n - Notification object.
   */
  const openNotif = (n) => {
    if (!n.isRead) {
      markRead(n.id || n._id);
    }
    setNotif(false);

    // Resolve booking ID from top-level field or nested data object
    const bookingId = n.bookingId || n.data?.bookingId;

    if (bookingId) {
      nav(`/${P}/bookings/${bookingId}`);
      return;
    }

    // Handle legacy link format pointing to host booking routes
    if (n.link?.startsWith('/host/bookings/')) {
      const id = n.link.split('/').pop();
      nav(`/${P}/bookings/${id}`);
      return;
    }

    if (n.link) {
      nav(n.link);
    }
  };

  /* ── DERIVED DATA ── */

  // Only show the 5 most recent notifications in the dropdown preview
  const preview = notifications.slice(0, 5);

  /* ── RENDER ── */

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-[var(--bv-bg-raised)]/80 backdrop-blur-xl border-b border-[var(--bv-border)] px-4 sm:px-6 h-16">
      {/* Left side: mobile hamburger + desktop panel label */}
      <div className="flex items-center gap-4">
        <button
          className="text-[var(--bv-text-muted)] hover:text-[var(--bv-text)] lg:hidden transition"
          onClick={() => {
            return setOpenSidebar((prev) => {
              return !prev;
            });
          }}
        >
          <Menu size={22} />
        </button>
        <div className="hidden lg:flex items-center gap-2">
          <Shield size={16} className="text-[var(--bv-danger)]" />
          <p className="text-base font-semibold text-[var(--bv-text)]">
            Admin <span className="text-[var(--bv-gold)]">Panel</span>
          </p>
        </div>
      </div>

      {/* Right side: notification bell + profile dropdown */}
      <div className="flex items-center gap-2">
        {/* Notification bell with unread count badge */}
        <div className="relative" ref={nRef}>
          <button
            onClick={() => {
              const opening = !notif;
              setNotif(opening);
              if (opening && unreadCount > 0) markAllRead();
            }}
            className="relative p-2 text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] hover:bg-[var(--bv-surface)] rounded-xl transition"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[var(--bv-danger)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown panel */}
          {notif && (
            <div className="absolute right-0 mt-2 w-[360px] max-w-[92vw] bg-[var(--bv-card)] rounded-2xl shadow-[var(--bv-shadow-lg)] border border-[var(--bv-border)] z-50 overflow-hidden bv-animate-in">
              {/* Dropdown header with mark-all-read button */}
              <div className="px-5 py-4 border-b border-[var(--bv-divider)] bg-[var(--bv-gold-glow)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--bv-text)]">
                      Admin Notifications
                    </p>
                    <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                      {unreadCount} unread
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      return markAllRead();
                    }}
                    disabled={unreadCount === 0}
                    className="text-xs font-semibold text-[var(--bv-gold)] disabled:opacity-50"
                  >
                    Mark all read
                  </button>
                </div>
              </div>

              {/* Notification items list */}
              <div className="max-h-[380px] overflow-y-auto">
                {preview.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <Bell size={28} className="mx-auto text-[var(--bv-text-dim)] mb-3 opacity-30" />
                    <p className="text-sm text-[var(--bv-text-muted)]">No notifications yet</p>
                  </div>
                ) : (
                  preview.map((n) => {
                    const Icon = iconMap[n.type] || Bell;
                    const isUnread = !n.isRead;

                    return (
                      <button
                        key={n.id || n._id}
                        onClick={() => {
                          return openNotif(n);
                        }}
                        className={`w-full text-left px-5 py-4 border-b border-[var(--bv-divider)] hover:bg-[var(--bv-surface)] transition ${
                          isUnread ? 'bg-[var(--bv-gold)]/[0.03]' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] text-[var(--bv-gold)] flex items-center justify-center flex-shrink-0">
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-[var(--bv-text)] truncate">
                                {n.title}
                              </p>
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-[var(--bv-gold)] flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-[var(--bv-text-dim)] mt-1 line-clamp-2">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-[var(--bv-text-dim)] mt-1.5">
                              {timeAgo(n.receivedAt || n.createdAt)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* "View all" footer — always visible when there are any notifications */}
              {notifications.length > 0 && (
                <div className="px-5 py-3 border-t border-[var(--bv-divider)]">
                  <button
                    onClick={() => {
                      setNotif(false);
                      nav(`/${P}/notifications`);
                    }}
                    className="w-full text-center text-xs font-semibold text-[var(--bv-gold)] flex items-center justify-center gap-1"
                  >
                    View all notifications <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => {
              return setDd((prev) => {
                return !prev;
              });
            }}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-[var(--bv-surface)] transition"
          >
            {avatar ? (
              <img
                src={avatar}
                alt={u?.username || 'Admin'}
                className="w-9 h-9 rounded-full object-cover border border-[var(--bv-border)]"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--bv-danger)] to-red-600 flex items-center justify-center text-white font-bold text-sm">
                {u?.username?.charAt(0)?.toUpperCase() || 'A'}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-[var(--bv-text)] leading-none">
                {u?.username || 'Admin'}
              </p>
              <p className="text-[10px] text-[var(--bv-danger)] font-bold uppercase mt-0.5">
                Administrator
              </p>
            </div>
            <ChevronDown
              size={13}
              className={`text-[var(--bv-text-dim)] transition-transform ${dd ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Profile dropdown menu */}
          {dd && (
            <div className="absolute right-0 mt-2 w-52 bg-[var(--bv-card)] rounded-xl shadow-[var(--bv-shadow-lg)] border border-[var(--bv-border)] z-50 overflow-hidden bv-animate-in">
              <div className="px-4 py-3 border-b border-[var(--bv-divider)]">
                <p className="text-sm font-bold text-[var(--bv-text)] truncate">
                  {u?.username}
                </p>
                <p className="text-xs text-[var(--bv-text-dim)] truncate mt-0.5">
                  {u?.email}
                </p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    nav(`/${P}/profile`);
                    setDd(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] transition"
                >
                  <User size={14} /> Profile
                </button>
                <button
                  onClick={() => {
                    nav(`/${P}/settings`);
                    setDd(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] transition"
                >
                  <Settings size={14} /> Settings
                </button>
              </div>

              <div className="border-t border-[var(--bv-divider)] py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--bv-danger)] hover:bg-red-500/10 transition"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AdminNavbar;
