/**
 * AdminGate.jsx
 *
 * A specialized security gateway component that acts as a second layer of
 * authentication for the Admin Panel. It requires a 6-digit security PIN
 * from authorized admin users before granting access to sensitive routes.
 * Verified state is persisted in sessionStorage for the duration of the browser session.
 *
 * @module AdminGate
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { getAuthConfig } from '../../utils/authConfig';
import { Shield, Lock, Loader2, AlertTriangle, Sparkles } from 'lucide-react';

/* ── CONSTANTS ── */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || 'ctrl-bv5ap6';

/**
 * AdminGate Component.
 *
 * @returns {JSX.Element|null}
 */
const AdminGate = () => {
  const nav = useNavigate();
  const { user } = useSelector((s) => {
    return s.auth;
  });

  // The nested user object returned by the auth slice
  const u = user?.user;

  /* ── STATE MANAGEMENT ── */

  /** @type {[string[], Function]} Array of 6 single-digit strings forming the PIN */
  const [pin, setPin] = useState(['', '', '', '', '', '']);

  /** @type {[boolean, Function]} Whether the PIN verification request is in-flight */
  const [loading, setLoading] = useState(false);

  /** @type {[string, Function]} Error message displayed beneath the PIN inputs */
  const [error, setError] = useState('');

  /** @type {[number, Function]} Count of consecutive failed verification attempts */
  const [attempts, setAttempts] = useState(0);

  /** @type {[boolean, Function]} Whether the gate is temporarily locked after too many failures */
  const [locked, setLocked] = useState(false);

  // Refs for each individual PIN digit input to allow programmatic focus
  const inputRefs = useRef([]);

  /* ── EFFECTS ── */

  /**
   * Effect: Redirect non-admin users away from this page immediately.
   */
  useEffect(
    () => {
      if (!u || u.role !== 'admin') {
        // Not an admin — send to the unauthorised page
        nav('/unauthorized', { replace: true });
      }
    },
    // Dependencies: Re-check when user or navigate function changes
    [u, nav]
  );

  /**
   * Effect: Skip the gate if the session already carries a valid gate token.
   */
  useEffect(
    () => {
      const gateToken = sessionStorage.getItem('bv_admin_gate');
      if (gateToken && gateToken.startsWith('eyJ')) {
        nav(`/${ADMIN_PATH}/dashboard`, { replace: true });
      }
    },
    [nav]
  );

  /**
   * Effect: Lock the gate for 5 minutes after 5 consecutive failed attempts.
   */
  useEffect(
    () => {
      if (attempts >= 5) {
        setLocked(true);
        setError('Too many failed attempts. Locked for 5 minutes.');

        // Auto-unlock after 5 minutes (300,000 ms)
        const timer = setTimeout(() => {
          setLocked(false);
          setAttempts(0);
          setError('');
        }, 5 * 60 * 1000);

        // Cleanup: cancel the timer if the component unmounts
        return () => {
          return clearTimeout(timer);
        };
      }
    },
    // Dependencies: Re-run whenever the failure count increases
    [attempts]
  );

  /* ── EVENT HANDLERS ── */

  /**
   * Handle input change for a single digit cell.
   *
   * @param {number} index - Index of the PIN cell.
   * @param {string} value - The input value.
   */
  const handleChange = (index, value) => {
    if (locked) {
      return;
    }

    // Strip any non-numeric characters; take only the last digit if multiple were pasted
    const digit = value.replace(/\D/g, '').slice(-1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);
    setError('');

    // Auto-advance focus to the next cell after a digit is entered
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when the final (6th) cell is filled
    if (digit && index === 5) {
      const fullPin = newPin.join('');
      if (fullPin.length === 6) {
        handleVerify(fullPin);
      }
    }
  };

  /**
   * Handle keyboard navigation: backspace on an empty cell focuses the previous cell.
   *
   * @param {number} index - Index of the PIN cell.
   * @param {Object} e - Keyboard event.
   */
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Handle paste: extract up to 6 digits and auto-submit if a complete PIN is pasted.
   *
   * @param {Object} e - Clipboard event.
   */
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

    if (pasted.length === 6) {
      const newPin = pasted.split('');
      setPin(newPin);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  /**
   * Submit the PIN to the backend for verification.
   *
   * @param {string} fullPin - The full 6-digit PIN.
   */
  const handleVerify = async (fullPin) => {
    if (locked || loading) {
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(
        `${BASE}/user/admin/verify-pin`,
        { pin: fullPin },
        getAuthConfig()
      );

      if (res.data.success && res.data.gateToken) {
        sessionStorage.setItem('bv_admin_gate', res.data.gateToken);
        nav(`/${ADMIN_PATH}/dashboard`, { replace: true });
      }
    } catch (err) {
      setAttempts((prev) => {
        return prev + 1;
      });
      setError(err.response?.data?.message || 'Invalid PIN');

      // Clear all cells and refocus the first input for re-entry
      setPin(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  /* ── RENDER ── */

  // Render nothing while redirecting non-admin users
  if (!u || u.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bv-bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* BookVibe logo mark */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center mx-auto shadow-[var(--bv-shadow-gold)] mb-4">
            <Sparkles size={24} className="text-[var(--bv-text-inverse)]" />
          </div>
          <h1 className="font-display text-2xl text-[var(--bv-text)]">
            Book<span className="text-[var(--bv-gold)]">Vibe</span>
          </h1>
        </div>

        <div className="bv-card-static p-8">
          {/* Gate heading */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-[var(--bv-gold)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--bv-text)]">Admin Verification</h2>
            <p className="text-sm text-[var(--bv-text-muted)] mt-2">
              Enter your 6-digit security PIN to access the admin panel
            </p>
          </div>

          {/* 6-cell PIN input row */}
          <div
            className="flex justify-center gap-3 mb-6"
            onPaste={handlePaste}
          >
            {pin.map((digit, i) => {
              return (
                <input
                  key={i}
                  ref={(el) => {
                    return (inputRefs.current[i] = el);
                  }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    return handleChange(i, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    return handleKeyDown(i, e);
                  }}
                  disabled={locked || loading}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all duration-200 bg-[var(--bv-bg-raised)] text-[var(--bv-text)] ${
                    error
                      ? 'border-[var(--bv-danger)] shake'
                      : digit
                      ? 'border-[var(--bv-gold)] shadow-[0_0_0_3px_var(--bv-gold-glow)]'
                      : 'border-[var(--bv-border)] focus:border-[var(--bv-gold)] focus:shadow-[0_0_0_3px_var(--bv-gold-glow)]'
                  } disabled:opacity-40`}
                  autoFocus={i === 0}
                />
              );
            })}
          </div>

          {/* In-flight verification indicator */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-3 text-[var(--bv-gold)] text-sm">
              <Loader2 size={16} className="animate-spin" />
              Verifying...
            </div>
          )}

          {/* Error message (wrong PIN or lockout notice) */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[var(--bv-danger)] text-sm mb-4">
              <AlertTriangle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Remaining attempts counter (only shown between 1 and 4 failures) */}
          {attempts > 0 && attempts < 5 && (
            <p className="text-xs text-[var(--bv-text-dim)] text-center mb-4">
              {5 - attempts} attempts remaining
            </p>
          )}

          {/* Manual submit button (fallback to auto-submit on 6th digit) */}
          <button
            onClick={() => {
              return handleVerify(pin.join(''));
            }}
            disabled={pin.join('').length !== 6 || loading || locked}
            className="w-full bv-btn-gold py-3.5 text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Lock size={16} /> Verify &amp; Enter
          </button>

          {/* Security disclaimer */}
          <div className="mt-5 p-3 bg-[var(--bv-surface)] rounded-xl">
            <p className="text-[10px] text-[var(--bv-text-dim)] leading-relaxed text-center">
              This is a restricted area. All access attempts are logged.
              Unauthorized access is a violation of terms.
            </p>
          </div>
        </div>

        {/* Logged-in user indicator */}
        <p className="text-center text-xs text-[var(--bv-text-dim)] mt-6">
          Logged in as{' '}
          <span className="text-[var(--bv-text-muted)] font-semibold">{u?.email}</span>
        </p>
      </div>
    </div>
  );
};

export default AdminGate;
