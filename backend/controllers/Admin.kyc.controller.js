// --- Imports ---

import UserAndHost from "../models/UserAndHostModel.js";
import {
  notifyUser
} from "../utils/notificationHelper.js";
import { sendRejectionEmail } from "../middlewares/Emails/UserRegisterEmail.js";

// --- KYC Management ---

/**
 * Retrieves the queue of users pending identity verification (KYC).
 * Filters for users who have actually submitted CNIC images.
 * 
 * @async
 * @function getKycQueue
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getKycQueue = async (req, res) => {
  try {
    const baseQuery = {
      isVerified: 'pending',
      isDeleted: false,
      'cnicImage.frontImage.url': { $exists: true, $ne: null },
    };
    const selectFields = 'username email role profileImage cnicData cnicImage selfieImage createdAt kycAiAttempts';

    const [hosts, guests] = await Promise.all([
      UserAndHost.find({ ...baseQuery, role: 'host' }).select(selectFields).sort({ createdAt: -1 }),
      UserAndHost.find({ ...baseQuery, role: 'guest' }).select(selectFields).sort({ createdAt: -1 }),
    ]);

    res.json({
      success: true,
      hosts,
      guests,
      hostCount: hosts.length,
      guestCount: guests.length,
      count: hosts.length + guests.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Manually approves or rejects a user's identity verification (KYC) request.
 * Records an audit trail of which admin performed the action.
 * 
 * @async
 * @function verifyKyc
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const verifyKyc = async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      action,
      rejectedReason
    } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'approve' or 'reject'"
      });
    }

    const user = await UserAndHost.findById(id);
    if (!user) return res.status(404).json({
      success: false,
      message: 'User not found'
    });

    const status = action === 'approve' ? 'verified' : 'rejected';
    user.isVerified = status;

    // Audit trail — always record who acted and when
    if (!user.cnicData) user.cnicData = {};
    user.cnicData.kycReviewedBy = req.user._id;
    user.cnicData.kycReviewedAt = new Date();
    user.markModified('cnicData');

    if (status === 'rejected') {
      user.rejectedReason = rejectedReason?.trim() || 'KYC verification failed during manual review.';
      // Reset guest AI attempt counter so they can retry with fresh AI attempts
      if (user.role === 'guest') {
        user.kycAiAttempts = 0;
      }
    } else {
      user.rejectedReason = undefined;
      user.cnicData.verifiedAt = new Date();
    }

    await user.save({
      validateBeforeSave: false
    });

    const isHost = user.role === 'host';
    await notifyUser(user._id, 'user:kyc_update', {
      title: status === 'verified' ? 'Identity Verified!' : 'Identity Verification Failed',
      message: status === 'verified'
        ? (isHost ? 'Your identity verified. You can now list properties!' : 'Your identity verified. Welcome to BookVibe!')
        : `Your identity verification was rejected. Reason: ${user.rejectedReason}`,
      type: 'verification',
      severity: status === 'verified' ? 'success' : 'danger',
      link: status === 'verified' ? (isHost ? '/host/dashboard' : '/') : '/resubmit-verification',
    });

    if (status === 'rejected') {
      sendRejectionEmail(user.username, user.email, user.rejectedReason)
        .catch((e) => console.error('[Email] KYC rejection email failed:', e.message));
    }

    res.json({
      success: true,
      message: `KYC ${status === 'verified' ? 'Approved' : 'Rejected'} successfully`,
      user: {
        id: user._id,
        username: user.username,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
