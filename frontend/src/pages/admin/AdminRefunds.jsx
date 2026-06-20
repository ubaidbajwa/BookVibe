/**
 * AdminRefunds.jsx
 *
 * Administrative interface for processing guest refund requests.
 * Lists bookings with an active refund status and lets the admin
 * complete (trigger the Stripe refund / offline cash refund) or
 * reject each request.
 *
 * @module AdminRefunds
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getAuthConfig } from '../../utils/authConfig';
import {
  Undo2, CheckCircle, XCircle, Clock, Loader2, RefreshCw, ShieldCheck, ImageOff, AlertCircle, X,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
};

const statusColors = {
  requested: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  processing: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
};

/**
 * AdminRefunds Component.
 *
 * @returns {JSX.Element}
 */
const AdminRefunds = () => {
  /** @type {[Array, Function]} Bookings with an active refund status */
  const [refunds, setRefunds] = useState([]);

  /** @type {[boolean, Function]} Whether the initial fetch or a refresh is in progress */
  const [loading, setLoading] = useState(true);

  /** @type {[string|null, Function]} ID of the refund currently being processed */
  const [processing, setProcessing] = useState(null);

  /** @type {[string, Function]} Active status filter key */
  const [filter, setFilter] = useState('all');

  /** @type {[string|null, Function]} Page-level error message */
  const [pageError, setPageError] = useState(null);

  /**
   * Fetch all bookings with an active refund status from the admin endpoint.
   */
  const fetchRefunds = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE}/booking/admin/refunds?limit=100`, getAuthConfig());
      if (res.data.success) {
        setRefunds(res.data.refunds || []);
      }
      setPageError(null);
    } catch {
      setPageError('Failed to load refund requests. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  /**
   * Complete or reject a refund request.
   *
   * @param {string} id - Booking ID.
   * @param {'completed'|'rejected'} status - New status to apply.
   */
  const handleProcess = async (id, status) => {
    try {
      setProcessing(id);
      const res = await axios.patch(
        `${BASE}/booking/admin/refund/${id}`,
        { status },
        getAuthConfig()
      );
      if (res.data.success) {
        fetchRefunds();
      }
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to process refund. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const filtered = filter === 'all' ? refunds : refunds.filter((r) => r.refundStatus === filter);

  const stats = {
    requested: refunds.filter((r) => r.refundStatus === 'requested').length,
    processing: refunds.filter((r) => r.refundStatus === 'processing').length,
    approved: refunds.filter((r) => r.refundStatus === 'approved').length,
    rejected: refunds.filter((r) => r.refundStatus === 'rejected').length,
    totalRefunded: refunds
      .filter((r) => r.refundStatus === 'approved')
      .reduce((s, r) => s + (r.refundAmount || r.totalPrice || 0), 0),
  };

  return (
    <div className="space-y-8">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">
            Refund <span className="text-[var(--bv-gold)]">Requests</span>
          </h1>
          <p className="text-sm text-[var(--bv-text-dim)] mt-1">
            Process or reject guest cancellation refunds
          </p>
        </div>
        <button
          onClick={fetchRefunds}
          disabled={loading}
          className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Requested', value: stats.requested, color: 'text-amber-600', icon: Clock },
          { label: 'Processing', value: stats.processing, color: 'text-blue-600', icon: Loader2 },
          { label: 'Approved', value: stats.approved, color: 'text-emerald-600', icon: CheckCircle },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-600', icon: XCircle },
          { label: 'Total Refunded', value: `PKR ${stats.totalRefunded.toLocaleString()}`, color: 'text-[var(--bv-gold)]', icon: ShieldCheck },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bv-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--bv-text-dim)]">
                  {label}
                </p>
                <p className={`text-xl font-black ${color} mt-1`}>{value}</p>
              </div>
              <Icon size={20} className={`${color} opacity-40`} />
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'requested', 'processing', 'approved', 'rejected'].map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition ${
              filter === key
                ? 'bg-[var(--bv-gold)] text-[var(--bv-text-inverse)]'
                : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)]'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Refund list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bv-skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : !filtered.length ? (
        <div className="bv-card-static py-20 text-center">
          <Undo2 size={48} className="mx-auto mb-4 text-[var(--bv-text-dim)] opacity-20" />
          <p className="font-bold text-[var(--bv-text-muted)]">
            No refund requests{filter !== 'all' ? ` with status "${filter}"` : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const actionable = r.refundStatus === 'requested' || r.refundStatus === 'processing';
            return (
              <div key={r._id} className="bv-card overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-40 h-32 sm:h-auto flex-shrink-0 relative bg-[var(--bv-surface)]">
                    {r.propertyId?.images?.[0]?.url ? (
                      <img
                        src={r.propertyId.images[0].url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff size={20} className="text-[var(--bv-text-dim)]" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-[var(--bv-text)] truncate">
                          {r.propertyId?.name || 'Property'}
                        </h3>
                        <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                          Guest: {r.userId?.username || '—'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-black text-[var(--bv-gold)]">
                          PKR {r.totalPrice?.toLocaleString()}
                        </p>
                        <span
                          className={`inline-block mt-1 px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border ${
                            statusColors[r.refundStatus] || ''
                          }`}
                        >
                          {r.refundStatus}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      {[
                        { label: 'Check-in', value: fmtDate(r.checkIn) },
                        { label: 'Check-out', value: fmtDate(r.checkOut) },
                        {
                          label: 'Payment',
                          value: `${r.paymentMethod === 'arrival' ? 'Cash' : 'Card'} · ${r.paymentStatus}`,
                        },
                        {
                          label: 'Refund Amount',
                          value: `PKR ${(r.refundAmount || r.totalPrice)?.toLocaleString()} (${r.refundPercent || 100}%)`,
                          highlight: true,
                        },
                      ].map(({ label, value, highlight }) => (
                        <div
                          key={label}
                          className="p-2 rounded-lg bg-[var(--bv-bg)] border border-[var(--bv-border)]"
                        >
                          <p className="text-[9px] font-bold uppercase text-[var(--bv-text-dim)]">
                            {label}
                          </p>
                          <p
                            className={`text-xs font-${
                              highlight ? 'bold text-amber-500' : 'semibold text-[var(--bv-text)]'
                            } mt-0.5`}
                          >
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {r.refundReason && (
                      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 mb-3">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mb-1">
                          Guest Reason
                        </p>
                        <p className="text-sm text-[var(--bv-text-muted)]">{r.refundReason}</p>
                      </div>
                    )}

                    {r.refundRejectedReason && (
                      <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15 mb-3">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-red-600 mb-1">
                          Host Rejection Reason
                        </p>
                        <p className="text-sm text-[var(--bv-text-muted)]">{r.refundRejectedReason}</p>
                      </div>
                    )}

                    {r.refundResolvedAt && (
                      <p className="text-[10px] text-[var(--bv-text-dim)] mb-3">
                        Resolved on {fmtDate(r.refundResolvedAt)}
                      </p>
                    )}

                    {actionable && (
                      <div className="flex gap-2 pt-3 border-t border-[var(--bv-divider)]">
                        <button
                          onClick={() => handleProcess(r._id, 'completed')}
                          disabled={processing === r._id}
                          className="bv-btn-gold text-xs px-4 py-2.5 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {processing === r._id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <CheckCircle size={12} />
                          )}
                          {r.refundStatus === 'processing' ? 'Retry Refund' : 'Process Refund'}
                        </button>
                        <button
                          onClick={() => handleProcess(r._id, 'rejected')}
                          disabled={processing === r._id}
                          className="bv-btn-outline text-xs px-4 py-2.5 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminRefunds;
