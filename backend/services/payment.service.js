/**
 * @fileoverview Payment service for managing host earnings, payouts, and debts
 * @module services/payment
 */

import mongoose from "mongoose";
import HostPaymentInfo from "../models/HostPaymentInfoModel.js";
import Payout from "../models/PayoutModel.js";
import BookingModel from "../models/BookingModel.js";
import PropertyModel from "../models/PropertyModel.js";
import UserAndHostModel from "../models/UserAndHostModel.js";

const PLATFORM_FEE_PERCENT = 10;

/**
 * Service class for payment-related operations
 */
class PaymentService {
  /* -------------------------------------------------------------------------- */
  /*                               Earnings Logic                               */
  /* -------------------------------------------------------------------------- */

  /**
   * Calculates a summary of host earnings, escrow, and available payouts
   * @param {string} hostId - The ID of the host
   * @returns {Promise<Object>} Earnings summary object
   */
  async getEarningsSummary(hostId) {
    const oid = new mongoose.Types.ObjectId(hostId);
    // 24-hour escrow buffer: bookings whose checkout was > 24h ago are eligible
    const escrowCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Bookings already linked to an existing payout (pending/processing/completed)
    // must be excluded from "still available" math — without this, a booking's full
    // value kept counting as eligible even after a payout had already claimed it, and
    // any cash-commission debt settled inside that payout's netAmount would silently
    // reappear as phantom "available" balance on the very next fetch.
    const previousPayouts = await Payout.find({
      hostId: oid,
      status: { $in: ['pending', 'processing', 'completed'] },
    }).select('bookings');
    const usedBookingIds = previousPayouts.flatMap((p) => p.bookings);

    // Single aggregation: $lookup → $match on hostBy → $facet for each bucket
    // Replaces two find() calls + O(n) JS filter/reduce chains
    const [agg] = await BookingModel.aggregate([
      {
        $lookup: {
          from: 'properties',
          let: { pid: '$propertyId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$pid'] } } },
            { $project: { hostBy: 1 } },
          ],
          as: '_prop',
        },
      },
      { $unwind: '$_prop' },
      {
        $match: {
          '_prop.hostBy': oid,
          paymentStatus: 'paid',
        },
      },
      {
        $addFields: {
          netPrice: {
            $subtract: [
              { $ifNull: ['$totalPrice', 0] },
              {
                $cond: [
                  { $in: ['$refundStatus', ['approved', 'processing']] },
                  { $ifNull: ['$refundAmount', 0] },
                  0
                ]
              }
            ]
          }
        }
      },
      {
        $facet: {
          allPaid: [
            { $group: { _id: null, total: { $sum: '$netPrice' } } },
          ],
          // Lifetime totals per channel — used for the commission breakdown display,
          // independent of escrow/payout status.
          stripeAll: [
            { $match: { paymentMethod: 'stripe' } },
            { $group: { _id: null, total: { $sum: '$netPrice' } } },
          ],
          cashAll: [
            { $match: { paymentMethod: 'arrival' } },
            { $group: { _id: null, total: { $sum: '$netPrice' } } },
          ],
          // Bookings that were partially refunded (guest got some % back, host kept
          // the rest) — the platform still takes its cut of the retained portion.
          partialRefunds: [
            {
              $match: {
                refundStatus: { $in: ['approved', 'processing'] },
                $expr: { $and: [{ $gt: ['$refundAmount', 0] }, { $lt: ['$refundAmount', '$totalPrice'] }] },
              },
            },
            { $group: { _id: null, total: { $sum: '$netPrice' } } },
          ],
          // Only Stripe money is held by the platform — cash-on-arrival cash goes
          // straight to the host, so it must never count toward payout/escrow.
          // Bookings already claimed by an earlier payout are excluded so their
          // value can't reappear as "available" a second time.
          // Bookings with a pending refund request ('requested') are also excluded:
          // the refundAmount is not yet subtracted from netPrice at the 'requested'
          // stage (only at 'approved'/'processing'), so counting them now would let
          // the host withdraw money that Stripe might pay back to the guest later —
          // once the refund is resolved (approved/rejected) the booking becomes
          // eligible for the next payout.
          eligible: [
            {
              $match: {
                paymentMethod: 'stripe',
                checkOut: { $lt: escrowCutoff },
                _id: { $nin: usedBookingIds },
                refundStatus: { $ne: 'requested' },
              },
            },
            { $group: { _id: null, total: { $sum: '$netPrice' } } },
          ],
          inEscrow: [
            {
              $match: {
                paymentMethod: 'stripe',
                checkOut: { $gte: escrowCutoff },
              },
            },
            { $group: { _id: null, total: { $sum: '$netPrice' } } },
          ],
        },
      },
    ]);

    const totalEarned = agg?.allPaid?.[0]?.total || 0;
    const stripeTotal = agg?.stripeAll?.[0]?.total || 0;
    const cashTotal = agg?.cashAll?.[0]?.total || 0;
    const partialRefundNet = agg?.partialRefunds?.[0]?.total || 0;
    const eligibleAmount = agg?.eligible?.[0]?.total || 0;
    const heldInEscrow = agg?.inEscrow?.[0]?.total || 0;

    const platformFeesOnEligible = Math.round(eligibleAmount * PLATFORM_FEE_PERCENT / 100);
    const netEligibleEarnings = eligibleAmount - platformFeesOnEligible;

    // Payout totals via DB aggregation (two small queries, already indexed on hostId)
    // — informational only now; no longer subtracted from availableForPayout since
    // "eligible" already excludes any booking tied to these payouts.
    const [payoutAgg] = await Payout.aggregate([
      { $match: { hostId: oid } },
      {
        $facet: {
          completed: [
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$netAmount' } } },
          ],
          pending: [
            { $match: { status: { $in: ['pending', 'processing'] } } },
            { $group: { _id: null, total: { $sum: '$netAmount' } } },
          ],
        },
      },
    ]);

    const totalPaidOut = payoutAgg?.completed?.[0]?.total || 0;
    const pendingPayout = payoutAgg?.pending?.[0]?.total || 0;

    const host = await UserAndHostModel.findById(hostId).select('outstandingDebt');
    const debt = host?.outstandingDebt || 0;

    return {
      totalEarned,
      heldInEscrow,
      platformFeePercent: PLATFORM_FEE_PERCENT,
      platformFees: Math.round(totalEarned * PLATFORM_FEE_PERCENT / 100),
      netEarnings: totalEarned - Math.round(totalEarned * PLATFORM_FEE_PERCENT / 100),
      pendingPayout,
      totalPaidOut,
      outstandingDebt: debt,
      availableForPayout: Math.max(0, netEligibleEarnings - debt),
      // Commission breakdown by channel — for the host-facing "where did the 10% go" view.
      cashTotal,
      cashCommission: Math.round(cashTotal * PLATFORM_FEE_PERCENT / 100),
      stripeTotal,
      stripeCommission: Math.round(stripeTotal * PLATFORM_FEE_PERCENT / 100),
      refundCommission: Math.round(partialRefundNet * PLATFORM_FEE_PERCENT / 100),
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                 Debt Logic                                 */
  /* -------------------------------------------------------------------------- */

  /**
   * Records platform fee debt for cash-on-arrival bookings
   * @param {string} bookingId - The ID of the booking
   * @returns {Promise<void>}
   */
  async recordCashBookingDebt(bookingId) {
    const booking = await BookingModel.findById(bookingId).populate('propertyId');
    if (!booking || booking.paymentMethod !== 'arrival' || booking.debtRecorded) return;

    const platformFee = Math.round((booking.totalPrice || 0) * PLATFORM_FEE_PERCENT / 100);

    await UserAndHostModel.findByIdAndUpdate(booking.propertyId.hostBy, {
      $inc: { outstandingDebt: platformFee }
    });

    booking.debtRecorded = true;
    await booking.save();
  }

  /* -------------------------------------------------------------------------- */
  /*                                Payout Logic                                */
  /* -------------------------------------------------------------------------- */

  /**
   * Processes a payout request for a host
   * @param {string} hostId - The ID of the host
   * @param {Object} paymentInfo - The payment information for the payout
   * @returns {Promise<Object>} The created payout record
   * @throws {Error} If minimum payout is not met or no eligible bookings found
   */
  async requestPayout(hostId, paymentInfo) {
    const summary = await this.getEarningsSummary(hostId);

    if (summary.availableForPayout < 500) {
      throw new Error(`Minimum payout is PKR 500. Available: PKR ${Math.max(0, summary.availableForPayout)}`);
    }

    // Single-round-trip query: $lookup joins properties, $match filters by hostBy + eligibility
    const oid = new mongoose.Types.ObjectId(hostId);
    const escrowCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const eligibleBookings = await BookingModel.aggregate([
      {
        $lookup: {
          from: 'properties',
          let: { pid: '$propertyId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$pid'] } } },
            { $project: { hostBy: 1 } },
          ],
          as: '_prop',
        },
      },
      { $unwind: '$_prop' },
      {
        $match: {
          '_prop.hostBy': oid,
          paymentStatus: 'paid',
          paymentMethod: 'stripe', // cash never enters the platform, so it can't be paid out
          checkOut: { $lt: escrowCutoff },
          // Exclude bookings with a pending refund request — the full amount is still
          // counted as netPrice at this stage (refundAmount is only subtracted once the
          // refund moves to 'processing' or 'approved'). Including them would let the
          // host withdraw money that may later be paid back to the guest by Stripe.
          refundStatus: { $ne: 'requested' },
        },
      },
      {
        $addFields: {
          netPrice: {
            $subtract: [
              { $ifNull: ['$totalPrice', 0] },
              {
                $cond: [
                  { $in: ['$refundStatus', ['approved', 'processing']] },
                  { $ifNull: ['$refundAmount', 0] },
                  0
                ]
              }
            ]
          }
        }
      },
    ]);

    // We also need to check which bookings haven't been included in a SUCCESSFUL payout yet
    const previousPayouts = await Payout.find({ hostId, status: { $in: ['pending', 'processing', 'completed'] } });
    const usedBookingIds = new Set(previousPayouts.flatMap(p => p.bookings.map(id => id.toString())));

    const finalEligibleBookings = eligibleBookings.filter(b => !usedBookingIds.has(b._id.toString()) && b.netPrice > 0);

    if (finalEligibleBookings.length === 0) {
      throw new Error('No eligible bookings found for payout.');
    }

    // Compute payout amounts strictly from the bookings being linked to THIS payout.
    // Using summary.availableForPayout (the global balance) caused ledger drift when
    // earlier payouts had already been deducted from the host's available balance.
    const payoutGross = finalEligibleBookings.reduce((s, b) => s + (b.netPrice || 0), 0);
    const payoutFee = Math.round(payoutGross * PLATFORM_FEE_PERCENT / 100);

    // MED-3 fix: settle the host's outstanding cash-booking commission debt at payout
    // time and zero the debt counter. Without this, debt accumulated but was never
    // cleared, and the host received the full 90% every time while still owing separately.
    const hostRecord = await UserAndHostModel.findById(hostId).select('outstandingDebt');
    const outstandingDebt = hostRecord?.outstandingDebt || 0;
    const payoutNet = Math.max(0, payoutGross - payoutFee - outstandingDebt);

    const payout = await Payout.create({
      hostId,
      bookings: finalEligibleBookings.map(b => b._id),
      amount: payoutGross,
      platformFee: payoutFee + outstandingDebt, // total platform take = Stripe fee + settled cash debt
      netAmount: payoutNet,
      paymentMethod: paymentInfo.paymentMethod,
      status: 'pending',
    });

    // Zero out the settled debt so it isn't double-deducted on the next payout
    if (outstandingDebt > 0) {
      await UserAndHostModel.findByIdAndUpdate(hostId, { $set: { outstandingDebt: 0 } });
    }

    return payout;
  }
}

export default new PaymentService();
