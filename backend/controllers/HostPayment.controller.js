/**
 * @file Host Payment Controller
 * @description Handles host payment information, earnings, and payout requests.
 */

// Section: Imports
import HostPaymentInfo from '../models/HostPaymentInfoModel.js';
import Payout from '../models/PayoutModel.js';
import paymentService from '../services/payment.service.js';
import notificationService from '../services/notification.service.js';

// Section: Host Payment Information

/**
 * Saves or updates payment information for a host.
 * 
 * @async
 * @function savePaymentInfo
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const savePaymentInfo = async (req, res) => {
  try {
    const hostId = req.user._id;
    const {
      paymentMethod,
      bankDetails,
      mobileWallet
    } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment method required'
      });
    }

    if (paymentMethod === 'bank_transfer') {
      if (!bankDetails?.bankName?.trim() || !bankDetails?.accountTitle?.trim() || !bankDetails?.accountNumber?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Bank name, account title, and account number are required'
        });
      }
    } else if (paymentMethod === 'easypaisa' || paymentMethod === 'jazzcash') {
      if (!mobileWallet?.accountName?.trim() || !mobileWallet?.phoneNumber?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Account name and phone number are required'
        });
      }
    }

    let mobileWalletData = undefined;
    if (paymentMethod === 'easypaisa' || paymentMethod === 'jazzcash') {
      mobileWalletData = {
        ...mobileWallet,
        provider: paymentMethod
      };
    }

    const existing = await HostPaymentInfo.findOne({ hostId });

    // Only re-trigger verification when the destination details actually changed.
    // Previously this unconditionally reset isVerified:false on every save, so a
    // host re-opening and re-submitting the SAME already-verified details (or any
    // resubmission at all) silently revoked their verification while leaving the
    // old verifiedAt/verifiedBy stamped — admin would verify, then a stray resave
    // would un-verify it again with no visible cause.
    const sameBank = paymentMethod === 'bank_transfer'
      && existing?.paymentMethod === 'bank_transfer'
      && (existing.bankDetails?.bankName || '') === (bankDetails?.bankName || '')
      && (existing.bankDetails?.accountTitle || '') === (bankDetails?.accountTitle || '')
      && (existing.bankDetails?.accountNumber || '') === (bankDetails?.accountNumber || '')
      && (existing.bankDetails?.iban || '') === (bankDetails?.iban || '')
      && (existing.bankDetails?.branchCode || '') === (bankDetails?.branchCode || '');

    const sameWallet = (paymentMethod === 'easypaisa' || paymentMethod === 'jazzcash')
      && existing?.paymentMethod === paymentMethod
      && (existing.mobileWallet?.accountName || '') === (mobileWallet?.accountName || '')
      && (existing.mobileWallet?.phoneNumber || '') === (mobileWallet?.phoneNumber || '');

    const detailsUnchanged = !!existing && (sameBank || sameWallet);

    const update = {
      hostId,
      paymentMethod,
      bankDetails: paymentMethod === 'bank_transfer' ? bankDetails : undefined,
      mobileWallet: mobileWalletData,
    };
    if (!detailsUnchanged) {
      update.isVerified = false;
      update.verifiedAt = null;
      update.verifiedBy = null;
    }

    const info = await HostPaymentInfo.findOneAndUpdate(
      {
        hostId
      },
      update,
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    if (!detailsUnchanged) {
      await notificationService.notifyAdmin('payment:info:submitted', {
        title: 'Host Payment Info Needs Verification',
        message: `${req.user.username} added/updated their ${paymentMethod.replace('_', ' ')} details — please verify.`,
        type: 'payment',
        severity: 'warning',
      });
    }

    return res.json({
      success: true,
      message: detailsUnchanged ? 'Payment info saved.' : 'Payment info saved. Admin will verify.',
      paymentInfo: info
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves the payment information for the logged-in host.
 * 
 * @async
 * @function getMyPaymentInfo
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const getMyPaymentInfo = async (req, res) => {
  try {
    const info = await HostPaymentInfo.findOne({
      hostId: req.user._id
    });
    return res.json({
      success: true,
      paymentInfo: info
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Section: Earnings and Payouts

/**
 * Retrieves the earnings summary for the logged-in host.
 * 
 * @async
 * @function getEarningsSummary
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const getEarningsSummary = async (req, res) => {
  try {
    const earnings = await paymentService.getEarningsSummary(req.user._id);
    return res.json({
      success: true,
      earnings
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Initiates a payout request for the logged-in host.
 * 
 * @async
 * @function requestPayout
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const requestPayout = async (req, res) => {
  try {
    const hostId = req.user._id;
    const paymentInfo = await HostPaymentInfo.findOne({
      hostId
    });

    if (!paymentInfo || !paymentInfo.isVerified) {
      let message = 'Please add payment details';
      if (paymentInfo) {
        message = 'Payment details not verified yet';
      }
      return res.status(400).json({
        success: false,
        message: message
      });
    }

    const activePayout = await Payout.findOne({
      hostId,
      status: {
        $in: ['pending', 'processing']
      }
    });
    if (activePayout) {
      return res.status(400).json({
        success: false,
        message: 'Payout already in progress'
      });
    }

    const payout = await paymentService.requestPayout(hostId, paymentInfo);

    await notificationService.notifyAdmin('payout:requested', {
      title: 'Payout Request',
      message: `${req.user.username} requested PKR ${payout.netAmount.toLocaleString()} payout`,
      type: 'payment',
      severity: 'warning',
    });

    return res.json({
      success: true,
      message: 'Payout requested',
      payout
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Retrieves all payout requests for the logged-in host.
 * 
 * @async
 * @function getMyPayouts
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const getMyPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find({
      hostId: req.user._id
    }).sort({
      createdAt: -1
    });
    return res.json({
      success: true,
      payouts
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Section: Admin Operations

/**
 * Retrieves all payout requests (Admin only). Each payout is annotated with the
 * requesting host's saved payment info (bank/wallet) so the admin knows where to
 * actually send the money — the Payout record itself only stores the method type.
 *
 * @async
 * @function getAllPayoutRequests
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const getAllPayoutRequests = async (req, res) => {
  try {
    const payouts = await Payout.find()
      .populate('hostId', 'username email profileImage')
      .sort({
        createdAt: -1
      });

    const hostIds = [...new Set(
      payouts.map((p) => p.hostId?._id?.toString()).filter(Boolean)
    )];
    const paymentInfos = await HostPaymentInfo.find({ hostId: { $in: hostIds } });
    const infoByHost = new Map(paymentInfos.map((i) => [i.hostId.toString(), i]));

    const payoutsWithPaymentInfo = payouts.map((p) => {
      const obj = p.toObject();
      obj.paymentInfo = p.hostId ? (infoByHost.get(p.hostId._id.toString()) || null) : null;
      return obj;
    });

    return res.json({
      success: true,
      payouts: payoutsWithPaymentInfo
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/** Statuses an admin is allowed to move a payout into via {@link processPayout}. */
const ADMIN_SETTABLE_STATUSES = ['processing', 'completed', 'failed'];

/**
 * Processes a payout request by updating its status and transaction details (Admin only).
 * Guards against re-processing an already-finalized payout (which would otherwise let
 * the linked bookings be released back into a future payout, double-paying the host),
 * and requires a transaction reference before a payout can be marked complete.
 *
 * @async
 * @function processPayout
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const processPayout = async (req, res) => {
  try {
    const {
      status,
      transactionRef,
      transactionNote
    } = req.body;

    if (!ADMIN_SETTABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${ADMIN_SETTABLE_STATUSES.join(', ')}`
      });
    }

    const payout = await Payout.findById(req.params.id);
    if (!payout) {
      return res.status(404).json({
        success: false,
        message: 'Payout not found'
      });
    }

    if (payout.status === 'completed' || payout.status === 'failed') {
      return res.status(400).json({
        success: false,
        message: `This payout has already been ${payout.status} and cannot be modified.`
      });
    }

    if (status === 'completed' && !transactionRef?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A transaction reference is required to mark a payout as completed.'
      });
    }

    payout.status = status;
    payout.processedBy = req.user._id;
    if (transactionRef) {
      payout.transactionRef = transactionRef;
    }
    if (transactionNote) {
      payout.transactionNote = transactionNote;
    }

    if (status === 'processing') {
      payout.processedAt = new Date();
    }
    if (status === 'completed') {
      payout.completedAt = new Date();
    }

    await payout.save();

    await notificationService.notifyHost(payout.hostId, 'payout:updated', {
      title: `Payout ${status}`,
      message: status === 'completed'
        ? `Your payout of PKR ${payout.netAmount.toLocaleString()} has been sent. Ref: ${payout.transactionRef}`
        : status === 'failed'
        ? `Your payout request of PKR ${payout.netAmount.toLocaleString()} failed. Contact support for details.`
        : `Your payout of PKR ${payout.netAmount.toLocaleString()} is now being processed.`,
      type: 'payment',
      severity: status === 'completed' ? 'success' : status === 'failed' ? 'danger' : 'info',
    });

    return res.json({
      success: true,
      payout
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Lists every host's saved payment info for admin review/verification, pending
 * (unverified) entries first.
 *
 * @async
 * @function getAllPaymentInfo
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const getAllPaymentInfo = async (req, res) => {
  try {
    const paymentInfos = await HostPaymentInfo.find()
      .populate('hostId', 'username email phone')
      .sort({ isVerified: 1, createdAt: -1 });
    return res.json({
      success: true,
      paymentInfos
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Verifies the payment information of a host (Admin only).
 * 
 * @async
 * @function verifyHostPaymentInfo
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const verifyHostPaymentInfo = async (req, res) => {
  try {
    const {
      hostId
    } = req.params;
    const info = await HostPaymentInfo.findOne({
      hostId
    });
    if (!info) {
      return res.status(404).json({
        success: false,
        message: 'No payment info found for this host'
      });
    }

    info.isVerified = true;
    info.verifiedAt = new Date();
    info.verifiedBy = req.user._id;
    await info.save();

    await notificationService.notifyHost(hostId, 'payment:info:verified', {
      title: 'Payment Info Verified',
      message: 'Your payment details have been verified by admin. You can now request payouts.',
      type: 'payment',
      severity: 'success',
    });

    return res.json({
      success: true,
      message: 'Payment info verified',
      paymentInfo: info
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export {
  savePaymentInfo,
  getMyPaymentInfo,
  getEarningsSummary,
  requestPayout,
  getMyPayouts,
  getAllPayoutRequests,
  processPayout,
  verifyHostPaymentInfo,
  getAllPaymentInfo,
};
