/**
 * HostNavbar.jsx
 *
 * Sticky top navigation bar for the host panel.
 * Contains:
 *   - A hamburger button (mobile) that toggles the sidebar
 *   - A welcome greeting (desktop)
 *   - A notification bell with a live unread badge and dropdown preview
 *   - A profile dropdown with links to Profile/Settings and a Sign Out button
 *
 * Notifications are sourced from the SocketProvider context so they
 * update in real-time without polling Redux.
 * Click-outside logic closes dropdowns when the user clicks elsewhere.
 *
 * @module HostNavbar
 */

import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logout, logoutUser, reset } from '../../redux/slices/authSlice';
import { useNotifications } from '../../components/SocketContext';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  LogOut,
  User,
  Settings,
  CalendarClock,
  Wallet,
  ShieldAlert,
  Info,
  ChevronRight,
  Menu,
  CheckCircle,
} from 'lucide-react';

/** Maps notification type strings to lucide icon components. */
const iconMap = {
  booking: CalendarClock,
  payment: Wallet,
  refund: ShieldAlert,
  property: Info,
  complaint: ShieldAlert,
  verification: CheckCircle,
  system: Bell,
};

/**
 * Returns a human-readable relative time string for the given ISO date.
 * e.g. "Just now", "3m ago", "2h ago", "5d ago"
 *
 * @param {string} date - ISO date string
 * @returns {string} Human-readable time
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

// ─── MAIN COMPONENT ───

/**
 * HostNavbar Component
 * Top navigation component for the host panel.
 *
 * @param {Object} props - Component properties
 * @param {Function} props.setOpenSidebar - Function to toggle the mobile sidebar
 * @returns {JSX.Element}
 */
const HostNavbar = ({ setOpenSidebar }) => {
  // ─── HOOKS ───

  /** @type {Function} Redux dispatch hook */
  const dispatch = useDispatch();

  /** @type {Function} React Router navigation hook */
  const nav = useNavigate();

  /** @type {Object} Auth state from Redux store */
  const { user } = useSelector((s) => {
    return s.auth;
  });

  /** @type {Object} User data shorthand */
  const u = user?.user;

  /** @type {Object} Real-time notifications from SocketProvider */
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  // ─── STATE ───

  /** @type {[boolean, Function]} Whether the profile dropdown is open */
  const [dd, setDd] = useState(false);

  /** @type {[boolean, Function]} Whether the notification dropdown is open */
  const [notif, setNotif] = useState(false);

  // ─── REFS ───

  /** @type {Object} Ref used to detect clicks outside the profile dropdown */
  const ddRef = useRef(null);

  /** @type {Object} Ref used to detect clicks outside the notification dropdown */
  const nRef = useRef(null);

  // ─── SIDE EFFECTS ───

  /**
   * Close dropdowns when the user clicks anywhere outside of them.
   * Attaches a mousedown listener to the document and removes it on cleanup.
   */
  useEffect(
    () => {
      // Setup: Click outside listener
      const handleClickOutside = (e) => {
        if (ddRef.current && !ddRef.current.contains(e.target)) {
          setDd(false);
        }
        if (nRef.current && !nRef.current.contains(e.target)) {
          setNotif(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      // Cleanup: Remove listener
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    },
    [
      // Dependencies: None
    ]
  );

  // ─── LOGIC ───

  // Show only the 5 most recent notifications in the preview dropdown
  const preview = notifications.slice(0, 5);

  // ─── HANDLERS ───

  /** Log out and redirect to home. */
  const handleLogout = () => {
    dispatch(logoutUser());
    dispatch(logout());
    dispatch(reset());
    nav('/');
  };

  /**
   * Open a notification: mark it as read if unread, close the dropdown,
   * then navigate to its linked route if one exists.
   * @param {Object} n - Notification object
   */
  const openNotif = (n) => {
    if (!n.isRead) {
      markRead(n.id || n._id);
    }
    setNotif(false);
    if (n.link) {
      nav(n.link);
    }
  };

  // ─── SUB-COMPONENTS ───

  /**
   * Avatar Component — renders the host's profile photo if available, or a coloured
   * initials fallback otherwise.
   *
   * @returns {JSX.Element}
   */
  const Avatar = () => {
    if (u?.profileImage?.url) {
      return (
        <img
          src={u.profileImage.url}
          alt=""
          className="w-9 h-9 rounded-full object-cover ring-1 ring-[var(--bv-gold-border)]"
        />
      );
    }
    return (
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-bg)] font-bold text-sm">
        {u?.username?.charAt(0)?.toUpperCase() || 'H'}
      </div>
    );
  };

  // ─── RENDER ───

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-[var(--bv-bg-raised)]/80 backdrop-blur-xl border-b border-[var(--bv-border)] px-4 sm:px-6 h-16">
      {/* ── Mobile: hamburger + avatar ── */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          className="text-[var(--bv-text-muted)] hover:text-[var(--bv-text)] transition"
          onClick={() => {
            return setOpenSidebar((p) => {
              return !p;
            });
          }}
        >
          <Menu size={22} />
        </button>
        <button
          onClick={() => {
            return setDd((p) => {
              return !p;
            });
          }}
          className="flex items-center rounded-full hover:opacity-90 transition"
          aria-label="Open profile menu"
        >
          <Avatar />
        </button>
      </div>

      {/* ── Desktop: welcome greeting ── */}
      <div className="hidden lg:block">
        <p className="text-base font-semibold text-[var(--bv-text)]">
          Welcome,{' '}
          <span className="text-[var(--bv-gold)]">{u?.username || 'Host'}</span>
        </p>
      </div>

      {/* ── Right-side controls ── */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Notification bell */}
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

          {/* Notification dropdown */}
          {notif && (
            <div className="absolute right-0 mt-2 w-[360px] max-w-[92vw] bg-[var(--bv-card)] rounded-2xl shadow-[var(--bv-shadow-lg)] border border-[var(--bv-border)] z-50 overflow-hidden bv-animate-in">
              {/* Dropdown header */}
              <div className="px-5 py-4 border-b border-[var(--bv-divider)] bg-[var(--bv-gold-glow)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--bv-text)]">
                      Notifications
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

              {/* Notification list */}
              <div className="max-h-[380px] overflow-y-auto">
                {preview.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <Bell
                      size={28}
                      className="mx-auto text-[var(--bv-text-dim)] mb-3 opacity-30"
                    />
                    <p className="text-sm text-[var(--bv-text-muted)]">
                      No notifications yet
                    </p>
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

              {/* Dropdown footer — link to full notifications page */}
              <div className="px-5 py-3 border-t border-[var(--bv-divider)]">
                <button
                  onClick={() => {
                    setNotif(false);
                    nav('/host/notifications');
                  }}
                  className="w-full bv-btn-gold py-2.5 text-sm flex items-center justify-center gap-2"
                >
                  View all <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile dropdown */}
        <div className="relative" ref={ddRef}>
          <button
            onClick={() => {
              return setDd((p) => {
                return !p;
              });
            }}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-[var(--bv-surface)] transition"
          >
            <Avatar />
            <ChevronDown
              size={13}
              className={`text-[var(--bv-text-dim)] transition-transform ${
                dd ? 'rotate-180' : ''
              }`}
            />
          </button>

          {dd && (
            <div className="absolute right-0 mt-2 w-52 bg-[var(--bv-card)] rounded-xl shadow-[var(--bv-shadow-lg)] border border-[var(--bv-border)] z-50 overflow-hidden bv-animate-in">
              {/* User identity */}
              <div className="px-4 py-3 border-b border-[var(--bv-divider)]">
                <p className="text-sm font-bold text-[var(--bv-text)] truncate">
                  {u?.username}
                </p>
                <p className="text-xs text-[var(--bv-text-dim)] truncate mt-0.5">
                  {u?.email}
                </p>
                <span className="bv-badge bv-badge-gold capitalize mt-1.5">
                  {u?.role}
                </span>
              </div>

              {/* Navigation links */}
              <div className="py-1">
                <button
                  onClick={() => {
                    nav('/host/profile');
                    setDd(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] transition"
                >
                  <User size={14} /> Profile
                </button>
                <button
                  onClick={() => {
                    nav('/host/settings');
                    setDd(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] transition"
                >
                  <Settings size={14} /> Settings
                </button>
              </div>

              {/* Sign out */}
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

export default HostNavbar;
