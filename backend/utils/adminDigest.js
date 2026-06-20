/**
 * @fileoverview Aggregates the last 24h of platform activity and emails it to
 * every admin who has settings.notifications.emailDigest enabled.
 * @module utils/adminDigest
 */

import UserAndHost from '../models/UserAndHostModel.js';
import BookingModel from '../models/BookingModel.js';
import Complaint from '../models/Complaintmodel.js';
import { sendAdminDigestEmail } from '../middlewares/Emails/AdminDigestEmail.js';

const PLATFORM_FEE_PERCENT = 10;

/**
 * Gathers 24h platform stats and emails the digest to opted-in admins.
 * @returns {Promise<void>}
 */
const sendDailyAdminDigest = async () => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [newUsers, newBookings, paidBookings, newComplaints, pendingKyc, admins] = await Promise.all([
      UserAndHost.countDocuments({ createdAt: { $gte: since }, isDeleted: false }),
      BookingModel.countDocuments({ createdAt: { $gte: since } }),
      BookingModel.find({ createdAt: { $gte: since }, paymentStatus: 'paid' }).select('totalPrice'),
      Complaint.countDocuments({ createdAt: { $gte: since } }),
      UserAndHost.countDocuments({ role: 'host', isVerified: 'pending' }),
      UserAndHost.find({
        role: 'admin',
        isDeleted: false,
        'settings.notifications.emailDigest': { $ne: false },
      }).select('username email'),
    ]);

    if (!admins.length) return;

    const revenue = paidBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const commission = Math.round(revenue * PLATFORM_FEE_PERCENT / 100);

    const stats = { newUsers, newBookings, revenue, commission, newComplaints, pendingKyc };

    await Promise.all(
      admins.map((admin) => sendAdminDigestEmail(admin.username, admin.email, stats))
    );
    console.log(`[Admin Digest] Sent to ${admins.length} admin(s)`);
  } catch (error) {
    console.error('[Admin Digest] Failed:', error.message);
  }
};

export default sendDailyAdminDigest;
