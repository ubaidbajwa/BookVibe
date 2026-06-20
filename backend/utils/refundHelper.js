/**
 * @fileoverview Utility for calculating booking refunds based on the platform-wide
 * cancellation policy.
 * @module utils/refundHelper
 */

/* -------------------------------------------------------------------------- */
/*                                Refund Logic                                */
/* -------------------------------------------------------------------------- */

// ─── PLATFORM-WIDE 3-PHASE CANCELLATION POLICY (applies to every property) ───
// Timing is measured from when the guest's payment was made (paidAt), not from
// the check-in date.
//
//   Phase 1 — within 24 hours of payment            → 100% refund (no fee)
//   Phase 2 — after 24 hours, within 4 days          → 85% refund (15% fee)
//   Phase 3 — more than 4 days after payment         → 70% refund (30% fee)
//
// The retained "cancellation fee" stays in the system as host revenue, from
// which the platform deducts its standard 10% commission at payout time (so the
// host nets 90% of the fee). This split is handled by the earnings/payout logic,
// not here.
const FULL_REFUND_HOURS = 24;
const PARTIAL_REFUND_DAYS = 4;
const PHASE_2_REFUND_PERCENT = 85; // 15% cancellation fee
const PHASE_3_REFUND_PERCENT = 70; // 30% cancellation fee

/**
 * Calculates the eligible refund amount for a booking based on how long ago the
 * guest paid.
 *
 * @param {Object} booking - The booking document (uses totalPrice, paymentStatus, paidAt).
 * @returns {Object} Refund calculation results.
 */
const calculateRefund = (booking) => {
  const now = new Date();
  const totalPrice = booking.totalPrice || 0;
  const isPaid = booking.paymentStatus === 'paid';

  // If not paid, there is nothing to refund — booking can be cancelled freely.
  if (!isPaid) {
    return {
      eligible: true,
      refundAmount: 0,
      refundPercent: 0,
      cancellationFee: 0,
      phase: 0,
      reason: 'No payment was made — booking can be cancelled freely.',
      daysSincePayment: 0,
      totalPrice,
    };
  }

  // Payment timestamp. Fall back to updatedAt/createdAt for legacy bookings that
  // predate the paidAt field.
  const paidAt = new Date(booking.paidAt || booking.updatedAt || booking.createdAt || now);
  const hoursSincePayment = (now - paidAt) / (1000 * 60 * 60);
  const daysSincePayment = hoursSincePayment / 24;

  let refundPercent;
  let phase;
  let reason;

  if (hoursSincePayment <= FULL_REFUND_HOURS) {
    refundPercent = 100;
    phase = 1;
    reason = 'Full refund — cancelled within 24 hours of payment.';
  } else if (daysSincePayment <= PARTIAL_REFUND_DAYS) {
    refundPercent = PHASE_2_REFUND_PERCENT;
    phase = 2;
    reason = '85% refund — cancelled within 4 days of payment (15% cancellation fee applies).';
  } else {
    refundPercent = PHASE_3_REFUND_PERCENT;
    phase = 3;
    reason = '70% refund — cancelled more than 4 days after payment (30% cancellation fee applies).';
  }

  const refundAmount = Math.round((totalPrice * refundPercent) / 100);
  const cancellationFee = totalPrice - refundAmount;

  return {
    eligible: refundPercent > 0,
    refundAmount,
    refundPercent,
    cancellationFee,
    phase,
    reason,
    daysSincePayment: Math.floor(daysSincePayment),
    totalPrice,
  };
};

export default { calculateRefund };
