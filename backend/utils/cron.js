/**
 * @fileoverview Scheduled cron jobs for booking lifecycle management
 * @module utils/cron
 */

import cron from 'node-cron';
import BookingModel from '../models/BookingModel.js';
import sendDailyAdminDigest from './adminDigest.js';

/* -------------------------------------------------------------------------- */
/*                                Cron Jobs                                   */
/* -------------------------------------------------------------------------- */

/**
 * PRODUCTION CRON JOBS
 * Runs periodically to manage booking lifecycles and escrow releases.
 * 
 * 1. Transitions 'confirmed' bookings to 'staying' at check-in time.
 * 2. Transitions 'staying' bookings to 'completed' at check-out time.
 */
const initCronJobs = () => {
  // 1. Mark 'confirmed' bookings as 'staying' once the actual check-in moment has passed.
  // We cannot compare checkIn (midnight Date) + checkInTime (HH:MM string) in a single
  // MongoDB query, so we fetch same-day candidates and filter in JS.
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      // Fetch confirmed bookings whose check-in date is today or earlier (date-only comparison).
      const candidates = await BookingModel.find({
        bookingStatus: 'confirmed',
        checkIn: { $lte: now },
        paymentStatus: 'paid',
      }).select('_id checkIn checkInTime');

      const readyIds = candidates
        .filter((b) => {
          if (!b.checkInTime) return true; // no time stored → treat as ready
          const [h, m] = b.checkInTime.split(':').map(Number);
          const checkInAt = new Date(b.checkIn);
          checkInAt.setHours(h, m, 0, 0);
          return checkInAt <= now;
        })
        .map((b) => b._id);

      if (readyIds.length > 0) {
        const result = await BookingModel.updateMany(
          { _id: { $in: readyIds } },
          { $set: { bookingStatus: 'staying' } }
        );
        if (result.modifiedCount > 0) {
          console.log(`[Cron] Transitioned ${result.modifiedCount} bookings to 'staying'`);
        }
      }
    } catch (error) {
      console.error('[Cron Error] Status transition:', error.message);
    }
  });

  // 2. Mark 'staying' bookings as 'completed' if check-out time has passed
  cron.schedule('30 * * * *', async () => {
    try {
      const now = new Date();
      const result = await BookingModel.updateMany(
        {
          bookingStatus: 'staying',
          checkOut: { $lte: now }
        },
        { $set: { bookingStatus: 'completed' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Cron] Transitioned ${result.modifiedCount} bookings to 'completed'`);
      }
    } catch (error) {
      console.error('[Cron Error] Completion transition:', error.message);
    }
  });

  // 3. Email a 24h platform-activity digest to opted-in admins, once a day at 8 AM.
  cron.schedule('0 8 * * *', () => {
    sendDailyAdminDigest();
  });
};

export default initCronJobs;
