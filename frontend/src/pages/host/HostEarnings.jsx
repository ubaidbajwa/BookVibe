/**
 * @file HostEarnings.jsx
 * @description Page for hosts to manage their earnings, payouts, and payment information.
 * Supports parallel data fetching, payment method updates, and payout requests.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import useSocket from '../../hooks/useSocket';
import { getAuthConfig } from '../../utils/authConfig';
import {
  DollarSign,
  CreditCard,
  Banknote,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  Smartphone,
  Loader2,
  Wallet,
  PiggyBank,
  AlertTriangle,
  RefreshCw,
  Lock,
  Undo2,
} from 'lucide-react';

/**
 * @section Constants
 */

/** @type {string} Base URL for API requests. */
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * @component HostEarnings
 * @description Comprehensive interface for host financial management.
 * 
 * @returns {JSX.Element} The rendered HostEarnings component.
 */
const HostEarnings = () => {
  /**
   * @section State Management
   */

  /** 
   * @type {[Object|null, Function]} Aggregated earnings data returned by the API.
   */
  const [earnings, setEarnings] = useState(null);

  /** 
   * @type {[Object|null, Function]} Saved payment method info (bank or mobile wallet).
   */
  const [paymentInfo, setPaymentInfo] = useState(null);

  /** 
   * @type {[Array, Function]} Payout request history.
   */
  const [payouts, setPayouts] = useState([]);

  /** 
   * @type {[boolean, Function]} True while the initial parallel fetch is in-flight.
   */
  const [loading, setLoading] = useState(true);

  /** 
   * @type {[boolean, Function]} True while saving payment details.
   */
  const [saving, setSaving] = useState(false);

  /** 
   * @type {[boolean, Function]} True while a payout request is being submitted.
   */
  const [requesting, setRequesting] = useState(false);

  /** 
   * @type {[boolean, Function]} Controls whether the payment method add/edit form is visible.
   */
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  /** @type {[string, Function]} Payment method type ('bank_transfer', 'easypaisa', 'jazzcash'). */
  const [method, setMethod] = useState('bank_transfer');

  /** @type {[string, Function]} Bank name field. */
  const [bankName, setBankName] = useState('');

  /** @type {[string, Function]} Account title field. */
  const [accountTitle, setAccountTitle] = useState('');

  /** @type {[string, Function]} Account number field. */
  const [accountNumber, setAccountNumber] = useState('');

  /** @type {[string, Function]} IBAN field. */
  const [iban, setIban] = useState('');

  /** @type {[string, Function]} Branch code field. */
  const [branchCode, setBranchCode] = useState('');

  /** @type {[string, Function]} Mobile wallet account name field. */
  const [walletName, setWalletName] = useState('');

  /** @type {[string, Function]} Mobile wallet phone number field. */
  const [walletPhone, setWalletPhone] = useState('');

  /**
   * @section Handlers
   */

  /**
   * Fetches earnings summary, payment info, and payout history in parallel.
   * 
   * @async
   * @function fetchAll
   * @returns {Promise<void>}
   */
  const fetchAll = async () => {
    try {
      setLoading(true);
      const [eRes, pRes, payRes] = await Promise.all([
        axios.get(`${BASE}/host-payments/earnings`, getAuthConfig()),
        axios.get(`${BASE}/host-payments/payment-info`, getAuthConfig()),
        axios.get(`${BASE}/host-payments/payouts`, getAuthConfig()),
      ]);

      if (eRes.data.success) {
        setEarnings(eRes.data.earnings);
      }

      if (pRes.data.success && pRes.data.paymentInfo) {
        const pi = pRes.data.paymentInfo;
        setPaymentInfo(pi);
        setMethod(pi.paymentMethod || 'bank_transfer');

        if (pi.bankDetails) {
          setBankName(pi.bankDetails.bankName || '');
          setAccountTitle(pi.bankDetails.accountTitle || '');
          setAccountNumber(pi.bankDetails.accountNumber || '');
          setIban(pi.bankDetails.iban || '');
          setBranchCode(pi.bankDetails.branchCode || '');
        }

        if (pi.mobileWallet) {
          setWalletName(pi.mobileWallet.accountName || '');
          setWalletPhone(pi.mobileWallet.phoneNumber || '');
        }
      }

      if (payRes.data.success) {
        setPayouts(payRes.data.payouts || []);
      }
    } catch {
      // error silently handled
    } finally {
      setLoading(false);
    }
  };

  /**
   * @section Effects
   */

  /**
   * Fetch all required data on component mount.
   */
  useEffect(
    () => {
      /** Setup: Initial data fetch */
      fetchAll();

      /** Cleanup */
      return () => {
        // No cleanup needed
      };
    },
    /** Dependencies */
    []
  );

  /**
   * Live refresh: when admin verifies payment info or a payout's status changes,
   * refetch immediately instead of waiting for a manual Refresh click.
   */
  useSocket({
    onPaymentInfoVerified: () => fetchAll(),
    onPayoutUpdated: () => fetchAll(),
  });

  /**
   * Save or update the host's payment method details.
   * 
   * @async
   * @function handleSavePayment
   * @param {Event} e - Form submit event
   * @returns {Promise<void>}
   */
  const handleSavePayment = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const body = { paymentMethod: method };

      if (method === 'bank_transfer') {
        body.bankDetails = { bankName, accountTitle, accountNumber, iban, branchCode };
      } else {
        body.mobileWallet = {
          accountName: walletName,
          phoneNumber: walletPhone,
          provider: method,
        };
      }

      const res = await axios.post(
        `${BASE}/host-payments/payment-info`,
        body,
        getAuthConfig()
      );

      if (res.data.success) {
        setPaymentInfo(res.data.paymentInfo);
        setShowPaymentForm(false);
      }
    } catch {
      // error silently handled
    } finally {
      setSaving(false);
    }
  };

  /**
   * Request a payout of available funds.
   * 
   * @async
   * @function handleRequestPayout
   * @returns {Promise<void>}
   */
  const handleRequestPayout = async () => {
    if (requesting) {
      return;
    }
    try {
      setRequesting(true);
      const res = await axios.post(
        `${BASE}/host-payments/request-payout`,
        {},
        getAuthConfig()
      );
      if (res.data.success) {
        fetchAll();
      }
    } catch {
      // error silently handled
    } finally {
      setRequesting(false);
    }
  };

  /**
   * @section Styling Configs
   */

  /** 
   * Status color map for payout badges.
   * @type {Object.<string, string>}
   */
  const statusColor = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  /**
   * @section Render Guards
   */

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => {
          return (
            <div key={i} className="bv-skeleton h-40 rounded-2xl" />
          );
        })}
      </div>
    );
  }

  /**
   * @section Render
   */

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-2">
            <PiggyBank size={26} className="text-[var(--bv-gold)]" /> Earnings &{' '}
            <span className="text-[var(--bv-gold)]">Payouts</span>
          </h1>
          <p className="text-sm text-[var(--bv-text-dim)] mt-1">
            Track your revenue and manage payouts
          </p>
        </div>
        <button
          onClick={() => {
            return fetchAll();
          }}
          className="bv-btn-outline text-xs px-4 py-2 flex items-center gap-1.5"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Earnings KPI cards ── */}
      {earnings && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Earned',
              value: earnings.totalEarned,
              icon: DollarSign,
              color: 'text-emerald-400',
            },
            {
              label: `Platform Fee (${earnings.platformFeePercent}%)`,
              value: earnings.platformFees,
              icon: Building2,
              color: 'text-[var(--bv-gold)]',
            },
            {
              label: 'Net Earnings',
              value: earnings.netEarnings,
              icon: TrendingUp,
              color: 'text-emerald-400',
            },
            {
              label: 'Available for Payout',
              value: earnings.availableForPayout,
              icon: Wallet,
              color: 'text-amber-400',
              caption: 'Excludes cash bookings, escrowed amounts & debt',
            },
          ].map(({ label, value, icon: Icon, color, caption }) => {
            return (
              <div key={label} className="bv-card p-5">
                <div className="w-10 h-10 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] flex items-center justify-center mb-3">
                  <Icon size={18} className={color} />
                </div>
                <p className="text-[9px] font-bold text-[var(--bv-text-dim)] uppercase tracking-wider">
                  {label}
                </p>
                <p className={`text-xl font-black ${color} mt-1`}>
                  PKR {value?.toLocaleString()}
                </p>
                {caption && (
                  <p className="text-[10px] text-[var(--bv-text-dim)] mt-1 leading-tight">
                    {caption}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Secondary stats (escrow / pending / paid out) ── */}
      {earnings && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bv-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Lock size={18} className="text-purple-400" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-[var(--bv-text-dim)] uppercase">
                Held in Escrow
              </p>
              <p className="text-lg font-bold text-purple-400">
                PKR {earnings.heldInEscrow?.toLocaleString()}
              </p>
              <p className="text-[9px] text-[var(--bv-text-dim)]">Releases 24h after checkout</p>
            </div>
          </div>
          <div className="bv-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Clock size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-[var(--bv-text-dim)] uppercase">
                Pending Payouts
              </p>
              <p className="text-lg font-bold text-blue-400">
                PKR {earnings.pendingPayout?.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bv-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-[var(--bv-text-dim)] uppercase">
                Total Paid Out
              </p>
              <p className="text-lg font-bold text-emerald-400">
                PKR {earnings.totalPaidOut?.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Outstanding cash-commission debt warning ── */}
      {earnings?.outstandingDebt > 0 && (
        <div className="flex items-start gap-3 p-5 rounded-2xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[var(--bv-text)]">
              PKR {earnings.outstandingDebt.toLocaleString()} commission owed on cash bookings
            </p>
            <p className="text-xs text-[var(--bv-text-dim)] mt-1">
              You collected this directly from guests who paid cash on arrival. It's automatically
              deducted from your next Stripe payout.
            </p>
          </div>
        </div>
      )}

      {/* ── Commission breakdown — where the 10% platform fee actually came from ── */}
      {earnings && (
        <div className="bv-card p-6">
          <h2 className="text-lg font-bold text-[var(--bv-text)] mb-1 flex items-center gap-2">
            <Building2 size={18} className="text-[var(--bv-gold)]" /> Commission Breakdown
          </h2>
          <p className="text-xs text-[var(--bv-text-dim)] mb-5">
            How your {earnings.platformFeePercent}% platform commission is split across payment types
          </p>

          <div className="space-y-3">
            {/* Card / Stripe payments row */}
            <div className="flex items-center justify-between flex-wrap gap-2 p-4 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[var(--bv-gold-glow)] flex items-center justify-center">
                  <CreditCard size={15} className="text-[var(--bv-gold)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--bv-text)]">Card Payments (Stripe)</p>
                  <p className="text-[10px] text-[var(--bv-text-dim)]">Total received, net of any refunds</p>
                </div>
              </div>
              <p className="text-sm font-bold text-[var(--bv-text)]">
                PKR {earnings.stripeTotal?.toLocaleString()}
                <span className="text-[var(--bv-text-dim)] font-normal mx-1.5">=</span>
                <span className="text-[var(--bv-gold)]">PKR {earnings.stripeCommission?.toLocaleString()} commission</span>
              </p>
            </div>

            {/* Cash / Arrival payments row */}
            <div className="flex items-center justify-between flex-wrap gap-2 p-4 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Banknote size={15} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--bv-text)]">Cash Payments (Arrival)</p>
                  <p className="text-[10px] text-[var(--bv-text-dim)]">Collected by hand from guests directly</p>
                </div>
              </div>
              <p className="text-sm font-bold text-[var(--bv-text)]">
                PKR {earnings.cashTotal?.toLocaleString()}
                <span className="text-[var(--bv-text-dim)] font-normal mx-1.5">=</span>
                <span className="text-[var(--bv-gold)]">PKR {earnings.cashCommission?.toLocaleString()} commission</span>
              </p>
            </div>

            {/* Refund commission row — only shown when relevant */}
            {earnings.refundCommission > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-2 p-4 rounded-xl bg-purple-500/5 border border-purple-500/15">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Undo2 size={15} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--bv-text)]">Included: Refund Commission</p>
                    <p className="text-[10px] text-[var(--bv-text-dim)]">
                      Your share of a partially-refunded booking still earns commission
                    </p>
                  </div>
                </div>
                <p className="text-sm font-bold text-purple-400">
                  PKR {earnings.refundCommission?.toLocaleString()}
                </p>
              </div>
            )}

            {/* Grand total */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)]">
              <p className="text-sm font-bold text-[var(--bv-text)]">Total Platform Commission</p>
              <p className="text-lg font-black text-[var(--bv-gold)]">
                PKR {earnings.platformFees?.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Plain-English summary line */}
          <p className="text-xs text-[var(--bv-text-muted)] mt-4 leading-relaxed">
            You collected <span className="font-semibold text-[var(--bv-text)]">PKR {earnings.cashTotal?.toLocaleString()}</span> as
            hand-on cash directly from guests. Excluding that (the platform never holds it), you currently
            have <span className="font-semibold text-[var(--bv-gold)]">PKR {earnings.availableForPayout?.toLocaleString()}</span> available
            to withdraw via payout.
          </p>
        </div>
      )}

      {/* ── Payment method card ── */}
      <div className="bv-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--bv-text)] flex items-center gap-2">
            <CreditCard size={18} className="text-[var(--bv-gold)]" /> Payment Details
          </h2>
          <button
            onClick={() => {
              return setShowPaymentForm((p) => {
                return !p;
              });
            }}
            className="text-sm text-[var(--bv-gold)] font-semibold hover:underline"
          >
            {paymentInfo ? 'Edit' : 'Add Method'}
          </button>
        </div>

        {/* Saved payment info display */}
        {paymentInfo && !showPaymentForm && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)]">
            {paymentInfo.paymentMethod === 'bank_transfer' ? (
              <Building2 size={20} className="text-[var(--bv-gold)]" />
            ) : (
              <Smartphone size={20} className="text-emerald-400" />
            )}
            <div>
              <p className="text-sm font-semibold text-[var(--bv-text)] capitalize">
                {paymentInfo.paymentMethod === 'bank_transfer'
                  ? 'Bank Transfer'
                  : paymentInfo.paymentMethod === 'easypaisa'
                  ? 'EasyPaisa'
                  : 'JazzCash'}
              </p>
              {paymentInfo.paymentMethod === 'bank_transfer' && (
                <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                  {paymentInfo.bankDetails?.bankName} —{' '}
                  {paymentInfo.bankDetails?.accountTitle} — ****
                  {paymentInfo.bankDetails?.accountNumber?.slice(-4)}
                </p>
              )}
              {(paymentInfo.paymentMethod === 'easypaisa' ||
                paymentInfo.paymentMethod === 'jazzcash') && (
                <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                  {paymentInfo.mobileWallet?.accountName} —{' '}
                  {paymentInfo.mobileWallet?.phoneNumber}
                </p>
              )}
            </div>
            <div className="ml-auto">
              {paymentInfo.isVerified ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                  <CheckCircle size={12} /> Verified
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-400">
                  <Clock size={12} /> Pending
                </span>
              )}
            </div>
          </div>
        )}

        {/* No payment method prompt */}
        {!paymentInfo && !showPaymentForm && (
          <div className="text-center py-8">
            <AlertTriangle size={32} className="mx-auto text-amber-400 mb-3" />
            <p className="text-sm text-[var(--bv-text)] font-semibold">
              No payment method added
            </p>
            <p className="text-xs text-[var(--bv-text-dim)] mt-1">
              Add your bank or mobile wallet to receive payouts
            </p>
            <button
              onClick={() => {
                return setShowPaymentForm(true);
              }}
              className="mt-4 bv-btn-gold text-sm px-5 py-2"
            >
              Add Payment Method
            </button>
          </div>
        )}

        {/* Payment method add/edit form */}
        {showPaymentForm && (
          <div className="space-y-5 mt-4">
            {/* Method selector */}
            <div>
              <label className="bv-label">Payment Method</label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[
                  { key: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
                  { key: 'easypaisa', label: 'EasyPaisa', icon: Smartphone },
                  { key: 'jazzcash', label: 'JazzCash', icon: Smartphone },
                ].map(({ key, label, icon: Icon }) => {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        return setMethod(key);
                      }}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition ${
                        method === key
                          ? 'border-[var(--bv-gold)] bg-[var(--bv-gold-glow)] text-[var(--bv-gold)]'
                          : 'border-[var(--bv-border)] text-[var(--bv-text-muted)] hover:border-[var(--bv-gold-border)]'
                      }`}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bank transfer fields */}
            {method === 'bank_transfer' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="bv-label">Bank Name *</label>
                  <input
                    value={bankName}
                    onChange={(e) => {
                      return setBankName(e.target.value);
                    }}
                    required
                    placeholder="HBL, Meezan, UBL..."
                    className="bv-input"
                  />
                </div>
                <div>
                  <label className="bv-label">Account Title *</label>
                  <input
                    value={accountTitle}
                    onChange={(e) => {
                      return setAccountTitle(e.target.value);
                    }}
                    required
                    placeholder="Muhammad Ubaid"
                    className="bv-input"
                  />
                </div>
                <div>
                  <label className="bv-label">Account Number *</label>
                  <input
                    value={accountNumber}
                    onChange={(e) => {
                      return setAccountNumber(e.target.value);
                    }}
                    required
                    placeholder="1234567890"
                    className="bv-input"
                  />
                </div>
                <div>
                  <label className="bv-label">IBAN (optional)</label>
                  <input
                    value={iban}
                    onChange={(e) => {
                      return setIban(e.target.value);
                    }}
                    placeholder="PK36..."
                    className="bv-input"
                  />
                </div>
                <div>
                  <label className="bv-label">Branch Code (optional)</label>
                  <input
                    value={branchCode}
                    onChange={(e) => {
                      return setBranchCode(e.target.value);
                    }}
                    placeholder="0123"
                    className="bv-input"
                  />
                </div>
              </div>
            )}

            {/* Mobile wallet fields */}
            {(method === 'easypaisa' || method === 'jazzcash') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="bv-label">Account Name *</label>
                  <input
                    value={walletName}
                    onChange={(e) => {
                      return setWalletName(e.target.value);
                    }}
                    required
                    placeholder="Muhammad Ubaid"
                    className="bv-input"
                  />
                </div>
                <div>
                  <label className="bv-label">Phone Number *</label>
                  <input
                    value={walletPhone}
                    onChange={(e) => {
                      return setWalletPhone(e.target.value);
                    }}
                    required
                    placeholder="03001234567"
                    className="bv-input"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={(e) => {
                  return handleSavePayment(e);
                }}
                disabled={saving}
                className="bv-btn-gold text-sm px-6 py-2.5 flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Payment Details'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  return setShowPaymentForm(false);
                }}
                className="bv-btn-outline text-sm px-4 py-2.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Request payout CTA ── */}
      {earnings?.availableForPayout > 0 && paymentInfo?.isVerified &&
        !payouts.some((p) => p.status === 'pending' || p.status === 'processing') && (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--bv-gold-border)] bg-[var(--bv-gold-glow)] p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-bold text-[var(--bv-text)]">
                Ready to Withdraw?
              </h3>
              <p className="text-sm text-[var(--bv-text-muted)] mt-1">
                PKR {earnings.availableForPayout?.toLocaleString()} available for
                payout
              </p>
            </div>
            <button
              onClick={() => {
                return handleRequestPayout();
              }}
              disabled={requesting}
              className="bv-btn-gold text-sm px-6 py-3 flex items-center gap-2 disabled:opacity-50"
            >
              {requesting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <Banknote size={16} /> Request Payout
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Payout already in progress notice ── */}
      {earnings?.availableForPayout > 0 &&
        paymentInfo?.isVerified &&
        payouts.some((p) => p.status === 'pending' || p.status === 'processing') && (
          <div className="flex items-start gap-3 p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
            <Clock size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--bv-text)]">Payout already in progress</p>
              <p className="text-xs text-[var(--bv-text-dim)] mt-1">
                You have a pending or processing payout. A new one can be requested once it is completed.
              </p>
            </div>
          </div>
        )}

      {/* ── Warning when funds are available but payment method is not verified ── */}
      {(!paymentInfo || !paymentInfo.isVerified) &&
        earnings?.availableForPayout > 0 && (
          <div className="flex items-start gap-3 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle
              size={20}
              className="text-amber-500 flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--bv-text)]">
                {!paymentInfo
                  ? 'Add your payment details to request payouts'
                  : 'Payment details pending admin verification'}
              </p>
              <p className="text-xs text-[var(--bv-text-dim)] mt-1">
                PKR {earnings.availableForPayout?.toLocaleString()} available but
                cannot withdraw yet.
              </p>
            </div>
          </div>
        )}

      {/* ── Payout history ── */}
      <div className="bv-card p-6">
        <h2 className="text-lg font-bold text-[var(--bv-text)] mb-5 flex items-center gap-2">
          <Clock size={18} className="text-[var(--bv-gold)]" /> Payout History
        </h2>

        {payouts.length === 0 ? (
          <div className="text-center py-10">
            <Wallet
              size={32}
              className="mx-auto text-[var(--bv-text-dim)] opacity-30 mb-3"
            />
            <p className="text-sm text-[var(--bv-text-muted)]">No payouts yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payouts.map((p) => {
              return (
                <div
                  key={p._id}
                  className="flex items-center justify-between p-4 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)]"
                >
                  <div className="flex items-center gap-3">
                    {/* Status icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        p.status === 'completed'
                          ? 'bg-emerald-500/10'
                          : p.status === 'failed'
                          ? 'bg-red-500/10'
                          : 'bg-amber-500/10'
                      }`}
                    >
                      {p.status === 'completed' ? (
                        <CheckCircle size={18} className="text-emerald-400" />
                      ) : p.status === 'failed' ? (
                        <XCircle size={18} className="text-red-400" />
                      ) : (
                        <Clock size={18} className="text-amber-400" />
                      )}
                    </div>

                    {/* Amount + date + ref */}
                    <div>
                      <p className="text-sm font-semibold text-[var(--bv-text)]">
                        PKR {p.netAmount?.toLocaleString()}
                        <span className="text-[10px] font-normal text-[var(--bv-text-dim)] ml-2">
                          (Gross: {p.amount?.toLocaleString()} − Fee: {p.platformFee?.toLocaleString()})
                        </span>
                      </p>
                      <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                        {new Date(p.createdAt).toLocaleDateString('en-PK', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {' · '}
                        {p.paymentMethod === 'bank_transfer'
                          ? 'Bank Transfer'
                          : p.paymentMethod === 'easypaisa'
                          ? 'EasyPaisa'
                          : 'JazzCash'}
                        {p.transactionRef && (
                          <span className="ml-2">· Ref: {p.transactionRef}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize border ${
                      statusColor[p.status] ||
                      'bg-[var(--bv-surface)] text-[var(--bv-text-dim)] border-[var(--bv-border)]'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HostEarnings;
