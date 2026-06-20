/**
 * AllPayments.jsx
 *
 * Lists every booking payment associated with the host's properties.
 * Each row shows the property thumbnail, name, guest, check-in / check-out
 * dates, total price, payment status badge, and booking status badge.
 * Supports a manual refresh action.
 *
 * @module AllPayments
 */

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getHostPayments, resetAccommodationState } from '../../redux/slices/accommodationSlice';
import { RefreshCw, CreditCard, ImageOff } from 'lucide-react';

// ─── SUB-COMPONENTS ───

/**
 * Badge Component — renders a colour-coded status pill.
 * Maps paid → green, unpaid → amber, failed → red; gold for anything else.
 *
 * @param {Object} props - Component properties
 * @param {string} props.s - Status string
 * @returns {JSX.Element}
 */
const Badge = ({ s }) => {
  const colorMap = {
    paid: 'bv-badge-green',
    pending: 'bv-badge-amber',
    failed: 'bv-badge-red',
  };

  return (
    <span className={`bv-badge ${colorMap[s] || 'bv-badge-gold'} capitalize`}>
      {s}
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

// ─── MAIN COMPONENT ───

/**
 * AllPayments Component
 * Main page for viewing all payments received by the host.
 *
 * @returns {JSX.Element}
 */
const AllPayments = () => {
  // ─── HOOKS ───

  /** @type {Function} Redux dispatch hook */
  const dispatch = useDispatch();

  /** @type {Object} Redux state for accommodations */
  const { hostPayments, loading, error } = useSelector((s) => {
    return s.accommodations;
  });

  // ─── SIDE EFFECTS ───

  /**
   * Fetch host payment records on mount.
   */
  useEffect(
    () => {
      // Setup: Fetch payments
      dispatch(getHostPayments());

      // Cleanup: None
    },
    [
      // Dependencies
      dispatch
    ]
  );

  /**
   * Show an error toast whenever an async action fails, then clear the
   * error flag so the notification does not re-trigger.
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

  // ─── RENDER ───

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">
            All <span className="text-[var(--bv-gold)]">Payments</span>
          </h1>
          <p className="text-[var(--bv-text-dim)] text-sm mt-1">
            Track all booking payments
          </p>
        </div>
        <button
          onClick={() => {
            return dispatch(getHostPayments());
          }}
          disabled={loading}
          className="bv-btn-outline text-sm px-4 py-2 flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Content area ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => {
            return <div key={i} className="bv-skeleton h-20 rounded-2xl" />;
          })}
        </div>
      ) : !hostPayments?.length ? (
        /* Empty state */
        <div className="bv-card-static py-20 text-center">
          <CreditCard
            size={48}
            className="mx-auto mb-4 text-[var(--bv-text-dim)] opacity-20"
          />
          <p className="font-bold text-[var(--bv-text-muted)]">No payments yet</p>
        </div>
      ) : (
        /* Payment rows */
        <div className="space-y-3">
          {hostPayments.map((b) => {
            return (
              <div
                key={b._id}
                className="bv-card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                {/* Property thumbnail */}
                <div className="w-14 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bv-surface)]">
                  {b.propertyId?.images?.[0]?.url ? (
                    <img
                      src={b.propertyId.images[0].url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageOff
                      size={14}
                      className="text-[var(--bv-text-dim)] m-auto"
                    />
                  )}
                </div>

                {/* Property name + guest + dates */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--bv-text)] text-sm truncate">
                    {b.propertyId?.name || '—'}
                  </p>
                  <p className="text-xs text-[var(--bv-text-dim)]">
                    {b.userId?.username || '—'} · {fmtDate(b.checkIn)} –{' '}
                    {fmtDate(b.checkOut)}
                  </p>
                </div>

                {/* Price + status badges */}
                <div className="text-right">
                  <p className="font-bold text-[var(--bv-gold)] text-sm">
                    PKR {b.totalPrice?.toLocaleString()}
                  </p>
                  <div className="flex gap-1.5 mt-1 justify-end">
                    <Badge s={b.paymentStatus} />
                    <Badge s={b.bookingStatus} />
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

export default AllPayments;
