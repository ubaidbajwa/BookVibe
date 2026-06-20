/**
 * GuestSettings.jsx
 *
 * Account settings page for authenticated guests. Provides three tabs:
 *   - Security: change password (logs the user out after success)
 *   - Notifications: toggle email/SMS/push preferences and persist them
 *   - Account: view current identity and access danger-zone actions
 *     (deactivate or permanently delete the account)
 *
 * @module GuestSettings
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { Lock, Bell, AlertTriangle, Trash2, Settings, Eye, EyeOff, Save, Loader2, UserX } from 'lucide-react';
import { logout, reset as resetAuth, setUser } from '../redux/slices/authSlice';
import { getAuthConfig } from '../utils/authConfig';
import { subscribeToPush, unsubscribeFromPush } from '../utils/webPush';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Toggle component — a simple on/off switch button.
 * Stateless: receives current state and a callback.
 *
 * @param {Object} props - Component properties
 * @param {boolean} props.on - Current state of the toggle
 * @param {Function} props.onToggle - Callback function for toggle action
 * @returns {JSX.Element}
 */
const Toggle = ({ on, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${on ? 'bg-[var(--bv-gold)]' : 'bg-[var(--bv-surface)]'}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
};

/**
 * GuestSettings Component
 * Manages user account settings including password updates, notification preferences,
 * and account deactivation/deletion.
 *
 * @returns {JSX.Element}
 */
const GuestSettings = () => {
  // ─── HOOKS ───

  /** @type {Function} Redux dispatch hook */
  const dispatch = useDispatch();

  /** @type {Function} React Router navigation hook */
  const nav = useNavigate();

  /** @type {Object} User data from Redux store */
  const userData = useSelector((s) => {
    return s.auth.user?.user;
  });

  // ─── STATE ───

  /** @type {[string, Function]} Current active tab state */
  const [tab, setTab] = useState('security');

  // ── Password change state ──
  const [pwCur, setPwCur] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwCfm, setPwCfm] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCfm, setShowCfm] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // ── Notification preferences state ──
  const [notifs, setNotifs] = useState({
    emailBookings: true,
    emailPayments: true,
    emailPromotions: false,
    smsAlerts: false,
    browserPush: true,
  });
  const [savingN, setSavingN] = useState(false);
  const [loadN, setLoadN] = useState(true);
  const [nDirty, setNDirty] = useState(false);
  const [initialNotifs, setInitialNotifs] = useState(null);

  // ── Danger zone state ──
  const [danger, setDanger] = useState(null);
  const [dangerLoad, setDangerLoad] = useState(false);

  // ─── SIDE EFFECTS ───

  /**
   * Loads the user's saved notification settings from the server on mount.
   * Merges with the default values to handle missing keys gracefully.
   */
  useEffect(
    () => {
      // Setup: Fetch user settings
      axios.get(`${BASE}/user/settings`, getAuthConfig())
        .then((r) => {
          if (r.data.success && r.data.settings?.notifications) {
            const n = { ...notifs, ...r.data.settings.notifications };
            setNotifs(n);
            setInitialNotifs(n);
          }
        })
        .catch(() => {
          // Silent error
        })
        .finally(() => {
          setLoadN(false);
        });

      // Cleanup: None
    },
    [
      // Dependencies: None
    ]
  );

  /**
   * Tracks whether notification settings have been changed from their saved values.
   * Used to enable/disable the save button.
   */
  useEffect(
    () => {
      // Setup: Check for dirty notification state
      if (initialNotifs) {
        setNDirty(JSON.stringify(notifs) !== JSON.stringify(initialNotifs));
      }

      // Cleanup: None
    },
    [
      // Dependencies
      notifs,
      initialNotifs
    ]
  );

  // ─── HANDLERS ───

  /**
   * Validates and submits the password change form. Logs the user out on success.
   * @param {Event} e - Form submission event
   */
  const handlePw = async (e) => {
    e.preventDefault();

    if (!pwCur || !pwNew || !pwCfm) {
      return;
    }
    if (pwNew.length < 6) {
      return;
    }
    if (pwNew !== pwCfm) {
      return;
    }
    if (pwCur === pwNew) {
      return;
    }

    try {
      setSavingPw(true);
      await axios.put(
        `${BASE}/user/update-password`,
        { currentPassword: pwCur, newPassword: pwNew },
        getAuthConfig()
      );
      dispatch(logout());
      dispatch(resetAuth());
      nav('/login', { replace: true });
    } catch {
      // error silently handled
    } finally {
      setSavingPw(false);
    }
  };

  /**
   * Toggles a single notification preference key.
   * @param {string} key - Notification key to toggle
   */
  const toggleNotif = (key) => {
    setNotifs((prev) => {
      return { ...prev, [key]: !prev[key] };
    });
  };

  /**
   * Persists the current notification preferences to the server.
   */
  const handleSaveN = async () => {
    try {
      setSavingN(true);
      const r = await axios.put(
        `${BASE}/user/settings`,
        { notifications: notifs },
        getAuthConfig()
      );
      if (r.data.success) {
        dispatch(setUser({ settings: { notifications: notifs } }));
        setInitialNotifs({ ...notifs });
        setNDirty(false);

        if (notifs.browserPush) {
          subscribeToPush();
        } else {
          unsubscribeFromPush();
        }
      }
    } catch {
      // error silently handled
    } finally {
      setSavingN(false);
    }
  };

  /**
   * Logs the user out, resets auth state, shows a toast, and redirects.
   * Shared by deactivate and delete success paths.
   * @param {string} msg - Message to display
   * @param {string} to - Path to navigate to
   */
  const exit = (msg, to = '/login') => {
    dispatch(logout());
    dispatch(resetAuth());
    nav(to, { replace: true });
  };

  /**
   * Sends the deactivate-account request and exits on success.
   */
  const handleDeactivate = async () => {
    try {
      setDangerLoad(true);
      const r = await axios.post(`${BASE}/user/deactivate-account`, {}, getAuthConfig());
      exit(r.data?.message || 'Account deactivated');
    } catch {
      // error silently handled
    } finally {
      setDangerLoad(false);
      setDanger(null);
    }
  };

  /**
   * Sends the delete-account request and redirects home on success.
   */
  const handleDelete = async () => {
    try {
      setDangerLoad(true);
      const r = await axios.delete(`${BASE}/user/delete-account`, getAuthConfig());
      exit(r.data?.message || 'Account deleted', '/');
    } catch {
      // error silently handled
    } finally {
      setDangerLoad(false);
      setDanger(null);
    }
  };

  // ─── RENDER ───

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-6">
      {/* ═══ Deactivate confirmation modal ═══ */}
      {danger === 'deactivate' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bv-card-static p-6 bv-animate-in">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bv-gold-glow)] flex items-center justify-center mb-4">
              <AlertTriangle size={26} className="text-[var(--bv-gold)]" />
            </div>
            <h3 className="text-xl font-bold text-[var(--bv-text)]">Deactivate Account?</h3>
            <p className="text-sm text-[var(--bv-text-muted)] mt-2">Your account will be hidden. Log in again to reactivate.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { return setDanger(null); }} className="flex-1 bv-btn-outline py-3 text-sm">Cancel</button>
              <button
                onClick={handleDeactivate}
                disabled={dangerLoad}
                className="flex-1 bv-btn-gold py-3 text-sm"
              >
                {dangerLoad ? 'Processing...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete confirmation modal ═══ */}
      {danger === 'delete' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bv-card-static p-6 bv-animate-in">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle size={26} className="text-[var(--bv-danger)]" />
            </div>
            <h3 className="text-xl font-bold text-[var(--bv-text)]">Delete Account?</h3>
            <p className="text-sm text-[var(--bv-text-muted)] mt-2">
              This permanently archives your account and cancels all future bookings.
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { return setDanger(null); }} className="flex-1 bv-btn-outline py-3 text-sm">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={dangerLoad}
                className="flex-1 py-3 rounded-[var(--bv-radius-sm)] text-sm font-bold text-white bg-[var(--bv-danger)] hover:bg-red-600 disabled:opacity-50"
              >
                {dangerLoad ? 'Processing...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-1">Account</p>
          <h1 className="font-display text-3xl text-[var(--bv-text)] flex items-center gap-3">
            <Settings size={26} className="text-[var(--bv-gold)]" /> Settings
          </h1>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-[var(--bv-surface)] rounded-2xl p-1 mb-6 overflow-x-auto scrollbar-hide">
          {[
            ['security', 'Security'],
            ['notifications', 'Notifications'],
            ['account', 'Account'],
          ].map(([k, l]) => {
            return (
              <button
                key={k}
                onClick={() => { return setTab(k); }}
                className={`flex-1 min-w-max py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${tab === k ? 'bg-[var(--bv-card)] shadow-[var(--bv-shadow-sm)] text-[var(--bv-gold)]' : 'text-[var(--bv-text-dim)] hover:text-[var(--bv-text-muted)]'}`}
              >
                {l}
              </button>
            );
          })}
        </div>

        {/* ═══ Security tab ═══ */}
        {tab === 'security' && (
          <div className="bv-card-static p-6">
            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-5">Change Password</h3>
            <form onSubmit={handlePw} className="space-y-4">
              {/* Current password */}
              <div>
                <label className="bv-label">Current Password</label>
                <div className="flex items-center gap-3 bv-input">
                  <Lock size={15} className="text-[var(--bv-text-dim)] flex-shrink-0" />
                  <input
                    type={showCur ? 'text' : 'password'}
                    value={pwCur}
                    onChange={(e) => { return setPwCur(e.target.value); }}
                    placeholder="Enter current password"
                    className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none placeholder-[var(--bv-text-dim)]"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => { return setShowCur((p) => { return !p; }); }}
                    className="text-[var(--bv-text-dim)] hover:text-[var(--bv-text)] transition flex-shrink-0"
                  >
                    {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="bv-label">New Password</label>
                <div className="flex items-center gap-3 bv-input">
                  <Lock size={15} className="text-[var(--bv-text-dim)] flex-shrink-0" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={pwNew}
                    onChange={(e) => { return setPwNew(e.target.value); }}
                    placeholder="Enter new password (min 6 chars)"
                    className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none placeholder-[var(--bv-text-dim)]"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => { return setShowNew((p) => { return !p; }); }}
                    className="text-[var(--bv-text-dim)] hover:text-[var(--bv-text)] transition flex-shrink-0"
                  >
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {pwNew && pwNew.length < 6 && (
                  <p className="text-xs text-[var(--bv-danger)] mt-1">Password must be at least 6 characters</p>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="bv-label">Confirm New Password</label>
                <div className="flex items-center gap-3 bv-input">
                  <Lock size={15} className="text-[var(--bv-text-dim)] flex-shrink-0" />
                  <input
                    type={showCfm ? 'text' : 'password'}
                    value={pwCfm}
                    onChange={(e) => { return setPwCfm(e.target.value); }}
                    placeholder="Confirm new password"
                    className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none placeholder-[var(--bv-text-dim)]"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => { return setShowCfm((p) => { return !p; }); }}
                    className="text-[var(--bv-text-dim)] hover:text-[var(--bv-text)] transition flex-shrink-0"
                  >
                    {showCfm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {pwCfm && pwNew !== pwCfm && (
                  <p className="text-xs text-[var(--bv-danger)] mt-1">Passwords do not match</p>
                )}
                {pwCfm && pwNew === pwCfm && pwNew.length >= 6 && (
                  <p className="text-xs text-[var(--bv-success)] mt-1">Passwords match!</p>
                )}
              </div>

              <button
                type="submit"
                disabled={savingPw || !pwCur || !pwNew || !pwCfm || pwNew !== pwCfm || pwNew.length < 6}
                className="w-full bv-btn-gold py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {savingPw
                  ? <><Loader2 size={15} className="animate-spin" /> Updating...</>
                  : <><Save size={15} /> Update Password</>
                }
              </button>
            </form>

            <div className="mt-4 p-3 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-xl">
              <p className="text-xs text-[var(--bv-gold)]">
                After changing your password, you will be logged out and need to sign in again with your new credentials.
              </p>
            </div>
          </div>
        )}

        {/* ═══ Notifications tab ═══ */}
        {tab === 'notifications' && (
          <div className="bv-card-static p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest">Notification Preferences</h3>
              {nDirty && <span className="bv-badge bv-badge-amber">Unsaved changes</span>}
            </div>

            {loadN ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => {
                  return <div key={i} className="bv-skeleton h-16 rounded-xl" />;
                })}
              </div>
            ) : (
              <>
                <p className="text-xs text-[var(--bv-text-dim)] mb-4">
                  Control which notifications you receive. Changes are saved to your account and applied across all devices.
                </p>

                <div className="space-y-0">
                  {[
                    ['emailBookings', 'Booking Emails', 'Receive emails for booking confirmations, cancellations, and status changes', Bell],
                    ['emailPayments', 'Payment Emails', 'Receive emails for payment confirmations, refund updates, and receipts', Bell],
                    ['emailPromotions', 'Promotional Emails', 'Receive deals, offers, and marketing updates from BookVibe', Bell],
                    ['smsAlerts', 'SMS Alerts', 'Receive text messages for urgent booking alerts and OTPs', Bell],
                    ['browserPush', 'Browser Push Notifications', 'Show real-time pop-up notifications in your browser when logged in', Bell],
                  ].map(([key, label, desc]) => {
                    return (
                      <div key={key} className="flex items-center justify-between py-4 border-b border-[var(--bv-divider)] last:border-0">
                        <div className="flex-1 pr-4">
                          <p className="text-sm font-semibold text-[var(--bv-text)]">{label}</p>
                          <p className="text-xs text-[var(--bv-text-dim)] mt-0.5 leading-relaxed">{desc}</p>
                        </div>
                        <Toggle on={notifs[key]} onToggle={() => { return toggleNotif(key); }} />
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleSaveN}
                  disabled={savingN || !nDirty}
                  className="w-full bv-btn-gold py-3 text-sm mt-5 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {savingN
                    ? <><Loader2 size={15} className="animate-spin" /> Saving...</>
                    : <><Save size={15} /> Save Notification Settings</>
                  }
                </button>

                {!nDirty && initialNotifs && (
                  <p className="text-xs text-[var(--bv-text-dim)] text-center mt-3">All settings are up to date</p>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ Account tab ═══ */}
        {tab === 'account' && (
          <div className="space-y-5">
            {/* Current identity */}
            <div className="bv-card-static p-5">
              <p className="text-sm font-semibold text-[var(--bv-text)]">Signed in as</p>
              <p className="text-sm text-[var(--bv-text-muted)] mt-0.5">
                {userData?.username} — {userData?.email}
              </p>
              <span className="bv-badge bv-badge-gold capitalize mt-2">{userData?.role}</span>
            </div>

            {/* Danger zone */}
            <div className="bv-card-static p-6">
              <h3 className="text-sm font-bold text-[var(--bv-danger)] uppercase tracking-widest mb-5">Danger Zone</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 border border-[var(--bv-gold-border)] bg-[var(--bv-gold-glow)] rounded-2xl">
                  <p className="text-sm font-bold text-[var(--bv-gold)] mb-1">Deactivate</p>
                  <p className="text-xs text-[var(--bv-text-dim)] mb-4">Temporarily hide your account. Login to reactivate anytime.</p>
                  <button
                    onClick={() => { return setDanger('deactivate'); }}
                    className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
                  >
                    <UserX size={14} /> Deactivate
                  </button>
                </div>
                <div className="p-5 border border-red-500/20 bg-red-500/5 rounded-2xl">
                  <p className="text-sm font-bold text-[var(--bv-danger)] mb-1">Delete Account</p>
                  <p className="text-xs text-[var(--bv-text-dim)] mb-4">Permanently archive your account and all data.</p>
                  <button
                    onClick={() => { return setDanger('delete'); }}
                    className="text-sm px-4 py-2 rounded-[var(--bv-radius-sm)] bg-[var(--bv-danger)] text-white font-bold flex items-center gap-2 hover:bg-red-600 transition"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestSettings;
