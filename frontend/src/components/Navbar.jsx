/**
 * @file Navbar.jsx
 * @description Public-Facing Navigation Bar
 *
 * Sticky header rendered on all public and guest pages.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser, logout } from "../redux/slices/authSlice";
import { useNotifications } from "./SocketContext";
import {
  LayoutDashboard,
  ChevronDown,
  BookOpen,
  User,
  Settings,
  LogOut,
  X,
  Menu,
  Sparkles,
  Sun,
  Moon,
  Heart,
  GitCompareArrows,
  Bell,
  CalendarClock,
  Wallet,
  ShieldAlert,
  Info,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import { toggleTheme, isLightTheme } from "../utils/hostTheme";
import { warmPublicPage } from "../utils/publicPagePerf";

// --- Constants ---

// Maps notification type -> Lucide icon
const iconMap = {
  booking: CalendarClock,
  payment: Wallet,
  refund: ShieldAlert,
  property: Info,
  complaint: ShieldAlert,
  verification: CheckCircle,
  system: Bell,
};

// Property category links
const exploreLinks = [
  { label: "Rooms", to: "/property/Room" },
  { label: "Apartments", to: "/property/Apartment" },
  { label: "Homes", to: "/property/Home" },
  { label: "Hotels", to: "/property/Hotel" },
  { label: "Hostels", to: "/property/Hostel" },
  { label: "View All", to: "/view-all-properties" },
];

const DROPDOWN_BASE =
  "absolute right-0 mt-3 bg-[var(--bv-card)] border border-[var(--bv-border)] rounded-2xl shadow-[var(--bv-shadow-lg)] z-50 overflow-hidden bv-animate-in";

// Secret admin path from env — never hardcode, mirrors App.jsx
const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || "ctrl-bv5ap6";

// --- Helper Functions ---

/**
 * @function timeAgo
 * @description Converts an ISO date string to a human-readable relative time string.
 * @param {string} date - The date string.
 * @returns {string} The relative time string.
 */
const timeAgo = (date) => {
  if (!date) {
    return "";
  }

  const secondsElapsed = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );

  if (secondsElapsed < 60) {
    return "Just now";
  }
  if (secondsElapsed < 3600) {
    return `${Math.floor(secondsElapsed / 60)}m ago`;
  }
  if (secondsElapsed < 86400) {
    return `${Math.floor(secondsElapsed / 3600)}h ago`;
  }

  return `${Math.floor(secondsElapsed / 86400)}d ago`;
};

// --- Component ---

/**
 * @function Navbar
 * @description The main navigation bar component.
 * @returns {JSX.Element} The rendered component.
 */
export default function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // --- State & Selectors ---
  const { user, isLogin } = useSelector((state) => {
    return state.auth;
  });
  const currentUser = user?.user;
  const isHost = currentUser?.role === "host";
  const isGuest = currentUser?.role === "guest";
  const isAdmin = currentUser?.role === "admin";

  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isLight, setIsLight] = useState(isLightTheme());

  // --- Refs ---
  const exploreRef = useRef(null);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // --- Effects ---

  /**
   * @description Scroll listener effect.
   */
  useEffect(
    () => {
      // Setup:
      const handleScroll = () => {
        setScrolled(window.scrollY > 20);
      };

      window.addEventListener("scroll", handleScroll);

      // Cleanup:
      return () => {
        window.removeEventListener("scroll", handleScroll);
      };
    },
    // Dependency Array:
    []
  );

  /**
   * @description Click-outside listener effect.
   */
  useEffect(
    () => {
      // Setup:
      const handleClickOutside = (event) => {
        if (exploreRef.current && !exploreRef.current.contains(event.target)) {
          setExploreOpen(false);
        }
        if (profileRef.current && !profileRef.current.contains(event.target)) {
          setProfileOpen(false);
        }
        if (notifRef.current && !notifRef.current.contains(event.target)) {
          setNotifOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);

      // Cleanup:
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    },
    // Dependency Array:
    []
  );

  // --- Event Handlers ---

  const closeMobile = () => {
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
    } catch {
      // Ignore server error — still clear local session
    } finally {
      dispatch(logout());
      navigate("/");
    }
  };

  const handleToggleTheme = () => {
    toggleTheme();
    setIsLight(isLightTheme());
  };

  const openNotification = (notification) => {
    if (!notification.isRead) {
      markRead(notification.id || notification._id);
    }
    setNotifOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const previewNotifications = notifications.slice(0, 5);

  // --- Sub-components ---

  /**
   * @function Avatar
   * @description Renders the user's avatar.
   */
  const Avatar = () => {
    if (currentUser?.profileImage?.url) {
      return (
        <img
          src={currentUser.profileImage.url}
          alt=""
          className="w-8 h-8 rounded-full object-cover ring-1 ring-[var(--bv-gold-border)]"
        />
      );
    }

    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-text-inverse)] font-bold text-xs">
        {currentUser?.username?.charAt(0)?.toUpperCase() || "U"}
      </div>
    );
  };

  /**
   * @function ThemeBtn
   * @description Renders the theme toggle button.
   */
  const ThemeBtn = ({ cls = "" }) => {
    let buttonClasses = `w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${cls} `;
    if (isLight) {
      buttonClasses += "bg-[var(--bv-gold-glow)] text-[var(--bv-gold)] hover:bg-[var(--bv-gold)]/15";
    } else {
      buttonClasses += "bg-[var(--bv-surface)] text-[var(--bv-gold)] hover:bg-[var(--bv-card-hover)]";
    }

    return (
      <button
        onClick={handleToggleTheme}
        className={buttonClasses}
        title={isLight ? "Dark mode" : "Light mode"}
      >
        <span key={isLight ? "moon" : "sun"} className="bv-theme-swap">
          {isLight ? <Moon size={16} /> : <Sun size={16} />}
        </span>
      </button>
    );
  };

  /**
   * @function NotifBell
   * @description Renders the notification bell.
   */
  const NotifBell = ({ cls = "" }) => {
    return (
      <div className={`relative ${cls}`} ref={notifRef}>
        <button
          onClick={() => {
            const opening = !notifOpen;
            setNotifOpen(opening);
            if (opening && unreadCount > 0) markAllRead();
          }}
          className="relative p-2 text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] hover:bg-[var(--bv-surface)] rounded-xl transition"
        >
          <Bell size={16} />

          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 bg-[var(--bv-danger)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] bg-[var(--bv-card)] rounded-2xl shadow-[var(--bv-shadow-lg)] border border-[var(--bv-border)] z-50 overflow-hidden bv-animate-in">
            <div className="px-4 py-3 border-b border-[var(--bv-divider)] bg-[var(--bv-gold-glow)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[var(--bv-text)]">
                    Notifications
                  </p>
                  <p className="text-[11px] text-[var(--bv-text-dim)] mt-0.5">
                    {unreadCount} unread
                  </p>
                </div>
                <button
                  onClick={() => {
                    markAllRead();
                  }}
                  disabled={unreadCount === 0}
                  className="text-xs font-semibold text-[var(--bv-gold)] disabled:opacity-50"
                >
                  Mark all read
                </button>
              </div>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {previewNotifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell
                    size={24}
                    className="mx-auto text-[var(--bv-text-dim)] mb-2 opacity-30"
                  />
                  <p className="text-sm text-[var(--bv-text-muted)]">
                    No notifications yet
                  </p>
                </div>
              ) : (
                previewNotifications.map((notification) => {
                  const Icon = iconMap[notification.type] || Bell;
                  const isUnread = !notification.isRead;

                  let itemClasses =
                    "w-full text-left px-4 py-3.5 border-b border-[var(--bv-divider)] hover:bg-[var(--bv-surface)] transition ";
                  if (isUnread) {
                    itemClasses += "bg-[var(--bv-gold)]/[0.03]";
                  }

                  return (
                    <button
                      key={notification.id || notification._id}
                      onClick={() => {
                        openNotification(notification);
                      }}
                      className={itemClasses}
                    >
                      <div className="flex gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] text-[var(--bv-gold)] flex items-center justify-center flex-shrink-0">
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--bv-text)] truncate">
                              {notification.title}
                            </p>
                            {isUnread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--bv-gold)] flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-[var(--bv-text-dim)] mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-[var(--bv-text-dim)] mt-1">
                            {timeAgo(
                              notification.receivedAt || notification.createdAt
                            )}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {notifications.length > 5 && (
              <div className="px-4 py-2.5 border-t border-[var(--bv-divider)]">
                <button
                  onClick={() => {
                    setNotifOpen(false);
                    navigate("/notifications");
                  }}
                  className="w-full text-center text-xs font-semibold text-[var(--bv-gold)] flex items-center justify-center gap-1"
                >
                  View all notifications <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // --- Render ---

  return (
    <header className="fixed top-0 left-0 right-0 z-50 public-navbar">
      <div
        className={`transition-all duration-300 ${scrolled ? "bg-[var(--bv-bg)]/90 backdrop-blur-xl border-b border-[var(--bv-border)]" : ""}`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center shadow-[var(--bv-shadow-gold)]">
                <Sparkles size={16} className="text-[var(--bv-text-inverse)]" />
              </div>
              <span className="font-display text-xl text-[var(--bv-text)]">
                Book<span className="text-[var(--bv-gold)]">Vibe</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              <Link
                to="/"
                className="text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] transition"
              >
                Home
              </Link>

              <div className="relative" ref={exploreRef}>
                <button
                  onClick={() => {
                    setExploreOpen((prev) => {
                      return !prev;
                    });
                  }}
                  className="inline-flex items-center gap-1.5 text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] transition"
                >
                  Explore
                  <ChevronDown
                    size={13}
                    className={`transition-transform ${exploreOpen ? "-rotate-180" : ""}`}
                  />
                </button>

                {exploreOpen && (
                  <div className={`${DROPDOWN_BASE} w-48`}>
                    {exploreLinks.map(({ label, to }) => {
                      return (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => {
                            setExploreOpen(false);
                          }}
                          className="block px-5 py-3 text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] text-sm transition first:pt-4 last:pb-4"
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <Link
                to="/about"
                onMouseEnter={() => {
                  warmPublicPage("/about");
                }}
                onFocus={() => {
                  warmPublicPage("/about");
                }}
                className="text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] transition"
              >
                About
              </Link>

              <Link
                to="/services"
                className="text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] transition"
              >
                Services
              </Link>

              <Link
                to="/contact"
                onMouseEnter={() => {
                  warmPublicPage("/contact");
                }}
                onFocus={() => {
                  warmPublicPage("/contact");
                }}
                className="text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] transition"
              >
                Contact
              </Link>
            </nav>

            {/* Right-side Actions */}
            <div className="flex items-center gap-2">
              {isLogin && (isGuest || isHost || isAdmin) && (
                <>
                  <Link
                    to="/wishlist"
                    title="Wishlist"
                    className="hidden md:flex w-9 h-9 rounded-xl items-center justify-center text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] hover:bg-[var(--bv-surface)] transition"
                  >
                    <Heart size={16} />
                  </Link>
                  <Link
                    to="/compare"
                    title="Compare"
                    className="hidden md:flex w-9 h-9 rounded-xl items-center justify-center text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] hover:bg-[var(--bv-surface)] transition"
                  >
                    <GitCompareArrows size={16} />
                  </Link>
                </>
              )}

              {isLogin && (isGuest || isHost) && <NotifBell cls="hidden md:block" />}

              <ThemeBtn cls="hidden md:flex" />

              {isLogin && isHost && (
                <Link
                  to="/host/dashboard"
                  className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--bv-gold-border)] text-[var(--bv-gold)] hover:bg-[var(--bv-gold-glow)] text-sm font-semibold transition"
                >
                  <LayoutDashboard size={14} /> Dashboard
                </Link>
              )}

              {isLogin && isAdmin && (
                <Link
                  to={`/${ADMIN_PATH}/gate`}
                  className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--bv-gold-border)] text-[var(--bv-gold)] hover:bg-[var(--bv-gold-glow)] text-sm font-semibold transition"
                >
                  <LayoutDashboard size={14} /> Dashboard
                </Link>
              )}

              {isLogin ? (
                <div className="hidden md:block relative" ref={profileRef}>
                  <button
                    onClick={() => {
                      setProfileOpen((prev) => {
                        return !prev;
                      });
                    }}
                    className="flex items-center gap-2 px-1.5 py-1.5 rounded-full hover:bg-[var(--bv-surface)] transition"
                  >
                    <Avatar />
                    <ChevronDown
                      size={12}
                      className={`text-[var(--bv-text-dim)] transition-transform ${profileOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {profileOpen && (
                    <div className={`${DROPDOWN_BASE} w-56`}>
                      <div className="px-5 py-4 border-b border-[var(--bv-divider)]">
                        <p className="text-sm font-bold text-[var(--bv-text)] truncate">
                          {currentUser?.username}
                        </p>
                        <p className="text-xs text-[var(--bv-text-dim)] truncate mt-0.5">
                          {currentUser?.email}
                        </p>
                        <span className="inline-block mt-2 bv-badge bv-badge-gold capitalize">
                          {currentUser?.role}
                        </span>
                      </div>

                      <div className="py-2">
                        {isHost && (
                          <>
                            <button
                              onClick={() => {
                                navigate("/host/profile");
                                setProfileOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] transition"
                            >
                              <User size={14} /> Profile
                            </button>
                            <button
                              onClick={() => {
                                navigate("/my-bookings");
                                setProfileOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] transition"
                            >
                              <BookOpen size={14} /> My Stays
                            </button>
                            <button
                              onClick={() => {
                                navigate("/wishlist");
                                setProfileOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] transition"
                            >
                              <Heart size={14} /> Wishlist
                            </button>
                          </>
                        )}

                        {isGuest && (
                          <>
                            <button
                              onClick={() => {
                                navigate("/profile");
                                setProfileOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] transition"
                            >
                              <User size={14} /> Profile
                            </button>
                            <button
                              onClick={() => {
                                navigate("/my-bookings");
                                setProfileOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] transition"
                            >
                              <BookOpen size={14} /> Bookings
                            </button>
                            <button
                              onClick={() => {
                                navigate("/wishlist");
                                setProfileOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] transition"
                            >
                              <Heart size={14} /> Wishlist
                            </button>
                            <button
                              onClick={() => {
                                navigate("/guest-settings");
                                setProfileOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[var(--bv-text-muted)] hover:bg-[var(--bv-gold-glow)] hover:text-[var(--bv-gold)] transition"
                            >
                              <Settings size={14} /> Settings
                            </button>
                          </>
                        )}
                      </div>

                      <div className="border-t border-[var(--bv-divider)] py-2">
                        <button
                          onClick={() => {
                            setProfileOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-[var(--bv-danger)] hover:bg-red-500/10 transition"
                        >
                          <LogOut size={14} /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="hidden md:inline-block bv-btn-gold text-sm px-6 py-2.5"
                >
                  Sign In
                </Link>
              )}

              <button
                onClick={() => {
                  setMobileOpen(true);
                }}
                className="md:hidden p-2 text-[var(--bv-text-muted)]"
              >
                <Menu size={22} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-0 z-40 ${mobileOpen ? "" : "pointer-events-none"}`}
      >
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          onClick={closeMobile}
        />

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-full max-w-xs bg-[var(--bv-bg-raised)] shadow-2xl transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between h-20 px-6 border-b border-[var(--bv-border)]">
            <Link
              to="/"
              onClick={closeMobile}
              className="flex items-center gap-2.5"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center">
                <Sparkles size={14} className="text-[var(--bv-text-inverse)]" />
              </div>
              <span className="font-display text-lg text-[var(--bv-text)]">
                Book<span className="text-[var(--bv-gold)]">Vibe</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeBtn />
              <button
                onClick={closeMobile}
                className="p-2 text-[var(--bv-text-dim)]"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <nav className="px-4 py-6 space-y-1 overflow-auto h-[calc(100vh-5rem)]">
            {isLogin && currentUser && (
              <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-[var(--bv-gold-glow)] rounded-xl border border-[var(--bv-gold-border)]">
                <Avatar />
                <div>
                  <p className="text-sm font-bold text-[var(--bv-text)]">
                    {currentUser.username}
                  </p>
                  <span className="text-xs text-[var(--bv-gold)] capitalize">
                    {currentUser.role}
                  </span>
                </div>
              </div>
            )}

            {[
              ["/", "Home"],
              ["/about", "About"],
              ["/services", "Services"],
              ["/contact", "Contact"],
            ].map(([to, label]) => {
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={closeMobile}
                  onMouseEnter={() => {
                    warmPublicPage(to);
                  }}
                  onFocus={() => {
                    warmPublicPage(to);
                  }}
                  className="block px-4 py-3 rounded-xl text-[var(--bv-text)] hover:bg-[var(--bv-surface)] font-medium text-sm"
                >
                  {label}
                </Link>
              );
            })}

            {exploreLinks.map(({ label, to }) => {
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={closeMobile}
                  className="block px-4 py-2.5 ml-2 rounded-lg text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] text-sm"
                >
                  {label}
                </Link>
              );
            })}

            {isLogin && (isGuest || isHost || isAdmin) && (
              <div className="pt-3 mt-3 border-t border-[var(--bv-border)] space-y-1">
                {[
                  { to: "/wishlist", Icon: Heart, label: "Wishlist" },
                  { to: "/compare", Icon: GitCompareArrows, label: "Compare" },
                ].map(({ to, Icon, label }) => {
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={closeMobile}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[var(--bv-text-muted)] hover:text-[var(--bv-gold)] text-sm"
                    >
                      <Icon size={15} /> {label}
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="pt-4 border-t border-[var(--bv-border)]">
              {isLogin ? (
                <button
                  onClick={() => {
                    closeMobile();
                    handleLogout();
                  }}
                  className="w-full text-center py-3 rounded-xl bg-red-500/10 text-[var(--bv-danger)] font-semibold text-sm"
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={closeMobile}
                  className="block w-full text-center bv-btn-gold text-sm py-3"
                >
                  Sign In
                </Link>
              )}
            </div>
          </nav>
        </aside>
      </div>
    </header>
  );
}
