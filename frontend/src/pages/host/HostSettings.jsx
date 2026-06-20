import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
  Lock, Bell, Shield, AlertTriangle, Trash2, Eye, EyeOff, Save,
  Settings, Palette, Loader2, Moon, Sun, Monitor, UserX,
} from 'lucide-react';
import { logout, setUser } from '../../redux/slices/authSlice';
import { getAuthConfig } from '../../utils/authConfig';
import { applyHostTheme, getStoredHostTheme, setTheme as persistTheme } from '../../utils/hostTheme';
import { subscribeToPush, unsubscribeFromPush } from '../../utils/webPush';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const defs = {
  notifications: {
    emailBookings: true,
    emailPayments: true,
    emailPromotions: false,
    smsAlerts: false,
    browserPush: true,
  },
  privacy: {
    profilePublic: true,
    showPhone: false,
    showEmail: false,
  },
  appearanceTheme: 'system',
};

// ─── Sub-components defined at module level to prevent re-mount on every render ───

const Toggle = ({ on, fn }) => (
  <button
    type="button"
    onClick={fn}
    className={`w-11 h-6 rounded-full transition flex items-center px-0.5 flex-shrink-0 ${on ? 'bg-[var(--bv-gold)]' : 'bg-[var(--bv-surface)]'}`}
  >
    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
);

const PwIn = ({ label, value, onChange, visible, onToggle }) => (
  <div>
    <label className="bv-label">{label}</label>
    <div className="flex items-center gap-3 bv-input">
      <Lock size={14} className="text-[var(--bv-text-dim)] flex-shrink-0" />
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-[var(--bv-text)] text-sm outline-none min-w-0"
      />
      <button type="button" onClick={onToggle} className="text-[var(--bv-text-dim)] flex-shrink-0">
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  </div>
);

const TogRow = ({ label, desc, on, fn }) => (
  <div className="flex items-center justify-between py-3.5 border-b border-[var(--bv-divider)] last:border-0">
    <div className="flex-1 pr-4 min-w-0">
      <p className="text-sm font-semibold text-[var(--bv-text)]">{label}</p>
      {desc && <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">{desc}</p>}
    </div>
    <Toggle on={on} fn={fn} />
  </div>
);

const ThemeBtn = ({ active, icon: I, title, desc, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-left rounded-xl border p-4 transition-all ${
      active
        ? 'border-[var(--bv-gold)] bg-[var(--bv-gold-glow)]'
        : 'border-[var(--bv-border)] hover:border-[var(--bv-gold-border)]'
    }`}
  >
    <div className="w-9 h-9 rounded-lg bg-[var(--bv-surface)] border border-[var(--bv-border)] text-[var(--bv-gold)] flex items-center justify-center mb-2">
      <I size={16} />
    </div>
    <p className="text-sm font-semibold text-[var(--bv-text)]">{title}</p>
    <p className="text-[10px] text-[var(--bv-text-dim)] mt-0.5">{desc}</p>
  </button>
);

const ConfirmModal = ({ open, title, msg, label, isDanger, loading, onClose, onConfirm }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bv-card-static p-6 bv-animate-in">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDanger ? 'bg-red-500/10 text-[var(--bv-danger)]' : 'bg-[var(--bv-gold-glow)] text-[var(--bv-gold)]'}`}>
          <AlertTriangle size={26} />
        </div>
        <h3 className="text-xl font-bold text-[var(--bv-text)]">{title}</h3>
        <p className="text-sm text-[var(--bv-text-muted)] mt-2 leading-relaxed">{msg}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 bv-btn-outline py-3 text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 rounded-[var(--bv-radius-sm)] text-sm font-bold text-white transition flex items-center justify-center gap-2 ${
              isDanger ? 'bg-[var(--bv-danger)] hover:bg-red-600' : 'bg-[var(--bv-gold)] hover:bg-[var(--bv-gold-light)]'
            } disabled:opacity-50`}
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Please wait...</> : label}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───

const HostSettings = () => {
  const dispatch = useDispatch();
  const nav      = useNavigate();
  const host     = useSelector((s) => s.auth.user?.user);
  const authReady = useSelector((s) => s.auth.authReady);

  const [pw, setPw]           = useState({ cur: '', new: '', cfm: '' });
  const [showPw, setShowPw]   = useState({ cur: false, new: false, cfm: false });
  const [savingPw, setSavingPw] = useState(false);

  const [settings, setSettings] = useState(defs);
  const [initial, setInitial]   = useState(defs);
  const [loadS, setLoadS]       = useState(true);
  const [savingS, setSavingS]   = useState(false);

  const [danger, setDanger]         = useState(null);
  const [dangerLoad, setDangerLoad] = useState(false);

  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(initial), [settings, initial]);

  useEffect(() => {
    if (!authReady || !host?._id) return;
    let active = true;
    axios.get(`${BASE}/user/settings`, getAuthConfig())
      .then((r) => {
        if (!active) return;
        const s = r.data?.settings || { ...defs, appearanceTheme: getStoredHostTheme() };
        setSettings(s);
        setInitial(s);
        applyHostTheme(s.appearanceTheme);
      })
      .catch(() => {
        if (!active) return;
        // error silently handled
      })
      .finally(() => { if (active) setLoadS(false); });
    return () => { active = false; };
  }, [authReady, host?._id]);

  const toggleN = (k) => setSettings((p) => ({ ...p, notifications: { ...p.notifications, [k]: !p.notifications[k] } }));
  const toggleP = (k) => setSettings((p) => ({ ...p, privacy: { ...p.privacy, [k]: !p.privacy[k] } }));

  const selectTheme = (t) => {
    setSettings((p) => ({ ...p, appearanceTheme: t }));
    applyHostTheme(t);
  };

  const exit = (msg, to = '/login') => {
    dispatch(logout());
    nav(to, { replace: true });
  };

  const handlePw = async (e) => {
    e.preventDefault();
    if (!pw.cur || !pw.new || !pw.cfm) { return; }
    if (pw.new.length < 6) { return; }
    if (pw.new !== pw.cfm) { return; }
    if (pw.cur === pw.new) { return; }
    try {
      setSavingPw(true);
      await axios.put(
        `${BASE}/user/update-password`,
        { currentPassword: pw.cur, newPassword: pw.new },
        getAuthConfig()
      );
      // Backend invalidates the session (clears cookies) → must force logout
      setTimeout(() => exit(''), 1500);
    } catch {
      setSavingPw(false);
    }
  };

  const handleSaveS = async () => {
    try {
      setSavingS(true);
      const r = await axios.put(`${BASE}/user/settings`, settings, getAuthConfig());
      const ns = r.data?.settings || settings;
      setSettings(ns);
      setInitial(ns);
      // Persist theme to localStorage so initTheme() reads it correctly on next boot
      persistTheme(ns.appearanceTheme);
      dispatch(setUser({ settings: ns }));

      if (ns.notifications?.browserPush) {
        subscribeToPush();
      } else {
        unsubscribeFromPush();
      }
    } catch {
      // error silently handled
    } finally {
      setSavingS(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      setDangerLoad(true);
      const r = await axios.post(`${BASE}/user/deactivate-account`, {}, getAuthConfig());
      exit(r.data?.message || 'Account deactivated.');
    } catch {
      // error silently handled
    } finally {
      setDangerLoad(false);
      setDanger(null);
    }
  };

  const handleDelete = async () => {
    try {
      setDangerLoad(true);
      const r = await axios.delete(`${BASE}/user/delete-account`, getAuthConfig());
      exit(r.data?.message || 'Account permanently deleted.', '/');
    } catch {
      // error silently handled
    } finally {
      setDangerLoad(false);
      setDanger(null);
    }
  };

  return (
    <div className="space-y-8">
      <ConfirmModal
        open={danger === 'deactivate'}
        title="Deactivate your account?"
        msg="Your profile and properties will be hidden from guests. You can reactivate at any time by logging back in."
        label="Deactivate"
        loading={dangerLoad}
        onClose={() => setDanger(null)}
        onConfirm={handleDeactivate}
      />
      <ConfirmModal
        open={danger === 'delete'}
        title="Permanently delete account?"
        msg="This will permanently delete your account, all your properties, and all associated data. This action cannot be undone."
        label="Delete Forever"
        isDanger
        loading={dangerLoad}
        onClose={() => setDanger(null)}
        onConfirm={handleDelete}
      />

      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-3">
          <Settings size={26} className="text-[var(--bv-gold)]" /> Settings
        </h1>
        <p className="text-[var(--bv-text-dim)] text-sm mt-1">
          Security, appearance, notifications &amp; privacy
        </p>
      </div>

      {loadS ? (
        <div className="bv-card-static p-10 flex items-center justify-center gap-3 text-[var(--bv-text-muted)]">
          <Loader2 size={18} className="animate-spin" /> Loading settings...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Password */}
          <div className="bv-card-static p-6">
            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-5 flex items-center gap-2">
              <Lock size={13} /> Change Password
            </h3>
            <form onSubmit={handlePw} className="space-y-4">
              <PwIn
                label="Current Password"
                value={pw.cur}
                onChange={(v) => setPw((p) => ({ ...p, cur: v }))}
                visible={showPw.cur}
                onToggle={() => setShowPw((p) => ({ ...p, cur: !p.cur }))}
              />
              <PwIn
                label="New Password"
                value={pw.new}
                onChange={(v) => setPw((p) => ({ ...p, new: v }))}
                visible={showPw.new}
                onToggle={() => setShowPw((p) => ({ ...p, new: !p.new }))}
              />
              <PwIn
                label="Confirm New Password"
                value={pw.cfm}
                onChange={(v) => setPw((p) => ({ ...p, cfm: v }))}
                visible={showPw.cfm}
                onToggle={() => setShowPw((p) => ({ ...p, cfm: !p.cfm }))}
              />
              <button
                type="submit"
                disabled={savingPw}
                className="w-full bv-btn-gold py-3 text-sm flex items-center justify-center gap-2"
              >
                {savingPw
                  ? <><Loader2 size={14} className="animate-spin" /> Updating...</>
                  : <><Save size={14} /> Update Password</>}
              </button>
            </form>
          </div>

          {/* Appearance */}
          <div className="bv-card-static p-6">
            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-5 flex items-center gap-2">
              <Palette size={13} /> Appearance
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <ThemeBtn
                active={settings.appearanceTheme === 'light'}
                icon={Sun}
                title="Light"
                desc="Bright mode"
                onClick={() => selectTheme('light')}
              />
              <ThemeBtn
                active={settings.appearanceTheme === 'dark'}
                icon={Moon}
                title="Dark"
                desc="Low-light"
                onClick={() => selectTheme('dark')}
              />
              <ThemeBtn
                active={settings.appearanceTheme === 'system'}
                icon={Monitor}
                title="System"
                desc="Follows OS"
                onClick={() => selectTheme('system')}
              />
            </div>
            <p className="text-[10px] text-[var(--bv-text-dim)] mt-3">
              Theme change takes effect immediately. Click "Save All Settings" to persist.
            </p>
          </div>

          {/* Notifications */}
          <div className="bv-card-static p-6">
            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4 flex items-center gap-2">
              <Bell size={13} /> Notifications
            </h3>
            <TogRow
              label="Booking Alerts"
              desc="New guest bookings & cancellations"
              on={!!settings.notifications.emailBookings}
              fn={() => toggleN('emailBookings')}
            />
            <TogRow
              label="Payment Alerts"
              desc="Incoming payments & refund requests"
              on={!!settings.notifications.emailPayments}
              fn={() => toggleN('emailPayments')}
            />
            <TogRow
              label="Promotions & Tips"
              desc="Platform updates and host tips"
              on={!!settings.notifications.emailPromotions}
              fn={() => toggleN('emailPromotions')}
            />
            <TogRow
              label="SMS Alerts"
              desc="Urgent alerts via SMS"
              on={!!settings.notifications.smsAlerts}
              fn={() => toggleN('smsAlerts')}
            />
            <TogRow
              label="Browser Push"
              desc="Real-time alerts even when the site is closed"
              on={!!settings.notifications.browserPush}
              fn={() => toggleN('browserPush')}
            />
          </div>

          {/* Privacy */}
          <div className="bv-card-static p-6">
            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4 flex items-center gap-2">
              <Shield size={13} /> Privacy
            </h3>
            <TogRow
              label="Public Profile"
              desc="Allow guests to view your host profile"
              on={!!settings.privacy.profilePublic}
              fn={() => toggleP('profilePublic')}
            />
            <TogRow
              label="Show Phone Number"
              desc="Display phone number to guests after booking"
              on={!!settings.privacy.showPhone}
              fn={() => toggleP('showPhone')}
            />
            <TogRow
              label="Show Email Address"
              desc="Display email address to guests after booking"
              on={!!settings.privacy.showEmail}
              fn={() => toggleP('showEmail')}
            />
          </div>

          {/* Save button */}
          <div className="lg:col-span-2 flex justify-end">
            <button
              onClick={handleSaveS}
              disabled={!dirty || savingS}
              className="bv-btn-gold text-sm px-6 py-3 flex items-center gap-2 disabled:opacity-40"
            >
              {savingS
                ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                : <><Save size={14} /> Save All Settings</>}
            </button>
          </div>

          {/* Danger zone */}
          <div className="lg:col-span-2 bv-card-static p-6">
            <h3 className="text-sm font-bold text-[var(--bv-danger)] uppercase tracking-widest mb-5">
              Danger Zone
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 border border-[var(--bv-gold-border)] bg-[var(--bv-gold-glow)] rounded-2xl">
                <p className="text-sm font-bold text-[var(--bv-gold)] mb-1">Deactivate Account</p>
                <p className="text-xs text-[var(--bv-text-dim)] mb-4">
                  Temporarily hide your profile and listings. You can reactivate by logging back in.
                </p>
                <button
                  onClick={() => setDanger('deactivate')}
                  className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
                >
                  <UserX size={14} /> Deactivate
                </button>
              </div>
              <div className="p-5 border border-red-500/20 bg-red-500/5 rounded-2xl">
                <p className="text-sm font-bold text-[var(--bv-danger)] mb-1">Delete Account</p>
                <p className="text-xs text-[var(--bv-text-dim)] mb-4">
                  Permanently delete your account and all data. This cannot be undone.
                </p>
                <button
                  onClick={() => setDanger('delete')}
                  className="text-sm px-4 py-2 rounded-[var(--bv-radius-sm)] bg-[var(--bv-danger)] text-white font-bold flex items-center gap-2 hover:bg-red-600 transition"
                >
                  <Trash2 size={14} /> Delete Forever
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default HostSettings;
