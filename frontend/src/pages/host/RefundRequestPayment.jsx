/**
 * RefundRequestPayment.jsx
 *
 * Refund request management page for the host panel.
 * Lists all bookings where the guest has requested a refund on cancellation.
 * The host can approve or reject each pending request and provide a reason
 * for rejections. Supports filtering by refund status and shows summary stats.
 *
 * @module RefundRequestPayment
 */

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  getRefundRequests,
  updateRefundStatus,
  resetAccommodationState,
} from '../../redux/slices/accommodationSlice';
import {
  RefreshCw,
  Eye,
  Save,
  CheckCircle,
  XCircle,
  Clock,
  ImageOff,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

// ─── HELPERS ───

/**
 * Badge Component — colour-coded refund status pill.
 * requested → amber "Pending Review", approved → green, rejected → red,
 * none → neutral.
 *
 * @param {Object} props - Component properties
 * @param {string} props.s - Status string
 * @returns {JSX.Element}
 */
const Badge = ({ s }) => {
  const colorMap = {
    requested: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    processing: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    approved: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
    none: 'bg-[var(--bv-surface)] text-[var(--bv-text-dim)] border-[var(--bv-border)]',
  };

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border ${
        colorMap[s] || colorMap.none
      }`}
    >
      {s === 'requested' ? 'Pending Review' : s}
    </span>
  );
};

/**
 * Format an ISO date string to a short locale date string.
 * @param {string} d - ISO date string
 * @returns {string} Formatted date
 */
const fmtDate = (d) => {
  if (!d) {
    return '—';
  }
  return new Date(d).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// ─── CARD SUB-COMPONENT ───

/**
 * Card Component — renders a single refund request with booking details, guest reason,
 * any existing rejection reason, and (for pending requests) a status selector
 * with save and view-booking buttons.
 *
 * Manages its own local status/reason state so edits to one card do not
 * affect others in the list.
 *
 * @param {Object} props - Component properties
 * @param {Object} props.r - Refund request object
 * @param {boolean} props.actionLoading - Global action loading state
 * @param {Function} props.onSave - Save callback
 * @param {Function} props.nav - Navigation function
 * @returns {JSX.Element}
 */
const Card = ({ r, actionLoading, onSave, nav }) => {
  // ── STATE ──

  /** @type {[string, Function]} The status currently selected in the dropdown (may differ from server state). */
  const [status, setStatus] = useState(r.refundStatus);

  /** @type {[string, Function]} Rejection reason text entered by the host. */
  const [reason, setReason] = useState('');

  /** @type {[boolean, Function]} True while this specific card's save action is in-flight. */
  const [saving, setSaving] = useState(false);

  // ── LOGIC ──

  /** A refund is "done" once it has been approved or rejected. */
  const done = r.refundStatus !== 'requested';

  /** Validate and dispatch the refund status update. */
  const handleSave = async () => {
    if (status === r.refundStatus) {
      return;
    }
    if (status === 'rejected' && !reason.trim()) {
      return;
    }
    setSaving(true);
    onSave({ id: r._id, refundStatus: status, rejectedReason: reason });
    setSaving(false);
  };

  return (
    <div className="bv-card overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Property thumbnail */}
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

        {/* Booking details */}
        <div className="flex-1 p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[var(--bv-text)] truncate">
                {r.propertyId?.name || 'Property'}
              </h3>
              <p className="text-xs text-[var(--bv-text-dim)] mt-0.5">
                Guest: {r.userId?.username || '—'} · {r.userId?.email}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-black text-[var(--bv-gold)]">
                PKR {r.totalPrice?.toLocaleString()}
              </p>
              <Badge s={r.refundStatus} />
            </div>
          </div>

          {/* Check-in / out / payment / refund amount grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Check-in', value: fmtDate(r.checkIn) },
              { label: 'Check-out', value: fmtDate(r.checkOut) },
              {
                label: 'Payment',
                value: `${
                  r.paymentMethod === 'arrival' ? 'Cash' : 'Card'
                } · ${r.paymentStatus}`,
              },
              {
                label: 'Refund Amount',
                value: `PKR ${(r.refundAmount || r.totalPrice)?.toLocaleString()} (${
                  r.refundPercent || 100
                }%)`,
                highlight: true,
              },
            ].map(({ label, value, highlight }) => {
              return (
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
              );
            })}
          </div>

          {/* Cancellation policy badge (platform-wide standard policy) */}
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={12} className="text-[var(--bv-gold)]" />
            <span className="text-[10px] font-bold uppercase text-[var(--bv-text-dim)]">
              Standard policy{typeof r.refundPercent === 'number' && r.refundPercent > 0 ? ` · ${r.refundPercent}% refund` : ''}
            </span>
          </div>

          {/* Guest-provided refund reason */}
          {r.refundReason && (
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 mb-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mb-1">
                Guest Reason
              </p>
              <p className="text-sm text-[var(--bv-text-muted)]">{r.refundReason}</p>
            </div>
          )}

          {/* Host-provided rejection reason (read-only after decision) */}
          {r.refundRejectedReason && (
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15 mb-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-red-600 mb-1">
                Rejection Reason
              </p>
              <p className="text-sm text-[var(--bv-text-muted)]">
                {r.refundRejectedReason}
              </p>
            </div>
          )}

          {/* Resolution date */}
          {r.refundResolvedAt && (
            <p className="text-[10px] text-[var(--bv-text-dim)] mb-3">
              Resolved on {fmtDate(r.refundResolvedAt)}
            </p>
          )}

          {/* Action area — only shown for pending requests */}
          {!done && (
            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-[var(--bv-divider)]">
              {/* Status selector */}
              <select
                value={status}
                onChange={(e) => {
                  return setStatus(e.target.value);
                }}
                className="bv-input sm:w-44"
              >
                <option value="requested">Pending</option>
                <option value="approved">Approve Refund</option>
                <option value="rejected">Reject Refund</option>
              </select>

              {/* Rejection reason input (only visible when rejecting) */}
              {status === 'rejected' && (
                <input
                  value={reason}
                  onChange={(e) => {
                    return setReason(e.target.value);
                  }}
                  placeholder="Rejection reason..."
                  className="bv-input flex-1"
                />
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={actionLoading || saving}
                  className="bv-btn-gold text-xs px-4 py-2.5 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  Save
                </button>
                <button
                  onClick={() => {
                    return nav(`/host/bookings/${r._id}`);
                  }}
                  className="bv-btn-outline text-xs px-4 py-2.5 flex items-center gap-1.5"
                >
                  <Eye size={12} /> View
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───

/**
 * RefundRequestPayment Component
 * Main page for managing refund requests in the host panel.
 *
 * @returns {JSX.Element}
 */
const RefundRequestPayment = () => {
  // ─── HOOKS ───

  /** @type {Function} Redux dispatch hook */
  const dispatch = useDispatch();

  /** @type {Function} React Router navigation hook */
  const nav = useNavigate();

  /** @type {Object} Redux state for accommodations */
  const { refunds, loading, actionLoading, error, success, message } = useSelector(
    (s) => {
      return s.accommodations;
    }
  );

  // ─── STATE ───

  /** @type {[string, Function]} Active filter tab key */
  const [filter, setFilter] = useState('all');

  // ─── SIDE EFFECTS ───

  /**
   * Fetch pending refund requests on mount.
   */
  useEffect(
    () => {
      // Setup: Fetch requests
      dispatch(getRefundRequests());

      // Cleanup: None
    },
    [
      // Dependencies
      dispatch
    ]
  );

  /**
   * After a successful status update show a success toast and reset Redux
   * flags so the notification does not re-fire.
   */
  useEffect(
    () => {
      // Setup: Toast success
      if (success && message) {
        dispatch(resetAccommodationState());
      }

      // Cleanup: None
    },
    [
      // Dependencies
      success,
      message,
      dispatch
    ]
  );

  /**
   * Surface any async error as a toast and clear the error flag.
   */
  useEffect(
    () => {
      // Setup: Toast error
      if (error) {
        dispatch(resetAccommodationState());
      }

      // Cleanup: None
    },
    [
      // Dependencies
      error,
      dispatch
    ]
  );

  // ─── LOGIC ───

  // Apply the filter tab to produce the visible list
  const filtered = filter === 'all'
    ? refunds
    : refunds?.filter((r) => {
      return r.refundStatus === filter;
    });

  // Pre-compute summary stats
  const stats = {
    pending: refunds?.filter((r) => {
      return r.refundStatus === 'requested';
    }).length || 0,
    approved: refunds?.filter((r) => {
      return r.refundStatus === 'approved';
    }).length || 0,
    rejected: refunds?.filter((r) => {
      return r.refundStatus === 'rejected';
    }).length || 0,
    totalRefunded:
      refunds
        ?.filter((r) => {
          return r.refundStatus === 'approved';
        })
        .reduce((s, r) => {
          return s + (r.refundAmount || r.totalPrice || 0);
        }, 0) || 0,
  };

  /**
   * Dispatch the refund status update for a given booking.
   * @param {Object} data - Update data
   * @param {string} data.id - Booking ID
   * @param {string} data.refundStatus - New refund status
   * @param {string} data.rejectedReason - Reason if rejected
   */
  const handleSave = ({ id, refundStatus, rejectedReason }) => {
    dispatch(updateRefundStatus({ id, refundStatus, rejectedReason }));
  };

  // ─── RENDER ───

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">
            Refund <span className="text-[var(--bv-gold)]">Requests</span>
          </h1>
          <p className="text-sm text-[var(--bv-text-dim)] mt-1">
            Review and process guest cancellation refunds
          </p>
        </div>
        <button
          onClick={() => {
            return dispatch(getRefundRequests());
          }}
          disabled={loading}
          className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Pending',
            value: stats.pending,
            color: 'text-amber-600',
            icon: Clock,
          },
          {
            label: 'Approved',
            value: stats.approved,
            color: 'text-emerald-600',
            icon: CheckCircle,
          },
          {
            label: 'Rejected',
            value: stats.rejected,
            color: 'text-red-600',
            icon: XCircle,
          },
          {
            label: 'Total Refunded',
            value: `PKR ${stats.totalRefunded.toLocaleString()}`,
            color: 'text-[var(--bv-gold)]',
            icon: ShieldCheck,
          },
        ].map(({ label, value, color, icon: Icon }) => {
          return (
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
          );
        })}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'requested', label: 'Pending' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
        ].map(({ key, label }) => {
          return (
            <button
              key={key}
              onClick={() => {
                return setFilter(key);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition ${
                filter === key
                  ? 'bg-[var(--bv-gold)] text-[var(--bv-text-inverse)]'
                  : 'bg-[var(--bv-surface)] text-[var(--bv-text-muted)]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Refund request list ── */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => {
            return <div key={i} className="bv-skeleton h-40 rounded-2xl" />;
          })}
        </div>
      ) : !filtered?.length ? (
        <div className="bv-card-static py-20 text-center">
          <CheckCircle
            size={48}
            className="mx-auto mb-4 text-[var(--bv-text-dim)] opacity-20"
          />
          <p className="font-bold text-[var(--bv-text-muted)]">
            No refund requests{filter !== 'all' ? ` with status "${filter}"` : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            return (
              <Card
                key={r._id}
                r={r}
                actionLoading={actionLoading}
                onSave={handleSave}
                nav={nav}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RefundRequestPayment;
