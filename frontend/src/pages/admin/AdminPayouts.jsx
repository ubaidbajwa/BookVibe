/**
 * AdminPayouts.jsx
 *
 * Administrative interface for managing host payouts. Two sections:
 *  - Payment Info: every host's saved bank/wallet details, pending ones first,
 *    with a Verify action (a host cannot request a payout until verified).
 *  - Payouts: payout requests, annotated with the host's destination details
 *    so the admin knows where to actually send the money, with actions to
 *    mark processing / complete (with transaction reference) / reject.
 *
 * @module AdminPayouts
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import useSocket from '../../hooks/useSocket';
import { getAuthConfig } from '../../utils/authConfig';
import {
  DollarSign, CheckCircle, XCircle, Clock, Loader2, RefreshCw,
  Building2, Smartphone, ShieldCheck, ShieldAlert, Wallet, AlertCircle, X,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
};

const statusColors = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  processing: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-600 border-red-500/20',
};

/**
 * Renders a host's destination bank/wallet details.
 *
 * @param {Object} props - Component properties
 * @param {Object|null} props.info - HostPaymentInfo document, or null
 * @returns {JSX.Element}
 */
const PaymentInfoBlock = ({ info }) => {
  if (!info) {
    return (
      <p className="text-xs text-[var(--bv-danger)] font-semibold">No payment info on file</p>
    );
  }
  if (info.paymentMethod === 'bank_transfer') {
    const b = info.bankDetails || {};
    return (
      <div className="flex items-start gap-2">
        <Building2 size={14} className="text-[var(--bv-gold)] mt-0.5" />
        <p className="text-xs text-[var(--bv-text-muted)]">
          <span className="font-semibold text-[var(--bv-text)]">{b.bankName}</span> · {b.accountTitle}<br />
          A/C: {b.accountNumber}{b.iban ? ` · IBAN: ${b.iban}` : ''}{b.branchCode ? ` · Branch: ${b.branchCode}` : ''}
        </p>
      </div>
    );
  }
  const w = info.mobileWallet || {};
  return (
    <div className="flex items-start gap-2">
      <Smartphone size={14} className="text-emerald-500 mt-0.5" />
      <p className="text-xs text-[var(--bv-text-muted)]">
        <span className="font-semibold text-[var(--bv-text)] capitalize">{info.paymentMethod}</span> · {w.accountName}<br />
        {w.phoneNumber}
      </p>
    </div>
  );
};

/**
 * AdminPayouts Component.
 *
 * @returns {JSX.Element}
 */
const AdminPayouts = () => {
  /** @type {[string, Function]} Active section: 'payouts' or 'payment-info' */
  const [tab, setTab] = useState('payouts');

  /** @type {[Array, Function]} Full list of payout records returned by the API */
  const [payouts, setPayouts] = useState([]);

  /** @type {[Array, Function]} Every host's saved payment info */
  const [paymentInfos, setPaymentInfos] = useState([]);

  /** @type {[boolean, Function]} Whether the initial fetch or a refresh is in progress */
  const [loading, setLoading] = useState(true);

  /** @type {[string|null, Function]} ID of the payout/host whose action is in-flight */
  const [processing, setProcessing] = useState(null);

  /** @type {[string, Function]} Active payout status filter key */
  const [filter, setFilter] = useState('all');

  /** @type {[string|null, Function]} ID of the payout for which the "Complete Payout" modal is open */
  const [modal, setModal] = useState(null);

  /** @type {[string, Function]} Transaction reference entered by the admin in the modal */
  const [txnRef, setTxnRef] = useState('');

  /** @type {[string, Function]} Optional note entered by the admin in the modal */
  const [txnNote, setTxnNote] = useState('');

  /** @type {[string|null, Function]} Page-level error message */
  const [pageError, setPageError] = useState(null);

  /** @type {[string|null, Function]} Modal-level error for complete payout */
  const [modalError, setModalError] = useState(null);

  /**
   * Fetch payouts and payment info in parallel.
   */
  const fetchAll = async () => {
    try {
      setLoading(true);
      const [payoutsRes, infoRes] = await Promise.all([
        axios.get(`${BASE}/host-payments/admin/payouts`, getAuthConfig()),
        axios.get(`${BASE}/host-payments/admin/payment-info`, getAuthConfig()),
      ]);
      if (payoutsRes.data.success) setPayouts(payoutsRes.data.payouts || []);
      if (infoRes.data.success) setPaymentInfos(infoRes.data.paymentInfos || []);
      setPageError(null);
    } catch {
      setPageError('Failed to load payout data. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Live refresh when a host requests a new payout or submits/updates payment info,
  // instead of the admin needing to click Refresh to see it.
  useSocket({
    onPayoutRequested: () => fetchAll(),
    onPaymentInfoSubmitted: () => fetchAll(),
  });

  /**
   * Mark a payout as processing or failed — no transaction reference involved.
   *
   * @param {string} id - The payout ID.
   * @param {'processing'|'failed'} status - The new status.
   */
  const handleQuickAction = async (id, status) => {
    try {
      setProcessing(id);
      const res = await axios.patch(
        `${BASE}/host-payments/admin/payouts/${id}`,
        { status },
        getAuthConfig()
      );
      if (res.data.success) {
        fetchAll();
      }
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to update payout status. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  /**
   * Complete the payout currently open in the modal, attaching the entered
   * transaction reference and note.
   */
  const handleCompletePayout = async () => {
    if (!txnRef.trim()) return;
    try {
      setProcessing(modal);
      const res = await axios.patch(
        `${BASE}/host-payments/admin/payouts/${modal}`,
        { status: 'completed', transactionRef: txnRef, transactionNote: txnNote },
        getAuthConfig()
      );
      if (res.data.success) {
        setModal(null);
        setTxnRef('');
        setTxnNote('');
        setModalError(null);
        fetchAll();
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to complete payout. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  /**
   * Verify a host's saved payment info, unblocking them to request payouts.
   *
   * @param {string} hostId - The host's ID.
   */
  const handleVerifyPaymentInfo = async (hostId) => {
    try {
      setProcessing(hostId);
      const res = await axios.patch(
        `${BASE}/host-payments/admin/verify/${hostId}`,
        {},
        getAuthConfig()
      );
      if (res.data.success) {
        fetchAll();
      }
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to verify payment info. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  // Filter the payout list based on the active status tab
  const filteredPayouts = filter === 'all' ? payouts : payouts.filter((p) => p.status === filter);

  const completedPayouts = payouts.filter((p) => p.status === 'completed');
  const stats = {
    total: payouts.length,
    pending: payouts.filter((p) => p.status === 'pending').length,
    processing: payouts.filter((p) => p.status === 'processing').length,
    completed: completedPayouts.length,
    totalAmount: completedPayouts.reduce((s, p) => s + (p.netAmount || 0), 0),
    totalCommission: completedPayouts.reduce((s, p) => s + (p.platformFee || 0), 0),
  };

  const pendingInfoCount = paymentInfos.filter((i) => !i.isVerified).length;

  return (
    <div className="space-y-6">
      {pageError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/15">
          <AlertCircle size={15} className="text-[var(--bv-danger)] flex-shrink-0" />
          <p className="text-sm text-[var(--bv-danger)] flex-1">{pageError}</p>
          <button onClick={() => setPageError(null)} className="text-[var(--bv-danger)] opacity-60 hover:opacity-100 flex-shrink-0 transition">
            <X size={14} />
          </button>
        </div>
      )}
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)] flex items-center gap-2">
            <DollarSign size={26} className="text-[var(--bv-gold)]" /> Payout Management
          </h1>
          <p className="text-sm text-[var(--bv-text-dim)] mt-1">
            Verify host payment methods and process payout requests
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab('payouts')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            tab === 'payouts'
              ? 'bg-[var(--bv-gold)] text-[var(--bv-text-inverse)]'
              : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)]'
          }`}
        >
          Payouts
        </button>
        <button
          onClick={() => setTab('payment-info')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
            tab === 'payment-info'
              ? 'bg-[var(--bv-gold)] text-[var(--bv-text-inverse)]'
              : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)]'
          }`}
        >
          Payment Info
          {pendingInfoCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--bv-danger)] text-white">
              {pendingInfoCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'payouts' ? (
        <>
          {/* Summary stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Requests', value: stats.total, color: 'text-[var(--bv-text)]' },
              { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
              { label: 'Processing', value: stats.processing, color: 'text-blue-600' },
              { label: 'Completed', value: stats.completed, color: 'text-emerald-600' },
              { label: 'Total Paid Out', value: `PKR ${stats.totalAmount.toLocaleString()}`, color: 'text-[var(--bv-gold)]' },
              { label: 'Platform Commission', value: `PKR ${stats.totalCommission.toLocaleString()}`, color: 'text-amber-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bv-card p-4 text-center">
                <p className="text-[10px] text-[var(--bv-text-dim)] uppercase font-bold tracking-wider">{label}</p>
                <p className={`text-xl font-black ${color} mt-1`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'processing', 'completed', 'failed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition ${
                  filter === f
                    ? 'bg-[var(--bv-gold)] text-[var(--bv-text-inverse)]'
                    : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Payouts list */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <div key={i} className="bv-skeleton h-40 rounded-2xl" />)}
            </div>
          ) : filteredPayouts.length === 0 ? (
            <div className="bv-card-static py-16 text-center">
              <DollarSign size={40} className="mx-auto text-[var(--bv-text-dim)] opacity-20 mb-3" />
              <p className="text-[var(--bv-text-muted)]">
                No payout requests{filter !== 'all' ? ` with status "${filter}"` : ''}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayouts.map((p) => {
                const host = p.hostId;
                return (
                  <div key={p._id} className="bv-card p-5">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      {/* Host information */}
                      <div className="flex items-center gap-3">
                        {host?.profileImage?.url ? (
                          <img src={host.profileImage.url} alt="" className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[var(--bv-gold-glow)] flex items-center justify-center text-[var(--bv-gold)] font-bold">
                            {host?.username?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-[var(--bv-text)]">{host?.username}</p>
                          <p className="text-xs text-[var(--bv-text-dim)]">{host?.email}</p>
                        </div>
                      </div>

                      {/* Amount and status */}
                      <div className="text-right">
                        <p className="text-xl font-bold text-[var(--bv-gold)]">PKR {p.netAmount?.toLocaleString()}</p>
                        <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                          Gross: PKR {p.amount?.toLocaleString()} | Fee: PKR {p.platformFee?.toLocaleString()}
                        </p>
                        <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold capitalize border ${statusColors[p.status]}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>

                    {/* Destination payment details */}
                    <div className="mt-4 p-3 bg-[var(--bv-surface)] border border-[var(--bv-border)] rounded-xl">
                      <PaymentInfoBlock info={p.paymentInfo} />
                    </div>

                    {/* Date and existing transaction ref */}
                    <div className="mt-3 flex items-center gap-3 text-xs text-[var(--bv-text-dim)]">
                      <span>{fmtDate(p.createdAt)}</span>
                      {p.transactionRef && (
                        <span className="ml-auto font-semibold text-emerald-600">Ref: {p.transactionRef}</span>
                      )}
                    </div>

                    {/* Action buttons for pending payouts */}
                    {p.status === 'pending' && (
                      <div className="mt-4 flex gap-3 flex-wrap">
                        <button
                          onClick={() => handleQuickAction(p._id, 'processing')}
                          disabled={processing === p._id}
                          className="bv-btn-outline text-xs px-4 py-2.5 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {processing === p._id ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />} Mark Processing
                        </button>
                        <button
                          onClick={() => setModal(p._id)}
                          className="bv-btn-gold text-xs px-4 py-2.5 flex items-center gap-1.5"
                        >
                          <CheckCircle size={13} /> Complete Payout
                        </button>
                        <button
                          onClick={() => handleQuickAction(p._id, 'failed')}
                          disabled={processing === p._id}
                          className="text-xs px-4 py-2.5 rounded-xl font-bold text-[var(--bv-danger)] border border-[var(--bv-danger)]/30 hover:bg-[var(--bv-danger)]/10 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                    )}

                    {/* Action buttons for processing payouts */}
                    {p.status === 'processing' && (
                      <div className="mt-4 flex gap-3 flex-wrap">
                        <button
                          onClick={() => setModal(p._id)}
                          className="bv-btn-gold text-xs px-4 py-2.5 flex items-center gap-1.5"
                        >
                          <CheckCircle size={13} /> Complete Payout
                        </button>
                        <button
                          onClick={() => handleQuickAction(p._id, 'failed')}
                          disabled={processing === p._id}
                          className="text-xs px-4 py-2.5 rounded-xl font-bold text-[var(--bv-danger)] border border-[var(--bv-danger)]/30 hover:bg-[var(--bv-danger)]/10 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle size={13} /> Mark Failed
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Payment info list */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <div key={i} className="bv-skeleton h-28 rounded-2xl" />)}
            </div>
          ) : paymentInfos.length === 0 ? (
            <div className="bv-card-static py-16 text-center">
              <Wallet size={40} className="mx-auto text-[var(--bv-text-dim)] opacity-20 mb-3" />
              <p className="text-[var(--bv-text-muted)]">No hosts have added payment info yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentInfos.map((info) => (
                <div key={info._id} className="bv-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[var(--bv-text)]">{info.hostId?.username || '—'}</p>
                      {info.isVerified ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <ShieldCheck size={12} /> Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                          <ShieldAlert size={12} /> Pending Verification
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--bv-text-dim)] mb-2">{info.hostId?.email}</p>
                    <PaymentInfoBlock info={info} />
                  </div>
                  {!info.isVerified && (
                    <button
                      onClick={() => handleVerifyPaymentInfo(info.hostId?._id)}
                      disabled={processing === info.hostId?._id}
                      className="bv-btn-gold text-xs px-4 py-2.5 flex items-center gap-1.5 self-start disabled:opacity-50"
                    >
                      {processing === info.hostId?._id ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Verify
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Complete Payout modal — collects transaction reference before confirming */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bv-card-static p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-[var(--bv-text)] mb-4">Complete Payout</h3>
            <p className="text-sm text-[var(--bv-text-dim)] mb-5">
              Enter the transaction reference after transferring the amount to the host.
            </p>

            <div className="space-y-4">
              <div>
                <label className="bv-label">Transaction Reference *</label>
                <input
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                  placeholder="TXN123456789"
                  className="bv-input"
                />
              </div>
              <div>
                <label className="bv-label">Note (optional)</label>
                <textarea
                  value={txnNote}
                  onChange={(e) => setTxnNote(e.target.value)}
                  placeholder="Bank transfer via HBL"
                  rows={2}
                  className="bv-input resize-none"
                />
              </div>
            </div>

            {modalError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/15 mt-4">
                <AlertCircle size={13} className="text-[var(--bv-danger)] flex-shrink-0" />
                <p className="text-xs text-[var(--bv-danger)] flex-1">{modalError}</p>
                <button onClick={() => setModalError(null)} className="text-[var(--bv-danger)] opacity-60 hover:opacity-100 transition">
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCompletePayout}
                disabled={!txnRef.trim() || processing === modal}
                className="bv-btn-gold flex-1 text-sm px-4 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing === modal ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Confirm Transfer
              </button>
              <button
                onClick={() => {
                  setModal(null);
                  setTxnRef('');
                  setTxnNote('');
                  setModalError(null);
                }}
                className="bv-btn-outline text-sm px-4 py-2.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayouts;
