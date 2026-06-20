/**
 * UserPaymentDetails.jsx
 *
 * Detailed booking view accessible to the guest from their booking history.
 * Fetches a single booking by route param `:id` and displays:
 *   - Property image, name, type and address
 *   - Booking status / payment status badges
 *   - Emergency SOS button (active bookings only)
 *   - Interactive FoodOrderEngine (active bookings only)
 *   - Check-in / out dates, duration, total cost, payment method
 *   - Pre-ordered meals summary (completed bookings only)
 *   - Refund status section (if a refund exists)
 *
 * @module UserPaymentDetails
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getSingleBooking, resetAccommodationState } from '../../redux/slices/accommodationSlice';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  CreditCard,
  Clock,
  Utensils,
  ImageOff,
} from 'lucide-react';
import FoodOrderEngine from '../../components/FoodOrderEngine';
import EmergencySOSButton from '../../components/EmergencySOSButton';

/**
 * Format an ISO date string to a full readable date.
 * @param {string} d - ISO date string
 * @returns {string} Formatted date string
 */
const fmtDate = (d) => {
  if (!d) {
    return '—';
  }
  return new Date(d).toLocaleDateString('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Row Component — a labelled info row with an icon used inside the details card.
 * @param {Object} props - Component properties
 * @param {React.ComponentType} props.icon - Lucide icon component
 * @param {string} props.label - Label text
 * @param {string} props.value - Value text
 * @returns {JSX.Element}
 */
const Row = ({ icon: I, label, value }) => {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--bv-divider)] last:border-0">
      <div className="p-2 bg-[var(--bv-gold-glow)] rounded-lg">
        <I size={13} className="text-[var(--bv-gold)]" />
      </div>
      <div>
        <p className="bv-label mb-0">{label}</p>
        <p className="text-sm font-medium text-[var(--bv-text)] mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );
};

/**
 * UserPaymentDetails Component
 * Displays detailed information about a specific booking for the user.
 *
 * @returns {JSX.Element}
 */
const UserPaymentDetails = () => {
  // ─── HOOKS ───

  /** @type {Object} Route parameters */
  const { id } = useParams();

  /** @type {Function} React Router navigation hook */
  const nav = useNavigate();

  /** @type {Function} Redux dispatch hook */
  const dispatch = useDispatch();

  /** @type {Object} Booking state from Redux store */
  const { singleBooking: b, loading, error } = useSelector((s) => {
    return s.accommodations;
  });

  // ─── SIDE EFFECTS ───

  /**
   * Fetch the booking when the component mounts or the route ID changes.
   * The cleanup function resets Redux state so stale booking data is not
   * shown when navigating directly to a different booking.
   */
  useEffect(
    () => {
      // Setup: Dispatch fetch request
      if (id) {
        dispatch(getSingleBooking(id));
      }

      // Cleanup: Reset state
      return () => {
        dispatch(resetAccommodationState());
      };
    },
    [
      // Dependencies
      id,
      dispatch
    ]
  );

  /**
   * Surface any fetch error as a toast and clear the Redux error flag
   * so it does not re-trigger.
   */
  useEffect(
    () => {
      // Setup: Toast error if present
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

  // ─── GUARDS ───

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 mt-24 space-y-5">
        <div className="bv-skeleton h-56 rounded-2xl" />
        <div className="bv-skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  if (!b) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--bv-text-muted)]">Booking not found</p>
      </div>
    );
  }

  // ─── LOGIC ───

  // Shorthand for the property object
  const p = b.propertyId;

  // Duration fallback: compute from dates if stayDays not stored
  const stayDays = b.stayDays ||
    Math.max(1, Math.ceil((new Date(b.checkOut) - new Date(b.checkIn)) / 86400000));

  // True if the guest has pre-ordered food (direct schema fields)
  const hasFoods = b.breakfast?.title || b.lunch?.title || b.dinner?.title;

  // Interactive modules (SOS + food engine) are only relevant for active paid bookings
  const isInteractive = b.bookingStatus === 'confirmed' && b.paymentStatus === 'paid';

  // ─── RENDER ───

  return (
    <div className="min-h-screen pt-28 pb-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* ── Back navigation ── */}
        <button
          onClick={() => {
            return nav(-1);
          }}
          className="flex items-center gap-2 text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] text-sm transition"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* ── Title + status badges ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-[var(--bv-text)]">
              Booking Detail
            </h1>
            <p className="text-[var(--bv-text-dim)] text-xs mt-0.5">
              ID: {b._id}
            </p>
          </div>
          <div className="flex gap-2">
            <span
              className={`bv-badge ${
                b.bookingStatus === 'confirmed'
                  ? 'bv-badge-green'
                  : 'bv-badge-red'
              } capitalize`}
            >
              {b.bookingStatus}
            </span>
            <span
              className={`bv-badge ${
                b.paymentStatus === 'paid'
                  ? 'bv-badge-green'
                  : 'bv-badge-amber'
              } capitalize`}
            >
              {b.paymentStatus}
            </span>
          </div>
        </div>

        {/* ── Emergency SOS button (active bookings only) ── */}
        {isInteractive && (
          <div className="bv-animate-in">
            <EmergencySOSButton bookingId={b._id} />
          </div>
        )}

        {/* ── Property card ── */}
        <div className="bv-card-static overflow-hidden">
          {p?.images?.[0]?.url ? (
            <img
              src={p.images[0].url}
              alt=""
              loading="lazy"
              className="w-full h-48 object-cover"
            />
          ) : (
            <div className="w-full h-48 bg-[var(--bv-surface)] flex items-center justify-center">
              <ImageOff size={32} className="text-[var(--bv-text-dim)]" />
            </div>
          )}
          <div className="p-5">
            <h2 className="text-lg font-bold text-[var(--bv-text)]">{p?.name}</h2>
            <span className="bv-badge bv-badge-gold capitalize mt-1">
              {p?.type}
            </span>
            <p className="flex items-center gap-1.5 text-[var(--bv-text-dim)] text-sm mt-2">
              <MapPin size={13} /> {p?.address}, {p?.city}
            </p>
          </div>
        </div>

        {/* ── Interactive food engine (active bookings only) ── */}
        {isInteractive && (
          <FoodOrderEngine bookingId={b._id} propertyId={p?._id} />
        )}

        {/* ── Booking details ── */}
        <div className="bv-card-static p-5">
          <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">
            Details
          </h3>
          <Row icon={Calendar} label="Check-In" value={fmtDate(b.checkIn)} />
          <Row icon={Calendar} label="Check-Out" value={fmtDate(b.checkOut)} />
          <Row
            icon={Clock}
            label="Duration"
            value={`${stayDays} night${stayDays !== 1 ? 's' : ''}`}
          />
          <Row
            icon={CreditCard}
            label="Total"
            value={`PKR ${b.totalPrice?.toLocaleString()}`}
          />
          <Row icon={CreditCard} label="Method" value={b.paymentMethod} />
        </div>

        {/* ── Pre-ordered meals summary (completed bookings only) ── */}
        {hasFoods && !isInteractive && (
          <div className="bv-card-static p-5">
            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3 flex items-center gap-2">
              <Utensils size={14} /> Pre-ordered Meals
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['breakfast', 'lunch', 'dinner'].map((mealKey) => {
                const item = b[mealKey];
                if (!item?.title) {
                  return null;
                }
                return (
                  <div
                    key={mealKey}
                    className="p-3 bg-[var(--bv-gold-glow)] border border-[var(--bv-gold-border)] rounded-xl"
                  >
                    <p className="bv-label mb-0">{mealKey}</p>
                    <p className="text-sm font-semibold text-[var(--bv-text)] mt-0.5">
                      {item.title}
                    </p>
                    <p className="text-xs font-bold text-[var(--bv-gold)] mt-1">
                      PKR {item.price?.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Refund status section ── */}
        {b.refundStatus && b.refundStatus !== 'none' && (
          <div className="bv-card-static p-5">
            <h3 className="text-sm font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">
              Refund
            </h3>
            <div
              className={`p-4 rounded-xl text-sm border space-y-2 ${
                b.refundStatus === 'approved'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-[var(--bv-success)]'
                  : b.refundStatus === 'rejected'
                  ? 'bg-red-500/10 border-red-500/20 text-[var(--bv-danger)]'
                  : b.refundStatus === 'processing'
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-600'
                  : 'bg-amber-500/10 border-amber-500/20 text-[var(--bv-warning)]'
              }`}
            >
              <p className="font-bold capitalize">Refund {b.refundStatus}</p>
              {b.refundAmount > 0 && (
                <p className="opacity-90">
                  Amount: <span className="font-semibold">PKR {b.refundAmount?.toLocaleString()}</span>
                  {b.refundPercent > 0 && (
                    <span className="opacity-70 ml-1">({b.refundPercent}%)</span>
                  )}
                </p>
              )}
              {b.refundReason && (
                <p className="opacity-80">Your reason: {b.refundReason}</p>
              )}
              {b.refundStatus === 'rejected' && b.refundRejectedReason && (
                <p className="opacity-80">Rejection reason: {b.refundRejectedReason}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPaymentDetails;
