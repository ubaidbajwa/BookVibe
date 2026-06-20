/**
 * AdminSettings.jsx
 *
 * This component manages the administrative configuration for the platform.
 * It is organized into multiple tabs covering Security, Appearance, Notifications,
 * and Platform-wide settings. It handles password updates, theme switching,
 * notification preferences, and general site metadata configuration.
 *
 * @module AdminSettings
 */

import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import {
  Lock, Eye, EyeOff, Save, Settings, Loader2, Shield,
  Globe, Bell, Moon, Sun, Monitor, AlertTriangle, Power, AlertCircle, X, CheckCircle,
} from 'lucide-react';
import { logout, reset as resetAuth, setUser } from '../../redux/slices/authSlice';
import { getAuthConfig } from '../../utils/authConfig';
import { useNavigate } from 'react-router-dom';
import { setTheme, getStoredTheme } from '../../utils/hostTheme';
import { subscribeToPush, unsubscribeFromPush } from '../../utils/webPush';

/* ── CONSTANTS ── */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/* ── SUB-COMPONENTS ── */

/**
 * Reusable animated toggle switch.
 *
 * @param {Object} props - Component properties.
 * @param {boolean} props.on - Controls the visual state.
 * @param {Function} props.fn - Callback called on click.
 * @returns {JSX.Element}
 */
const Toggle = ({ on, fn }) => {
  return (
    <button
      onClick={fn}
      className={`w-11 h-6 rounded-full transition flex items-center px-0.5 ${
        on ? 'bg-[var(--bv-gold)]' : 'bg-[var(--bv-surface)]'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
};

/* ── MAIN COMPONENT ── */

/**
 * AdminSettings Component.
 *
 * @returns {JSX.Element}
 */
const AdminSettings = () => {
  const dispatch = useDispatch();
  const nav = useNavigate();

  /* ── STATE MANAGEMENT ── */

  /** @type {[string, Function]} Active tab key: 'security' | 'appearance' | 'notifications' | 'platform' */
  const [tab, setTab] = useState('security');

  // ── Password change form state ──
  /** @type {[string, Function]} Current password field value */
  const [pwCur, setPwCur] = useState('');

  /** @type {[string, Function]} New password field value */
  const [pwNew, setPwNew] = useState('');

  /** @type {[string, Function]} Confirm new password field value */
  const [pwCfm, setPwCfm] = useState('');

  /** @type {[boolean, Function]} Whether the current-password field is visible */
  const [showCur, setShowCur] = useState(false);

  /** @type {[boolean, Function]} Whether the new-password field is visible */
  const [showNew, setShowNew] = useState(false);

  /** @type {[boolean, Function]} Whether the confirm-password field is visible */
  const [showCfm, setShowCfm] = useState(false);

  /** @type {[boolean, Function]} Whether the password update request is in-flight */
  const [savingPw, setSavingPw] = useState(false);

  // ── Theme state ──
  /** @type {[string, Function]} Currently selected theme token ('dark' | 'light' | 'system') */
  const [theme, setThemeLocal] = useState(getStoredTheme());

  /**
   * Real, backend-persisted notification settings. Defaults mirror the backend's
   * defaultSettings.notifications so an unsaved admin sees the same values the
   * server would.
   * @type {[Object, Function]}
   */
  const [notifSettings, setNotifSettings] = useState({
    emailBookings: true,
    emailPayments: true,
    emailPromotions: false,
    smsAlerts: false,
    browserPush: true,
    notifyNewUsers: true,
    notifyComplaints: true,
    notifyHighValueBookings: true,
    emailDigest: true,
  });

  /** @type {[boolean, Function]} Whether the notification preferences are saving */
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false);

  /** @type {[string|null, Function]} Page-level error message */
  const [pageError, setPageError] = useState(null);

  /** @type {[string|null, Function]} Password form error message */
  const [pwError, setPwError] = useState(null);

  /** @type {[boolean, Function]} Whether notification preferences saved successfully */
  const [notifSaved, setNotifSaved] = useState(false);

  /* ── EFFECTS ── */

  /**
   * Loads the admin's saved notification settings on mount.
   */
  useEffect(() => {
    axios.get(`${BASE}/user/settings`, getAuthConfig())
      .then((r) => {
        if (!r.data.success) return;
        if (r.data.settings?.notifications) {
          setNotifSettings((prev) => ({ ...prev, ...r.data.settings.notifications }));
        }
        // Saved theme follows the admin across devices/browsers, falling back to
        // whatever was already applied locally (e.g. on first-ever login).
        if (r.data.settings?.appearanceTheme) {
          setTheme(r.data.settings.appearanceTheme);
          setThemeLocal(r.data.settings.appearanceTheme);
        }
      })
      .catch(() => {
        // Silent — defaults stand
      });
  }, []);

  /* ── EVENT HANDLERS ── */

  /**
   * Persists the (real) notification settings — sending the full object, not
   * just browserPush, so other saved fields aren't reset by the backend's
   * shallow merge — and (un)subscribes this browser/device to match.
   */
  const handleSaveNotifPrefs = async () => {
    try {
      setSavingNotifPrefs(true);
      const r = await axios.put(
        `${BASE}/user/settings`,
        { notifications: notifSettings },
        getAuthConfig()
      );
      if (r.data.success) {
        dispatch(setUser({ settings: r.data.settings }));
        setNotifSaved(true);
        setTimeout(() => setNotifSaved(false), 3000);

        if (notifSettings.browserPush) {
          const ok = await subscribeToPush();
          if (!ok) setPageError('Could not enable push notifications — check browser permission.');
        } else {
          unsubscribeFromPush();
        }
      }
    } catch (e) {
      setPageError(e.response?.data?.message || 'Failed to save notification preferences.');
    } finally {
      setSavingNotifPrefs(false);
    }
  };

  /**
   * Submit the password change form.
   *
   * @param {Object} e - Form submit event.
   */
  const handlePw = async (e) => {
    e.preventDefault();

    if (!pwCur || !pwNew || !pwCfm) {
      setPwError('All fields are required.');
      return;
    }
    if (pwNew.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (pwNew !== pwCfm) {
      setPwError('Passwords do not match.');
      return;
    }
    setPwError(null);

    try {
      setSavingPw(true);
      await axios.put(
        `${BASE}/user/update-password`,
        { currentPassword: pwCur, newPassword: pwNew },
        getAuthConfig()
      );

      // Invalidate the admin gate session and redirect to login
      sessionStorage.removeItem('bv_admin_gate');
      dispatch(logout());
      dispatch(resetAuth());
      nav('/login', { replace: true });
    } catch (e) {
      setPwError(e.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setSavingPw(false);
    }
  };

  /**
   * Apply the selected theme locally (instant) and persist it server-side so it
   * follows the admin to other browsers/devices, matching the host settings page.
   *
   * @param {string} t - Theme value.
   */
  const handleTheme = (t) => {
    setTheme(t);
    setThemeLocal(t);

    axios.put(`${BASE}/user/settings`, { appearanceTheme: t }, getAuthConfig())
      .then((r) => {
        if (r.data.success) dispatch(setUser({ settings: r.data.settings }));
      })
      .catch(() => {
        // Local preference still applied — silently retry next change
      });
  };

  /**
   * Renders a selectable theme option button used in the appearance tab.
   * Highlights with a gold border when selected.
   *
   * @param {Object} props - Component properties.
   */
  const ThemeBtn = ({ value, icon: I, label }) => {
    return (
      <button
        onClick={() => {
          return handleTheme(value);
        }}
        className={`text-left rounded-xl border p-4 transition-all ${
          theme === value
            ? 'border-[var(--bv-gold)] bg-[var(--bv-gold-glow)]'
            : 'border-[var(--bv-border)] hover:border-[var(--bv-gold-border)]'
        }`}
      >
        <I
          size={18}
          className={theme === value ? 'text-[var(--bv-gold)]' : 'text-[var(--bv-text-dim)]'}
        />
        <p className="text-sm font-semibold text-[var(--bv-text)] mt-2">{label}</p>
      </button>
    );
  };

  /* ── RENDER ── */

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {pageError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/15">
          <AlertCircle size={15} className="text-[var(--bv-danger)] flex-shrink-0" />
          <p className="text-sm text-[var(--bv-danger)] flex-1">{pageError}</p>
          <button onClick={() => setPageError(null)} className="text-[var(--bv-danger)] opacity-60 hover:opacity-100 flex-shrink-0 transition">
            <X size={14} />
          </button>
        </div>
      )}
      {/* Page heading */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-3">
          <Settings size={26} className="text-[var(--bv-gold)]" />
          Admin Settings
        </h1>
        <p className="text-[var(--bv-text-dim)] text-sm mt-1">
          Security, appearance &amp; platform configuration
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--bv-surface)] rounded-2xl p-1 overflow-x-auto scrollbar-hide">
        {[
          ['security', 'Security'],
          ['appearance', 'Appearance'],
          ['notifications', 'Notifications'],
          ['platform', 'Platform'],
        ].map(([k, l]) => {
          return (
            <button
              key={k}
              onClick={() => {
                return setTab(k);
              }}
              className={`flex-1 min-w-max py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
                tab === k
                  ? 'bg-[var(--bv-card)] shadow-[var(--bv-shadow-sm)] text-[var(--bv-gold)]'
                  : 'text-[var(--bv-text-dim)] hover:text-[var(--bv-text-muted)]'
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>

      {/* ── SECURITY TAB ── */}
      {tab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Password change card */}
          <div className="bv-card-static p-6">
            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-5 flex items-center gap-2">
              <Lock size={14} /> Change Password
            </h3>
            <form
              onSubmit={(e) => {
                return handlePw(e);
              }}
              className="space-y-4"
            >
              {/* Current password */}
              <div>
                <label className="bv-label">Current Password</label>
                <div className="flex items-center gap-3 bv-input">
                  <Lock size={14} className="text-[var(--bv-text-dim)]" />
                  <input
                    type={showCur ? 'text' : 'password'}
                    value={pwCur}
                    onChange={(e) => {
                      return setPwCur(e.target.value);
                    }}
                    className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      return setShowCur((prev) => {
                        return !prev;
                      });
                    }}
                    className="text-[var(--bv-text-dim)]"
                  >
                    {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="bv-label">New Password</label>
                <div className="flex items-center gap-3 bv-input">
                  <Lock size={14} className="text-[var(--bv-text-dim)]" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={pwNew}
                    onChange={(e) => {
                      return setPwNew(e.target.value);
                    }}
                    className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      return setShowNew((prev) => {
                        return !prev;
                      });
                    }}
                    className="text-[var(--bv-text-dim)]"
                  >
                    {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {pwNew && pwNew.length < 6 && (
                  <p className="text-xs text-[var(--bv-danger)] mt-1">Min 6 characters</p>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="bv-label">Confirm Password</label>
                <div className="flex items-center gap-3 bv-input">
                  <Lock size={14} className="text-[var(--bv-text-dim)]" />
                  <input
                    type={showCfm ? 'text' : 'password'}
                    value={pwCfm}
                    onChange={(e) => {
                      return setPwCfm(e.target.value);
                    }}
                    className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      return setShowCfm((prev) => {
                        return !prev;
                      });
                    }}
                    className="text-[var(--bv-text-dim)]"
                  >
                    {showCfm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {/* Inline validation feedback */}
                {pwCfm && pwNew !== pwCfm && (
                  <p className="text-xs text-[var(--bv-danger)] mt-1">Mismatch</p>
                )}
                {pwCfm && pwNew === pwCfm && pwNew.length >= 6 && (
                  <p className="text-xs text-[var(--bv-success)] mt-1">Match!</p>
                )}
              </div>

              {pwError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/15">
                  <AlertCircle size={13} className="text-[var(--bv-danger)] flex-shrink-0" />
                  <p className="text-xs text-[var(--bv-danger)]">{pwError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  savingPw || !pwCur || !pwNew || pwNew !== pwCfm || pwNew.length < 6
                }
                className="w-full bv-btn-gold py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {savingPw ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Update Password
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Security info panel */}
          <div className="space-y-5">
            <div className="bv-card-static p-6">
              <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4 flex items-center gap-2">
                <Shield size={14} /> Security Info
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-3 border-b border-[var(--bv-divider)]">
                  <span className="text-[var(--bv-text-muted)]">Admin PIN</span>
                  <span className="text-[var(--bv-text)] font-semibold">••••••</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-[var(--bv-divider)]">
                  <span className="text-[var(--bv-text-muted)]">Session Timeout</span>
                  <span className="text-[var(--bv-text)] font-semibold">Browser Close</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-[var(--bv-text-muted)]">Admin Path</span>
                  <span className="text-[var(--bv-gold)] font-semibold">Hidden (Secret)</span>
                </div>
              </div>
            </div>

            {/* PIN change note */}
            <div className="p-4 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-xl">
              <p className="text-xs text-[var(--bv-gold)] leading-relaxed">
                <span className="font-bold">Security Note:</span> To change admin PIN,
                update ADMIN_PIN in backend .env file and restart server. PIN cannot be
                changed from UI for security.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── APPEARANCE TAB ── */}
      {tab === 'appearance' && (
        <div className="bv-card-static p-6">
          <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-5">
            Theme
          </h3>
          <p className="text-sm text-[var(--bv-text-muted)] mb-4">
            Choose your preferred appearance for the admin panel.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <ThemeBtn value="dark" icon={Moon} label="Dark Luxury" />
            <ThemeBtn value="light" icon={Sun} label="Coastal Light" />
            <ThemeBtn value="system" icon={Monitor} label="System Auto" />
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS TAB ── */}
      {tab === 'notifications' && (
        <div className="bv-card-static p-6">
          <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-5 flex items-center gap-2">
            <Bell size={14} /> Admin Notification Preferences
          </h3>
          <p className="text-xs text-[var(--bv-text-dim)] mb-4">
            Control which notifications you receive as admin.
          </p>

          <div className="space-y-0">
            {[
              ['notifyNewUsers', 'New User Alerts', 'Notify when a new guest or host registers'],
              ['notifyComplaints', 'Complaint Alerts', 'Notify when a new complaint is filed'],
              ['notifyHighValueBookings', 'Booking Alerts', 'Notify on bookings of PKR 50,000 or more'],
              ['emailDigest', 'Email Reports', 'Daily summary email at 8 AM — new users, bookings, revenue, complaints'],
              ['browserPush', 'Browser Push Notifications', "Off: alerts only show while this admin panel is open. On: real push notifications reach your device even when it's closed."],
            ].map(([key, label, desc]) => {
              return (
                <div
                  key={key}
                  className="flex items-center justify-between py-4 border-b border-[var(--bv-divider)] last:border-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--bv-text)]">{label}</p>
                    <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">{desc}</p>
                  </div>
                  <Toggle
                    on={notifSettings[key]}
                    fn={() => {
                      return setNotifSettings((prev) => ({ ...prev, [key]: !prev[key] }));
                    }}
                  />
                </div>
              );
            })}
          </div>

          {notifSaved && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mt-4">
              <CheckCircle size={13} className="text-[var(--bv-success)] flex-shrink-0" />
              <p className="text-xs text-[var(--bv-success)]">Preferences saved successfully.</p>
            </div>
          )}

          <button
            className="w-full bv-btn-gold py-3 text-sm mt-5 flex items-center justify-center gap-2 disabled:opacity-50"
            disabled={savingNotifPrefs}
            onClick={handleSaveNotifPrefs}
          >
            {savingNotifPrefs ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Preferences
          </button>
        </div>
      )}

      {/* ── PLATFORM TAB ── */}
      {tab === 'platform' && (
        <div className="space-y-6">
          {/* Site information — not yet backed by the database; see note below */}
          <div className="bv-card-static p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest flex items-center gap-2">
                <Globe size={14} /> Site Information
              </h3>
              <span className="bv-badge bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px]">
                Not yet available
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-60">
              <div>
                <label className="bv-label">Site Name</label>
                <input defaultValue="BookVibe" disabled className="bv-input cursor-not-allowed" />
              </div>
              <div>
                <label className="bv-label">Support Email</label>
                <input defaultValue="support@bookvibe.com" disabled className="bv-input cursor-not-allowed" />
              </div>
              <div>
                <label className="bv-label">Contact Phone</label>
                <input defaultValue="+92 300 1234567" disabled className="bv-input cursor-not-allowed" />
              </div>
              <div>
                <label className="bv-label">Currency</label>
                <select defaultValue="PKR" disabled className="bv-input cursor-not-allowed">
                  <option>PKR</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </div>
            </div>
            <button
              className="bv-btn-outline text-sm px-6 py-2.5 mt-5 flex items-center gap-2"
              disabled
            >
              <Save size={14} /> Save
            </button>
          </div>

          {/* Booking configuration — not yet backed by the database; see note below */}
          <div className="bv-card-static p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest">
                Booking Configuration
              </h3>
              <span className="bv-badge bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px]">
                Not yet available
              </span>
            </div>
            <p className="text-xs text-[var(--bv-text-dim)] mb-4">
              These values are currently fixed in code (e.g. the 10% platform commission used
              across refunds and payouts) — changing them here won't take effect yet.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-60">
              <div>
                <label className="bv-label">Commission Rate (%)</label>
                <input type="number" defaultValue="10" disabled className="bv-input cursor-not-allowed" />
                <p className="text-[10px] text-[var(--bv-text-dim)] mt-1">
                  Platform fee charged to hosts
                </p>
              </div>
              <div>
                <label className="bv-label">Max Advance Booking (days)</label>
                <input type="number" defaultValue="90" disabled className="bv-input cursor-not-allowed" />
              </div>
              <div>
                <label className="bv-label">Free Cancellation (hours before)</label>
                <input type="number" defaultValue="48" disabled className="bv-input cursor-not-allowed" />
              </div>
              <div>
                <label className="bv-label">Auto-verify OCR Threshold (%)</label>
                <input type="number" defaultValue="80" disabled className="bv-input cursor-not-allowed" />
                <p className="text-[10px] text-[var(--bv-text-dim)] mt-1">
                  Auto-verify if OCR confidence above this
                </p>
              </div>
            </div>
            <button
              className="bv-btn-outline text-sm px-6 py-2.5 mt-5 flex items-center gap-2"
              disabled
            >
              <Save size={14} /> Save
            </button>
          </div>

          {/* Danger zone */}
          <div className="bv-card-static p-6">
            <h3 className="text-sm font-bold text-[var(--bv-danger)] uppercase tracking-widest mb-5 flex items-center gap-2">
              <AlertTriangle size={14} /> Danger Zone
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Maintenance mode card */}
              <div className="p-5 border border-amber-500/20 bg-amber-500/5 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Power size={16} className="text-[var(--bv-warning)]" />
                  <p className="text-sm font-bold text-[var(--bv-warning)]">
                    Maintenance Mode
                  </p>
                </div>
                <p className="text-xs text-[var(--bv-text-dim)] mb-4">
                  Temporarily disable the site for all users except admins.
                </p>
                <button
                  disabled
                  className="bv-btn-outline text-sm px-4 py-2 opacity-50 cursor-not-allowed"
                >
                  Enable Maintenance
                </button>
              </div>

              {/* Force logout all card */}
              <div className="p-5 border border-red-500/20 bg-red-500/5 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-[var(--bv-danger)]" />
                  <p className="text-sm font-bold text-[var(--bv-danger)]">
                    Clear All Sessions
                  </p>
                </div>
                <p className="text-xs text-[var(--bv-text-dim)] mb-4">
                  Force logout all users across the platform.
                </p>
                <button
                  disabled
                  className="text-sm px-4 py-2 rounded-[var(--bv-radius-sm)] bg-[var(--bv-danger)] text-white font-bold opacity-50 cursor-not-allowed"
                >
                  Force Logout All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
