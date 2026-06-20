/**
 * @fileoverview Trust & Fraud Engine for risk assessment
 * @module services/trust
 */

import BookingModel from "../models/BookingModel.js";
import UserAndHost from "../models/UserAndHostModel.js";

/* -------------------------------------------------------------------------- */
/*                                Risk Scoring                                */
/* -------------------------------------------------------------------------- */

/**
 * Trust & Fraud Engine Scoring Logic
 * Calculates a risk score for a potential booking based on user verification,
 * host debt, and booking history.
 * 
 * @param {Object} guestUser - The guest user document
 * @param {Object} hostUser - The host user document
 * @returns {Promise<number>} The calculated risk score (0-100)
 */
export const calculateRiskScore = async (guestUser, hostUser) => {
  let riskScore = 0;

  // 1. If guestUser.isVerified is NOT 'verified' or guestUser.cnicData is missing: Add +50.
  if (guestUser.isVerified !== 'verified' || !guestUser.cnicData?.cnicNumber) {
    riskScore += 50;
  }

  // 2. If hostUser.outstandingDebt exists and is > 5000: Add +30.
  if (hostUser.outstandingDebt && hostUser.outstandingDebt > 5000) {
    riskScore += 30;
  }

  // 3. If guestUser has 0 previous successful bookings: Add +20.
  const successfulBookingsCount = await BookingModel.countDocuments({
    userId: guestUser._id,
    bookingStatus: { $in: ["confirmed", "staying", "completed"] },
    paymentStatus: "paid"
  });

  if (successfulBookingsCount === 0) {
    riskScore += 20;
  }

  return riskScore;
};

/**
 * High-level risk analysis for a new booking request.
 * 
 * @param {string} userId - The guest's user ID
 * @param {Object} property - The property being booked
 * @returns {Promise<Object>} Analysis results
 */
export const analyzeBookingRisk = async (userId, property) => {
  try {
    const guestUser = await UserAndHost.findById(userId);
    const hostUser = await UserAndHost.findById(property.hostBy);

    if (!guestUser || !hostUser) {
      return { requiresSecurityDeposit: false, riskScore: 0 };
    }

    const riskScore = await calculateRiskScore(guestUser, hostUser);

    // Rule: if risk score is 50 or higher, trigger mandatory security deposit
    const requiresSecurityDeposit = riskScore >= 50;

    return {
      requiresSecurityDeposit,
      riskScore
    };
  } catch (error) {
    console.error('[trustService:analyzeBookingRisk]', error);
    return { requiresSecurityDeposit: false, riskScore: 0 };
  }
};

export default {
  calculateRiskScore,
  analyzeBookingRisk
};
