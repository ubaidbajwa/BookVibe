/**
 * @file BookingDetailPanel.jsx
 * @description Comprehensive Booking Information Panel
 *
 * This component displays all details related to a specific booking, including
 * property information, guest details, payment status, CNIC snapshots, and
 * food selection. It also includes the food ordering management interface for hosts.
 */

import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  User,
  Phone,
  Mail,
  CreditCard,
  Clock,
  ImageOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Banknote,
} from 'lucide-react';

import FoodOrderEngine from '../FoodOrderEngine';

// --- Helpers ---

/**
 * @function formatDate
 * @description Formats a date string into a localized Pakistani format.
 * @param {string|Date} d - The date to format.
 * @returns {string} The formatted date or a placeholder.
 */
const formatDate = (d) => {
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
 * @function badgeClass
 * @description Returns the CSS classes for a status badge based on its type and value.
 * @param {string} status - The status value.
 * @param {string} [type='booking'] - The type of badge (booking, payment, refund).
 * @returns {string} Tailwind CSS classes.
 */
const badgeClass = (status, type = 'booking') => {
  const booking = {
    confirmed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    staying:   'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    completed: 'bg-[var(--bv-gold-glow)] text-[var(--bv-gold)] border-[var(--bv-gold-border)]',
    pending:   'bg-amber-500/10 text-amber-300 border-amber-500/20',
    cancel:    'bg-red-500/10 text-red-300 border-red-500/20',
  };

  const payment = {
    paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    pending: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    failed: 'bg-red-500/10 text-red-300 border-red-500/20',
  };

  const refund = {
    none: 'bg-[var(--bv-surface)] text-[var(--bv-text-dim)] border-[var(--bv-border)]',
    requested: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-300 border-red-500/20',
  };

  const map =
    type === 'payment' ? payment : type === 'refund' ? refund : booking;

  return (
    map[status] ||
    'bg-[var(--bv-surface)] text-[var(--bv-text-dim)] border-[var(--bv-border)]'
  );
};

// --- Sub-components ---

/**
 * @function StatusBadge
 * @description Renders a small badge showing a status.
 */
const StatusBadge = ({ status, type }) => {
  return (
    <span
      className={`px-3 py-1 rounded-full text-[11px] font-bold capitalize border ${badgeClass(
        status,
        type
      )}`}
    >
      {status || '—'}
    </span>
  );
};

/**
 * @function InfoRow
 * @description Renders a single row of information with an icon and label.
 */
const InfoRow = ({ icon: Icon, label, value }) => {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--bv-divider)] last:border-0">
      <div className="w-10 h-10 rounded-xl bg-[var(--bv-surface)] border border-[var(--bv-border)] flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-[var(--bv-gold)]" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--bv-text-dim)]">
          {label}
        </p>
        <p className="text-sm font-semibold text-[var(--bv-text)] mt-1 break-words">
          {value || '—'}
        </p>
      </div>
    </div>
  );
};

/**
 * @function DetailSkeleton
 * @description Loading placeholder for the panel.
 */
const DetailSkeleton = () => {
  return (
    <div className="space-y-5">
      <div className="bv-skeleton h-12 rounded-xl" />
      <div className="bv-skeleton h-64 rounded-3xl" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bv-skeleton h-72 rounded-3xl" />
        <div className="bv-skeleton h-72 rounded-3xl" />
      </div>
      <div className="bv-skeleton h-56 rounded-3xl" />
    </div>
  );
};

/* ── MAIN COMPONENT ── */

/**
 * @function BookingDetailPanel
 * @description The main panel component for displaying booking details.
 */
const BookingDetailPanel = ({
  booking,
  loading,
  onBack,
  backLabel = 'Back',
  title = 'Booking Detail',
  subtitle = 'Reservation overview',
  showCashConfirm = false,
  confirmingCash = false,
  onConfirmCash,
  cashConfirmed = false,
  isHost = false,
}) => {
  if (loading) {
    return <DetailSkeleton />;
  }

  if (!booking) {
    return (
      <div className="bv-card-static p-10 text-center">
        <XCircle
          size={42}
          className="mx-auto text-[var(--bv-danger)] opacity-70 mb-3"
        />
        <p className="text-lg font-bold text-[var(--bv-text)]">
          Booking not found
        </p>
        <p className="text-sm text-[var(--bv-text-dim)] mt-1">
          The requested booking could not be loaded.
        </p>
        <button
          onClick={onBack}
          className="mt-5 bv-btn-outline px-5 py-2.5 text-sm"
        >
          {backLabel}
        </button>
      </div>
    );
  }

  const { propertyId: property, userId: guest } = booking;
  const coverImg = property?.images?.[0]?.url;
  const stayNights = booking?.stayDays || 0;
  const guestCnic = booking?.guestCnicSnapshot;
  const hasFoodSelection =
    booking?.breakfast?.title ||
    booking?.lunch?.title ||
    booking?.dinner?.title;
  const paidStatus = cashConfirmed ? 'paid' : booking?.paymentStatus;

  return (
    <div className="space-y-5">
      {/* ── Header & Navigation ── */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-[var(--bv-text-dim)] hover:text-[var(--bv-gold)] transition"
      >
        <ArrowLeft size={15} /> {backLabel}
      </button>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-[var(--bv-text)]">
            {title}
          </h1>
          <p className="text-sm text-[var(--bv-text-dim)] mt-1">{subtitle}</p>
          <p className="text-[11px] text-[var(--bv-text-dim)] mt-2">
            Booking ID: {booking?._id}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={booking?.bookingStatus} type="booking" />
          <StatusBadge status={paidStatus} type="payment" />
          {booking?.refundStatus && booking?.refundStatus !== 'none' && (
            <StatusBadge status={booking?.refundStatus} type="refund" />
          )}
        </div>
      </div>

      {/* ── Cash Confirmation Section ── */}
      {showCashConfirm && (
        <div className="bv-card-static p-5 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Banknote size={22} className="text-amber-300" />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-[var(--bv-text)]">
                Cash Payment Pending
              </p>
              <p className="text-sm text-[var(--bv-text-dim)] mt-1">
                Guest selected pay on arrival. Confirm after receiving PKR{' '}
                {booking?.totalPrice?.toLocaleString()}.
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-amber-300">
                <AlertTriangle size={12} /> Only confirm after full amount is
                received.
              </div>
              <button
                onClick={onConfirmCash}
                disabled={confirmingCash}
                className="mt-4 bv-btn-gold px-5 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-60"
              >
                {confirmingCash ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle size={15} /> Confirm Cash Received
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Property Hero ── */}
      <div className="bv-card-static overflow-hidden">
        <div className="relative h-56 sm:h-72 bg-[var(--bv-surface)]">
          {coverImg ? (
            <img
              src={coverImg}
              alt={property?.name}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff size={34} className="text-[var(--bv-text-dim)]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bv-bg)] via-[var(--bv-bg)]/20 to-transparent" />
          <div className="absolute left-5 right-5 bottom-5">
            <p className="text-2xl font-black text-[var(--bv-text)]">
              {property?.name || 'Property'}
            </p>
            <div className="flex items-center gap-2 text-sm text-[var(--bv-text-muted)] mt-2">
              <MapPin size={14} className="text-[var(--bv-gold)]" />
              <span>
                {property?.address}, {property?.city}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Detailed Info Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Stay Details */}
        <div className="bv-card-static p-5">
          <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">
            Stay Details
          </p>
          <InfoRow
            icon={CalendarDays}
            label="Check In"
            value={formatDate(booking?.checkIn)}
          />
          <InfoRow
            icon={CalendarDays}
            label="Check Out"
            value={formatDate(booking?.checkOut)}
          />
          <InfoRow
            icon={Clock}
            label="Duration"
            value={`${stayNights} night${stayNights !== 1 ? 's' : ''}`}
          />
          <InfoRow
            icon={CreditCard}
            label="Total Amount"
            value={`PKR ${booking?.totalPrice?.toLocaleString()}`}
          />
          <InfoRow
            icon={CreditCard}
            label="Payment Method"
            value={
              booking?.paymentMethod === 'arrival'
                ? 'Cash (Pay on Arrival)'
                : 'Stripe (Online)'
            }
          />
          <InfoRow icon={CreditCard} label="Payment Status" value={paidStatus} />
        </div>

        {/* Guest Information */}
        <div className="bv-card-static p-5">
          <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-3">
            Guest Information
          </p>
          <div className="flex items-center gap-3 mb-4">
            {guest?.profileImage?.url ? (
              <img
                src={guest.profileImage.url}
                alt={guest.username}
                className="w-14 h-14 rounded-2xl object-cover border border-[var(--bv-border)]"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--bv-gold)] to-[var(--bv-gold-light)] flex items-center justify-center text-[var(--bv-bg)] font-bold text-lg">
                {guest?.username?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <p className="font-bold text-[var(--bv-text)]">
                {guest?.username || 'Guest'}
              </p>
              <p className="text-xs text-[var(--bv-text-dim)]">
                Verified booking guest
              </p>
            </div>
          </div>
          <InfoRow icon={Mail} label="Email" value={guest?.email} />
          <InfoRow icon={Phone} label="Phone" value={guest?.phone} />
          <InfoRow icon={User} label="Guest ID" value={guest?._id} />
        </div>
      </div>

      {/* ── CNIC Verification Section ── */}
      {guestCnic && (
        <div className="bv-card-static p-5">
          <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">
            Guest CNIC Snapshot
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div>
              <InfoRow icon={User} label="Full Name" value={guestCnic.fullName} />
              <InfoRow
                icon={CreditCard}
                label="CNIC Number"
                value={guestCnic.cnicNumber}
              />
              <InfoRow
                icon={CalendarDays}
                label="Date of Birth"
                value={guestCnic.dateOfBirth}
              />
              <InfoRow icon={MapPin} label="Address" value={guestCnic.address} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl overflow-hidden border border-[var(--bv-border)] bg-[var(--bv-surface)]">
                {guestCnic.cnicFrontImageUrl ? (
                  <img
                    src={guestCnic.cnicFrontImageUrl}
                    alt="CNIC Front"
                    loading="lazy"
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center text-xs text-[var(--bv-text-dim)]">
                    CNIC front not available
                  </div>
                )}
              </div>
              <div className="rounded-2xl overflow-hidden border border-[var(--bv-border)] bg-[var(--bv-surface)]">
                {guestCnic.selfieImageUrl ? (
                  <img
                    src={guestCnic.selfieImageUrl}
                    alt="Guest Selfie"
                    loading="lazy"
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center text-xs text-[var(--bv-text-dim)]">
                    Selfie not available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Food Order Management ── */}
      {isHost && (booking.bookingStatus === 'confirmed' || booking.bookingStatus === 'staying') && (
        <FoodOrderEngine
          bookingId={booking._id}
          propertyId={property?._id}
          isHost={true}
        />
      )}

      {hasFoodSelection && (
        <div className="bv-card-static p-5">
          <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">
            Food Selection
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['breakfast', 'lunch', 'dinner'].map((meal) => {
              const item = booking?.[meal];
              if (!item?.title) {
                return null;
              }
              return (
                <div
                  key={meal}
                  className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-4"
                >
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--bv-gold)]">
                    {meal}
                  </p>
                  <p className="text-sm font-semibold text-[var(--bv-text)] mt-1">
                    {item.title}
                  </p>
                  <p className="text-xs text-[var(--bv-text-dim)] mt-2">
                    PKR {item.price?.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      <div className="bv-card-static p-5">
        <p className="text-xs font-bold text-[var(--bv-gold)] uppercase tracking-widest mb-4">
          Booking Timeline
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-[var(--bv-surface)] border border-[var(--bv-border)] p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--bv-text-dim)]">
              Booked On
            </p>
            <p className="text-sm font-semibold text-[var(--bv-text)] mt-1">
              {formatDate(booking?.createdAt)}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--bv-surface)] border border-[var(--bv-border)] p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--bv-text-dim)]">
              Last Updated
            </p>
            <p className="text-sm font-semibold text-[var(--bv-text)] mt-1">
              {formatDate(booking?.updatedAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailPanel;
