// --- Imports ---

import crypto from "crypto";
import jwt from "jsonwebtoken";
import UserAndHost from "../models/UserAndHostModel.js";
import BookingModel from "../models/BookingModel.js";
import PropertyModel from "../models/PropertyModel.js";
import Complaint from "../models/Complaintmodel.js";
import Blacklist from "../models/BlacklistModel.js";
import cloudinary from "../middlewares/cloudinary.js";
import { notifyUser } from "../utils/notificationHelper.js";
import notificationService from "../services/notification.service.js";
import { sendRejectionEmail } from "../middlewares/Emails/UserRegisterEmail.js";

// --- Dashboard Stats ---

/**
 * Retrieves overall administrative statistics for the dashboard.
 * 
 * @async
 * @function getAdminStats
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalHosts,
      totalBookings,
      revenueAgg,
      pendingVerifications,
      openComplaints
    ] = await Promise.all([
      UserAndHost.countDocuments({ role: 'guest' }),
      UserAndHost.countDocuments({ role: 'host' }),
      BookingModel.countDocuments(),
      BookingModel.aggregate([
        { $match: { paymentStatus: 'paid' } },
        {
          $addFields: {
            netPrice: {
              $subtract: [
                { $ifNull: ['$totalPrice', 0] },
                {
                  $cond: [
                    { $in: ['$refundStatus', ['requested', 'approved', 'processing']] },
                    { $ifNull: ['$refundAmount', 0] },
                    0
                  ]
                }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$netPrice' }
          }
        }
      ]),
      UserAndHost.countDocuments({
        role: 'host',
        isVerified: 'pending'
      }),
      Complaint ? await Complaint.countDocuments({
        status: { $in: ['open', 'reviewing'] }
      }).catch(() => 0) : 0,
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;
    res.json({
      success: true,
      stats: {
        totalUsers,
        totalHosts,
        totalBookings,
        totalRevenue,
        totalCommission: Math.round(totalRevenue * 0.10),
        pendingVerifications,
        openComplaints,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// --- User Management ---

/**
 * Retrieves all non-deleted users from the database.
 * 
 * @async
 * @function getAllUsers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      UserAndHost.find({})
        .select('-password -refreshTokenHash -refreshTokenExpiresAt -otpHash -otpExpiresAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      UserAndHost.countDocuments({}),
    ]);

    res.json({ success: true, users, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves the most recently registered users.
 * 
 * @async
 * @function getRecentUsers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getRecentUsers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const users = await UserAndHost.find({})
      .select('username email role profileImage createdAt isEmailVerified')
      .sort({
        createdAt: -1
      })
      .limit(limit);
    res.json({
      success: true,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// --- Host Management ---

/**
 * Retrieves all non-deleted host accounts.
 * 
 * @async
 * @function getAllHosts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getAllHosts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const [hosts, total] = await Promise.all([
      UserAndHost.find({ role: 'host' })
        .select('-password -refreshTokenHash -refreshTokenExpiresAt -otpHash -otpExpiresAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      UserAndHost.countDocuments({ role: 'host' }),
    ]);

    res.json({ success: true, hosts, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves all hosts pending verification.
 * 
 * @async
 * @function getPendingHosts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getPendingHosts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const hosts = await UserAndHost.find({
        role: 'host',
        isVerified: 'pending'
      })
      .select('-password -refreshTokenHash -refreshTokenExpiresAt')
      .sort({
        createdAt: -1
      })
      .limit(limit);
    res.json({
      success: true,
      hosts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// --- Host Verification ---

/**
 * Approves or rejects a host's verification request.
 * 
 * @async
 * @function verifyHost
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const verifyHost = async (req, res) => {
  try {
    const {
      status,
      rejectedReason
    } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be verified or rejected'
      });
    }

    const host = await UserAndHost.findById(req.params.id);
    if (!host) return res.status(404).json({
      success: false,
      message: 'User not found'
    });

    host.isVerified = status;
    if (status === 'rejected') host.rejectedReason = rejectedReason || 'Application rejected by admin';
    if (status === 'verified') {
      host.isEmailVerified = true;
      host.rejectedReason = undefined;
    }
    await host.save({
      validateBeforeSave: false
    });

    const isHost = host.role === 'host';
    await notifyUser(host._id, 'verification:update', {
      title: status === 'verified' ? 'Account Approved!' : 'Verification Rejected',
      message: status === 'verified'
        ? (isHost ? 'Your host account is verified. You can now list properties!' : 'Your account is verified. Welcome to BookVibe!')
        : `Your verification was rejected. Reason: ${rejectedReason || 'Contact support'}`,
      type: 'verification',
      severity: status === 'verified' ? 'success' : 'danger',
      link: status === 'verified' ? (isHost ? '/host/dashboard' : '/') : '/resubmit-verification',
    });

    if (status === 'rejected') {
      sendRejectionEmail(host.username, host.email, rejectedReason)
        .catch((e) => console.error('[Email] Rejection email failed:', e.message));
    }

    res.json({
      success: true,
      message: `User ${status}`,
      host
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// --- User Access Control ---

/**
 * Blocks a user account, preventing access.
 * 
 * @async
 * @function blockUser
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const blockUser = async (req, res) => {
  try {
    const user = await UserAndHost.findById(req.params.id).select('username email role isBlocked');

    if (!user) return res.status(404).json({
      success: false,
      message: 'User not found'
    });

    // Admin accounts must not be blockable — otherwise admins could lock each
    // other (or themselves) out of the panel. Mirrors the guard in adminDeleteUser.
    if (user.role === 'admin') return res.status(403).json({
      success: false,
      message: 'Cannot block an admin account'
    });

    user.isBlocked = true;
    await user.save({ validateBeforeSave: false });

    await notifyUser(user._id, 'user:blocked', {
      title: 'Account Blocked',
      message: 'Your account has been blocked by admin. Contact support.',
      type: 'system',
      severity: 'danger',
    });

    res.json({
      success: true,
      message: `${user.username} blocked`,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Unblocks a previously blocked user account.
 * 
 * @async
 * @function unblockUser
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const unblockUser = async (req, res) => {
  try {
    const user = await UserAndHost.findByIdAndUpdate(
      req.params.id, {
        isBlocked: false
      }, {
        new: true
      }
    ).select('username email role isBlocked');

    if (!user) return res.status(404).json({
      success: false,
      message: 'User not found'
    });

    res.json({
      success: true,
      message: `${user.username} unblocked`,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// --- Property Management ---

/**
 * Approves or rejects a property listing.
 * 
 * @async
 * @function verifyProperty
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const verifyProperty = async (req, res) => {
  try {
    const {
      status,
      verificationNote
    } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be verified or rejected'
      });
    }

    const property = await PropertyModel.findById(req.params.id);
    if (!property) return res.status(404).json({
      success: false,
      message: 'Property not found'
    });

    property.verificationStatus = status;
    if (verificationNote) property.verificationNote = verificationNote;
    await property.save();

    // Clear cache so it shows up on home page
    try {
      const redis = (await import('../config/redis.js')).default;
      const keys = await redis.keys('bv:props:*');
      if (keys.length > 0) await redis.del(keys);
    } catch {
      /* ignore */
    }

    await notifyUser(property.hostBy, 'property:verified', {
      title: status === 'verified' ? 'Property Approved!' : 'Property Rejected',
      message: status === 'verified' ?
        `Your property "${property.name}" has been verified and is now live!` :
        `Your property "${property.name}" was rejected. Reason: ${verificationNote || 'Contact support'}`,
      type: 'verification',
      severity: status === 'verified' ? 'success' : 'danger',
      link: `/property/${property.type?.toLowerCase()}/${property._id}`,
    });

    res.json({
      success: true,
      message: `Property ${status}`,
      property
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// --- Deletion ---

/**
 * Performs a hard delete on a user account and handles related data.
 * 
 * @async
 * @function adminDeleteUser
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const adminDeleteUser = async (req, res) => {
  try {
    const user = await UserAndHost.findById(req.params.id);
    if (!user) return res.status(404).json({
      success: false,
      message: 'User not found'
    });
    if (user.role === 'admin') return res.status(403).json({
      success: false,
      message: 'Cannot delete admin'
    });

    // Permanently delete sensitive images from Cloudinary
    const imagePublicIds = []
    if (user.profileImage?.public_id) imagePublicIds.push(user.profileImage.public_id)
    if (user.cnicImage?.frontImage?.public_id) imagePublicIds.push(user.cnicImage.frontImage.public_id)
    if (user.cnicImage?.backImage?.public_id) imagePublicIds.push(user.cnicImage.backImage.public_id)
    if (user.selfieImage?.public_id) imagePublicIds.push(user.selfieImage.public_id)

    if (imagePublicIds.length > 0) {
      try {
        await Promise.all(imagePublicIds.map(id => cloudinary.uploader.destroy(id)))
      } catch (err) {
        console.error("Cloudinary cleanup error:", err)
      }
    }

    // Cancel future bookings
    await BookingModel.updateMany({
      userId: user._id,
      bookingStatus: 'confirmed',
      checkIn: { $gt: new Date() }
    }, {
      $set: { bookingStatus: 'cancel' }
    });

    // Make properties unavailable if host
    if (user.role === 'host') {
      await PropertyModel.updateMany({ hostBy: user._id }, { $set: { available: false } });
    }

    // Permanently remove user from database
    await UserAndHost.findByIdAndDelete(user._id);

    res.json({
      success: true,
      message: `${user.username} permanently deleted and sensitive data removed.`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// --- Analytics ---

/**
 * Retrieves platform analytics, including growth and revenue data.
 * 
 * @async
 * @function getAnalytics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getAnalytics = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    const [monthlyBookings, monthlyRevenue, userGrowth] = await Promise.all([
      BookingModel.aggregate([{
        $match: {
          createdAt: {
            $gte: new Date(`${currentYear}-01-01`)
          }
        }
      }, {
        $group: {
          _id: { month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      }, {
        $sort: { '_id.month': 1 }
      }]),
      BookingModel.aggregate([{
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: new Date(`${currentYear}-01-01`) }
        }
      }, {
        $addFields: {
          netPrice: {
            $subtract: [
              { $ifNull: ['$totalPrice', 0] },
              {
                $cond: [
                  { $in: ['$refundStatus', ['requested', 'approved', 'processing']] },
                  { $ifNull: ['$refundAmount', 0] },
                  0
                ]
              }
            ]
          }
        }
      }, {
        $group: {
          _id: { month: { $month: '$createdAt' } },
          total: { $sum: '$netPrice' }
        }
      }, {
        $sort: { '_id.month': 1 }
      }]),
      UserAndHost.aggregate([{
        $match: {
          createdAt: { $gte: new Date(`${currentYear}-01-01`) }
        }
      }, {
        $group: {
          _id: { month: { $month: '$createdAt' } },
          count: { $sum: 1 }
        }
      }, {
        $sort: { '_id.month': 1 }
      }]),
    ]);

    // Fill all 12 months
    const fillMonths = (data, key) => Array.from({ length: 12 }, (_, i) => {
      const found = data.find(d => d._id.month === i + 1);
      return {
        month: i + 1,
        [key]: found?.[key] || 0
      };
    });

    // Quick stats
    const thisMonthStart = new Date(currentYear, new Date().getMonth(), 1);
    const [thisMonthBookings, activeUsers, avgBookingAgg] = await Promise.all([
      BookingModel.countDocuments({
        createdAt: { $gte: thisMonthStart }
      }),
      UserAndHost.countDocuments({
        lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),
      BookingModel.aggregate([{
        $match: { paymentStatus: 'paid' }
      }, {
        $group: {
          _id: null,
          avg: { $avg: '$totalPrice' }
        }
      }]),
    ]);

    const lastMonthBookings = await BookingModel.countDocuments({
      createdAt: {
        $gte: new Date(currentYear, new Date().getMonth() - 1, 1),
        $lt: thisMonthStart
      }
    });
    const growthRate = lastMonthBookings > 0 ? `${Math.round(((thisMonthBookings - lastMonthBookings) / lastMonthBookings) * 100)}%` : 'N/A';

    const filledRevenue = fillMonths(monthlyRevenue, 'total');
    const totalYearRevenue = filledRevenue.reduce((s, m) => s + m.total, 0);
    const totalYearCommission = Math.round(totalYearRevenue * 0.10);

    res.json({
      success: true,
      analytics: {
        monthlyBookings: fillMonths(monthlyBookings, 'count'),
        monthlyRevenue: filledRevenue,
        userGrowth: fillMonths(userGrowth, 'count'),
        growthRate,
        avgBookingValue: Math.round(avgBookingAgg[0]?.avg || 0),
        activeUsers,
        thisMonthBookings,
        totalYearRevenue,
        totalYearCommission,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// --- Complaint Management ---

/**
 * Blocks a user's account and permanently blacklists their CNIC, email, and phone
 * so they can never re-register on BookVibe. Idempotent — safe to call repeatedly.
 *
 * @async
 * @function blockAndBlacklistUser
 * @param {Object} offender - The UserAndHost document (or lean object) to ban.
 * @param {Object} ctx - { reason, complaintId, adminId }.
 * @returns {Promise<void>}
 */
const blockAndBlacklistUser = async (offender, { reason, complaintId, adminId } = {}) => {
  if (!offender) return;

  await UserAndHost.findByIdAndUpdate(offender._id, { isBlocked: true });

  const cnicNumber = offender.cnicData?.cnicNumber || null;
  const email = offender.email ? offender.email.toLowerCase() : null;
  const phone = offender.phone || null;

  // Skip if nothing identifiable, or an entry for this user already exists.
  if (!cnicNumber && !email && !phone) return;
  const already = await Blacklist.findOne({
    $or: [
      { user: offender._id },
      ...(cnicNumber ? [{ cnicNumber }] : []),
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
    ],
  });
  if (already) return;

  await Blacklist.create({
    cnicNumber: cnicNumber || undefined,
    email: email || undefined,
    phone: phone || undefined,
    reason: reason || 'Blocked via complaint resolution',
    user: offender._id,
    complaint: complaintId || undefined,
    blacklistedBy: adminId || undefined,
  });
};

/**
 * Full population for an admin complaint detail view — both parties' KYC identity
 * (CNIC images, selfie, OCR data, contact), property, booking, conversation thread,
 * and resolver. Shared by the detail endpoint and the admin-message endpoint so a
 * freshly-sent admin reply is returned with identical shape.
 *
 * @type {Array<Object>}
 */
const ADMIN_COMPLAINT_DETAIL_POPULATE = [
  { path: 'complainant', select: 'username email phone profileImage role cnicImage selfieImage cnicData' },
  { path: 'against', select: 'username email phone profileImage role isBlocked cnicImage selfieImage cnicData' },
  { path: 'property', select: 'name type city images' },
  {
    path: 'booking',
    select: 'checkIn checkOut bookingStatus paymentStatus totalPrice propertyId',
    populate: { path: 'propertyId', select: 'name' },
  },
  { path: 'responses.from', select: 'username profileImage role' },
  { path: 'conversationThread.senderId', select: 'username role profileImage' },
  { path: 'resolvedBy', select: 'username' },
];

/**
 * Returns the appropriate complaints dashboard link for a given user role.
 *
 * @param {string} role - 'host' or any guest role.
 * @returns {string} The complaints page path for that role.
 */
const complaintLinkForRole = (role) => (role === 'host' ? '/host/complaints' : '/my-complaints');

/**
 * Retrieves all platform complaints for administrative review.
 *
 * @async
 * @function getAdminComplaints
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getAdminComplaints = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const [complaints, total] = await Promise.all([
      Complaint.find()
        .populate('complainant', 'username email profileImage role')
        .populate('against', 'username email profileImage role')
        .populate('property', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Complaint.countDocuments(),
    ]);

    res.json({ success: true, complaints, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Retrieves a single complaint with full detail for admin review — including the
 * offender's KYC identity (CNIC images, selfie, extracted CNIC data, contact) and
 * all attached evidence, so the admin can verify before deciding to block/blacklist.
 *
 * @async
 * @function getAdminComplaintDetail
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const getAdminComplaintDetail = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id).populate(ADMIN_COMPLAINT_DETAIL_POPULATE);

    if (!complaint) return res.status(404).json({
      success: false,
      message: 'Complaint not found'
    });

    // Surface whether the offender's identity is already blacklisted.
    const offender = complaint.against;
    let blacklistEntry = null;
    
    if (offender && (offender._id || offender.cnicData?.cnicNumber || offender.email)) {
      blacklistEntry = await Blacklist.findOne({
        $or: [
          { user: offender._id },
          ...(offender.cnicData?.cnicNumber ? [{ cnicNumber: offender.cnicData.cnicNumber }] : []),
          ...(offender.email ? [{ email: offender.email.toLowerCase() }] : []),
        ],
      }).lean();
    }

    res.json({ success: true, complaint, blacklisted: !!blacklistEntry });
  } catch (error) {
    console.error('[AdminController:getAdminComplaintDetail]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Updates a complaint's status and takes administrative action.
 * `adminAction: 'blocked'` is the "Block & Blacklist" decision — it blocks the
 * offender's account AND adds their CNIC/email/phone to the permanent blacklist.
 *
 * @async
 * @function updateAdminComplaint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const updateAdminComplaint = async (req, res) => {
  try {
    const {
      status,
      adminResponse,
      adminAction,
      warnTarget // 'complainant' | 'against' — who the warning is directed at
    } = req.body;

    const willBlacklist = adminAction === 'blocked';

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, {
        status,
        adminResponse,
        adminAction: adminAction || 'none',
        ...(warnTarget ? { warnTarget } : {}),
        ...(willBlacklist ? { blacklisted: true } : {}),
        ...(status === 'resolved' || status === 'dismissed' ? {
          resolvedAt: new Date(),
          resolvedBy: req.user._id
        } : {}),
      }, {
        new: true
      })
      .populate('complainant', 'username role')
      .populate('against', 'username role email phone cnicData');

    if (!complaint) return res.status(404).json({
      success: false,
      message: 'Not found'
    });

    if (willBlacklist && complaint.against) {
      await blockAndBlacklistUser(complaint.against, {
        reason: `Complaint #${complaint._id}: ${complaint.subject}`,
        complaintId: complaint._id,
        adminId: req.user._id,
      });
      await notifyUser(complaint.against._id, 'user:blocked', {
        title: 'Account Blocked & Banned',
        message: 'Your account has been blocked and your identity permanently banned from BookVibe following a complaint.',
        type: 'system',
        severity: 'danger',
      });
    } else if (adminAction === 'warning' || adminAction === 'warn_both') {
      if ((adminAction === 'warn_both' || warnTarget === 'against') && complaint.against) {
        await notifyUser(complaint.against._id, 'complaint:updated', {
          title: 'Warning Issued',
          message: `An admin issued you a warning regarding the complaint "${complaint.subject}". Please adhere to community guidelines to avoid further action.`,
          type: 'complaint',
          severity: 'warning',
          link: complaintLinkForRole(complaint.against.role),
        });
      }
      if (warnTarget === 'complainant' && complaint.against) {
        await notifyUser(complaint.against._id, 'complaint:updated', {
          title: `Complaint ${status}`,
          message: adminResponse || `The complaint "${complaint.subject}" has been ${status}.`,
          type: 'complaint',
          severity: 'info',
          link: complaintLinkForRole(complaint.against.role),
        });
      }
    } else if ((status === 'resolved' || status === 'dismissed') && complaint.against) {
      await notifyUser(complaint.against._id, 'complaint:updated', {
        title: `Complaint ${status}`,
        message: adminResponse || `The complaint "${complaint.subject}" against you has been ${status} by admin.`,
        type: 'complaint',
        severity: status === 'resolved' ? 'info' : 'info',
        link: complaintLinkForRole(complaint.against.role),
      });
    }

    await notifyUser(complaint.complainant._id, 'complaint:updated', {
      title: adminAction === 'warn_both' ? 'Warning Issued (Both Parties)' : (warnTarget === 'complainant' && adminAction === 'warning' ? 'Warning Issued' : `Complaint ${status}`),
      message: adminResponse || (adminAction === 'warn_both'
        ? `An admin has issued a formal warning to both parties involved in this dispute regarding "${complaint.subject}".`
        : (warnTarget === 'complainant' && adminAction === 'warning'
          ? `An admin issued you a warning regarding your complaint "${complaint.subject}".`
          : `Your complaint has been ${status}.`)),
      type: 'complaint',
      severity: (adminAction === 'warn_both' || (warnTarget === 'complainant' && adminAction === 'warning')) ? 'warning' : (status === 'resolved' ? 'success' : status === 'dismissed' ? 'warning' : 'info'),
      link: complaintLinkForRole(complaint.complainant.role),
    });

    res.json({
      success: true,
      message: `Complaint ${status}`,
      complaint
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Posts an admin message into a complaint's conversation thread and delivers it to
 * BOTH parties (complainant + accused). The message is appended to `responses`
 * (authored by the admin) and also stored as `adminResponse` so it surfaces as the
 * official admin reply on every dashboard. Both parties are notified.
 *
 * @async
 * @function sendAdminComplaintMessage
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const sendAdminComplaintMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const complaint = await Complaint.findById(req.params.id)
      .populate('complainant', 'username role')
      .populate('against', 'username role');

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const text = message.trim();
    complaint.conversationThread.push({
      senderId: req.user._id,
      senderRole: 'Admin',
      messageText: text,
      createdAt: new Date(),
    });
    complaint.adminResponse = text;
    await complaint.save();

    const preview = text.length > 120 ? `${text.slice(0, 120)}…` : text;
    await Promise.all([complaint.complainant, complaint.against].map((party) =>
      party
        ? notifyUser(party._id, 'complaint:response', {
            title: 'Admin Responded',
            message: `Admin: ${preview}`,
            type: 'complaint',
            severity: 'info',
            link: complaintLinkForRole(party.role),
          })
        : null
    ));

    const populated = await Complaint.findById(complaint._id).populate(ADMIN_COMPLAINT_DETAIL_POPULATE);

    notificationService.emitRaw(`user:${complaint.complainant._id}`, 'complaint:message', { complaint: populated });
    notificationService.emitRaw(`user:${complaint.against._id}`, 'complaint:message', { complaint: populated });
    notificationService.emitRaw('admin', 'complaint:message', { complaint: populated });

    res.json({ success: true, message: 'Response sent to both parties', complaint: populated });
  } catch (error) {
    console.error('[AdminController:sendAdminComplaintMessage]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Blacklist Management ---

/**
 * Lists all blacklist (permanent ban) entries.
 *
 * @async
 * @function getBlacklist
 */
const getBlacklist = async (req, res) => {
  try {
    const entries = await Blacklist.find()
      .populate('user', 'username email profileImage role')
      .populate('blacklistedBy', 'username')
      .populate('complaint', 'subject')
      .sort({ createdAt: -1 });
    res.json({ success: true, entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Manually adds a CNIC / email / phone to the blacklist.
 *
 * @async
 * @function addBlacklistEntry
 */
const addBlacklistEntry = async (req, res) => {
  try {
    const cnicNumber = req.body.cnicNumber?.trim() || undefined;
    const email = req.body.email?.trim().toLowerCase() || undefined;
    const phone = req.body.phone?.trim() || undefined;
    const reason = req.body.reason?.trim() || 'Banned by admin';

    if (!cnicNumber && !email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one of CNIC, email, or phone to blacklist'
      });
    }

    const entry = await Blacklist.create({
      cnicNumber, email, phone, reason, blacklistedBy: req.user._id,
    });

    // If an account exists with any of these identifiers, block it too.
    const orConds = [
      ...(cnicNumber ? [{ 'cnicData.cnicNumber': cnicNumber }] : []),
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
    ];
    if (orConds.length) {
      await UserAndHost.updateMany({ $or: orConds }, { isBlocked: true });
    }

    res.status(201).json({ success: true, message: 'Added to blacklist', entry });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'That identifier is already blacklisted' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Removes a blacklist entry, lifting the ban so re-registration is allowed again.
 *
 * @async
 * @function removeBlacklistEntry
 */
const removeBlacklistEntry = async (req, res) => {
  try {
    const entry = await Blacklist.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, message: 'Blacklist entry removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- Security ---

/**
 * Verifies the administrative security PIN.
 * 
 * @async
 * @function verifyAdminPin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const verifyAdminPin = async (req, res) => {
  try {
    const {
      pin
    } = req.body;
    if (!pin) return res.status(400).json({
      success: false,
      message: 'PIN required'
    });
    if (req.user.role !== 'admin') return res.status(403).json({
      success: false,
      message: 'Access denied'
    });

    const correctPin = (process.env.ADMIN_PIN || '000000').toString();
    const submittedPin = pin.toString();

    // MED-6 fix: use constant-time comparison to prevent timing-based PIN enumeration.
    // Pad both buffers to the same fixed length so comparison time is always equal.
    const FIXED_LEN = 64;
    const a = Buffer.alloc(FIXED_LEN);
    const b = Buffer.alloc(FIXED_LEN);
    a.write(submittedPin);
    b.write(correctPin);
    const match = crypto.timingSafeEqual(a, b) && submittedPin === correctPin;

    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Invalid security PIN'
      });
    }

    const gateToken = jwt.sign(
      { adminGate: true, uid: req.user._id },
      process.env.ACCESS_TOKEN_SECRET_KEY || process.env.JWT_SECRET_KEY,
      { expiresIn: '8h' }
    );
    res.json({
      success: true,
      message: 'PIN verified',
      gateToken,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};

// --- Exports ---

export {
  getAdminStats,
  getAllUsers,
  getRecentUsers,
  getAllHosts,
  getPendingHosts,
  verifyHost,
  blockUser,
  unblockUser,
  adminDeleteUser,
  getAnalytics,
  getAdminComplaints,
  getAdminComplaintDetail,
  updateAdminComplaint,
  sendAdminComplaintMessage,
  getBlacklist,
  addBlacklistEntry,
  removeBlacklistEntry,
  verifyAdminPin,
  verifyProperty,
};
