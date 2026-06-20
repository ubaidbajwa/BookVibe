import fs from 'fs';
import UserAndHost from '../models/UserAndHostModel.js';
import cloudinary from '../middlewares/cloudinary.js';
import {
  verifyCnic,
  verifyFaceMatch,
  verifyLiveness
} from '../utils/verificationService.js';
import {
  recalculateTrustScore
} from './User.controller.js';

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */

/**
 * Delays execution for a specified duration.
 * 
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
const sleep = (ms) => {
  return new Promise((resolve) => {
    return setTimeout(resolve, ms);
  });
};

/**
 * Checks if a Cloudinary error is a timeout.
 * 
 * @param {Object} error - The error object to check.
 * @returns {boolean} True if it's a timeout error.
 */
const isCloudinaryTimeout = (error) => {
  return (
    error?.error?.name === 'TimeoutError' ||
    error?.error?.http_code === 499 ||
    error?.http_code === 499 ||
    error?.message?.toLowerCase?.().includes('timeout')
  );
};

/**
 * Deletes a temporary file from the local file system.
 * 
 * @param {string} tempFilePath - The path to the temporary file.
 */
const unlinkTempFile = (tempFilePath) => {
  if (!tempFilePath) {
    return;
  }
  fs.unlink(tempFilePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.warn(`[Verification] Could not delete temp file ${tempFilePath}:`, err.message);
    }
  });
};

/**
 * Base function for uploading a temporary verification file to Cloudinary.
 * 
 * @param {Object} file - The file object from express-fileupload.
 * @param {string} suffix - A suffix for the public ID.
 * @returns {Promise<Object>} The Cloudinary upload result.
 */
const uploadTempVerificationFileBase = async (file, suffix) => {
  const upload = await cloudinary.uploader.upload(file.tempFilePath, {
    folder: 'BookVibe/TempVerification',
    public_id: `verify_${Date.now()}_${suffix}`,
    resource_type: 'image',
    timeout: 120000,
    chunk_size: 6000000,
  });

  unlinkTempFile(file.tempFilePath);
  return upload;
};

/**
 * Uploads a temporary verification file to Cloudinary with retry logic.
 * 
 * @param {Object} file - The file object from express-fileupload.
 * @param {string} suffix - A suffix for the public ID.
 * @returns {Promise<Object>} The Cloudinary upload result.
 * @throws {Error} If the upload fails after retries.
 */
const uploadTempVerificationFile = async (file, suffix) => {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await uploadTempVerificationFileBase(file, `${suffix}_${attempt}`);
    } catch (error) {
      lastError = error;
      if (!isCloudinaryTimeout(error) || attempt === 3) {
        break;
      }
      console.warn(`[Cloudinary] Upload timeout for ${suffix}; retry ${attempt}/2...`);
      await sleep(2500);
    }
  }

  // Upload failed — still clean up the temp file
  unlinkTempFile(file.tempFilePath);

  const err = new Error('Image upload timed out. Please try again with a clearer, smaller image or a more stable internet connection.');
  err.statusCode = 503;
  err.cause = lastError;
  throw err;
};

/**
 * Destroys an image stored on Cloudinary.
 * 
 * @param {string} publicId - The Cloudinary public ID.
 * @returns {Promise<void>}
 */
const destroyCloudinaryImage = async (publicId) => {
  if (!publicId) {
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    // Ignore cleanup failures
  }
};

/**
 * Schedules the cleanup of multiple Cloudinary images.
 * 
 * @param {string[]} publicIds - Array of Cloudinary public IDs.
 * @param {number} delayMs - Delay in milliseconds before cleanup.
 */
const scheduleCleanup = (publicIds, delayMs = 30000) => {
  setTimeout(async () => {
    for (const pid of publicIds) {
      await destroyCloudinaryImage(pid);
    }
  }, delayMs);
};

/**
 * Normalizes extracted data from CNIC OCR.
 * 
 * @param {Object} data - The raw extracted data.
 * @returns {Object} The normalized data.
 */
const normalizeExtractedData = (data = {}) => {
  return {
    cnicNumber: data.cnicNumber || data.cnic_number || null,
    fullName: data.fullName || data.full_name || null,
    fatherName: data.fatherName || data.father_name || null,
    dateOfBirth: data.dateOfBirth || data.date_of_birth || data.dob || null,
    gender: data.gender || null,
    address: data.address || null,
    issueDate: data.issueDate || data.issue_date || null,
    expiryDate: data.expiryDate || data.expiry_date || null,
    confidence: data.confidence || 0,
    rawText: data.rawText || data.raw_text || '',
  };
};

/* ═══════════════════════════════════════════════════════════
   PRE-REGISTRATION OCR (public)
═══════════════════════════════════════════════════════════ */

/**
 * Performs OCR on a CNIC front image before user registration.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const previewCnicOcr = async (req, res) => {
  let uploadedFront = null;

  try {
    const frontImage = req.files?.cnic_front || req.files?.frontImage || req.files?.image;
    if (!frontImage) {
      return res.status(400).json({
        success: false,
        message: 'CNIC front image is required'
      });
    }

    uploadedFront = await uploadTempVerificationFile(frontImage, 'cnic_front');

    const result = await verifyCnic({
      image_url: uploadedFront.secure_url
    });

    // Schedule Cloudinary cleanup AFTER Python finishes
    scheduleCleanup([uploadedFront.public_id], 10000);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'OCR extraction failed'
      });
    }

    return res.status(200).json({
      success: true,
      extracted: normalizeExtractedData(result.data),
    });
  } catch (error) {
    if (uploadedFront?.public_id) {
      scheduleCleanup([uploadedFront.public_id], 5000);
    }
    console.error('previewCnicOcr error:', error);

    // Propagate INVALID_DOCUMENT_TYPE so the frontend can abort early
    const detail = error.response?.data?.detail || '';
    const httpStatus = error.response?.status;

    if (detail === 'INVALID_DOCUMENT_TYPE') {
      return res.status(400).json({
        success: false,
        message: 'Invalid Image Detected. Please upload a clear, actual photo of your Pakistani CNIC.',
        code: 'INVALID_DOCUMENT_TYPE',
      });
    }

    // 503 from Python = provider not configured (missing credentials)
    if (httpStatus === 503) {
      return res.status(503).json({
        success: false,
        message: detail || 'Verification service is not configured. Contact administrator.',
        code: 'PROVIDER_NOT_CONFIGURED',
      });
    }

    return res.status(error.statusCode || httpStatus || 500).json({
      success: false,
      message: detail || error.message || 'OCR extraction failed',
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   PRE-REGISTRATION FACE MATCH (public)
═══════════════════════════════════════════════════════════ */

/**
 * Performs face matching between a selfie and a CNIC image before registration.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const previewFaceMatch = async (req, res) => {
  let uploadedSelfie = null;
  let uploadedCnic = null;

  try {
    const selfieImage = req.files?.selfie_image || req.files?.selfie || req.files?.selfieImage;
    const cnicImage = req.files?.cnic_image || req.files?.cnic_front || req.files?.frontImage;

    if (!selfieImage || !cnicImage) {
      return res.status(400).json({
        success: false,
        message: 'Selfie and CNIC front image are required'
      });
    }

    uploadedSelfie = await uploadTempVerificationFile(selfieImage, 'selfie');
    uploadedCnic = await uploadTempVerificationFile(cnicImage, 'cnic_match');

    const result = await verifyFaceMatch({
      selfie_url: uploadedSelfie.secure_url,
      cnic_url: uploadedCnic.secure_url,
    });

    const cleanupIds = [uploadedSelfie?.public_id, uploadedCnic?.public_id].filter((id) => {
      return Boolean(id);
    });
    scheduleCleanup(cleanupIds, 10000);

    return res.status(200).json({
      success: true,
      is_match: Boolean(result.matched),
      decision: result.decision || (result.matched ? 'approved' : 'rejected'),
      result: {
        similarity_percent: result.confidence || 0,
        distance: result.distance ?? null,
        threshold: result.threshold ?? null,
        decision: result.decision || (result.matched ? 'approved' : 'rejected'),
      },
      message: result.message || (
        result.decision === 'manual_review' ?
        'Face match is borderline and should be reviewed manually' :
        result.matched ?
        'Face matched successfully' :
        'Face did not match'
      ),
    });
  } catch (error) {
    const cleanupIds = [uploadedSelfie?.public_id, uploadedCnic?.public_id].filter((id) => {
      return Boolean(id);
    });
    if (cleanupIds.length) {
      scheduleCleanup(cleanupIds, 5000);
    }
    console.error('previewFaceMatch error:', error);
    const faceDetail = error.response?.data?.detail || '';
    const faceHttpStatus = error.response?.status;
    if (faceHttpStatus === 503) {
      return res.status(503).json({
        success: false,
        message: faceDetail || 'Face matching service is not configured. Contact administrator.',
        code: 'PROVIDER_NOT_CONFIGURED',
      });
    }
    return res.status(error.statusCode || faceHttpStatus || 500).json({
      success: false,
      message: faceDetail || error.message || 'Face match failed',
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   PRE-REGISTRATION LIVENESS (public)
═══════════════════════════════════════════════════════════ */

/**
 * Performs a liveness check on a selfie image before registration.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const previewLiveness = async (req, res) => {
  let uploadedSelfie = null;

  try {
    const selfieImage = req.files?.selfie || req.files?.selfie_image || req.files?.selfieImage;
    if (!selfieImage) {
      return res.status(400).json({
        success: false,
        message: 'Selfie image is required'
      });
    }

    uploadedSelfie = await uploadTempVerificationFile(selfieImage, 'liveness');

    const result = await verifyLiveness({
      selfie_url: uploadedSelfie.secure_url
    });

    scheduleCleanup([uploadedSelfie.public_id], 10000);

    return res.status(200).json({
      success: true,
      is_live: Boolean(result.is_live),
      result: {
        confidence: result.confidence || 0,
        checks: result.checks || {},
      },
      message: result.message || (result.is_live ? 'Liveness check passed' : 'Liveness check failed'),
    });
  } catch (error) {
    if (uploadedSelfie?.public_id) {
      scheduleCleanup([uploadedSelfie.public_id], 5000);
    }
    console.error('previewLiveness error:', error);
    const liveDetail = error.response?.data?.detail || '';
    const liveHttpStatus = error.response?.status;
    if (liveHttpStatus === 503) {
      return res.status(503).json({
        success: false,
        message: liveDetail || 'Liveness service is not configured. Contact administrator.',
        code: 'PROVIDER_NOT_CONFIGURED',
      });
    }
    return res.status(error.statusCode || liveHttpStatus || 500).json({
      success: false,
      message: liveDetail || error.message || 'Liveness check failed',
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   EXTRACT CNIC DATA (authenticated — uses saved Cloudinary URLs)
═══════════════════════════════════════════════════════════ */

/**
 * Extracts CNIC data for an authenticated user using their stored images.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const extractCnicData = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserAndHost.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        success: false
      });
    }

    const frontUrl = user.cnicImage?.frontImage?.url;
    if (!frontUrl) {
      return res.status(400).json({
        message: 'CNIC front image not uploaded yet',
        success: false
      });
    }

    const result = await verifyCnic({
      image_url: frontUrl
    });

    if (!result.success) {
      return res.status(400).json({
        message: result.message || 'OCR extraction failed',
        success: false
      });
    }

    // normalizeExtractedData handles both camelCase and snake_case
    const extracted = normalizeExtractedData(result.data);

    user.cnicData = {
      cnicNumber: extracted.cnicNumber,
      fullName: extracted.fullName,
      fatherName: extracted.fatherName,
      dateOfBirth: extracted.dateOfBirth,
      gender: extracted.gender,
      address: extracted.address,
      issueDate: extracted.issueDate,
      expiryDate: extracted.expiryDate,
      confidence: extracted.confidence,
      // Preserve existing scores and audit fields
      faceMatchScore: user.cnicData?.faceMatchScore ?? null,
      livenessScore: user.cnicData?.livenessScore ?? null,
      verifiedAt: new Date(),
      kycReviewedBy: user.cnicData?.kycReviewedBy ?? undefined,
      kycReviewedAt: user.cnicData?.kycReviewedAt ?? undefined,
    };

    await user.save({
      validateBeforeSave: false
    });
    await recalculateTrustScore(userId);

    return res.status(200).json({
      message: 'CNIC data extracted successfully',
      success: true,
      cnicData: user.cnicData,
    });
  } catch (error) {
    console.error('extractCnicData error:', error);
    const msg = error.response?.data?.detail || error.message || 'Verification service unavailable';
    return res.status(500).json({
      message: msg,
      success: false
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   FACE MATCH (authenticated)
═══════════════════════════════════════════════════════════ */

/**
 * Performs face matching for an authenticated user using their stored images.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const matchFace = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserAndHost.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        success: false
      });
    }

    const selfieUrl = user.selfieImage?.url;
    const cnicFrontUrl = user.cnicImage?.frontImage?.url;

    if (!selfieUrl || !cnicFrontUrl) {
      return res.status(400).json({
        message: 'Selfie and CNIC front image are required',
        success: false
      });
    }

    const result = await verifyFaceMatch({
      selfie_url: selfieUrl,
      cnic_url: cnicFrontUrl
    });

    return res.status(200).json({
      message: result.matched ? 'Face matched successfully' : 'Face did not match',
      success: true,
      matched: result.matched || false,
      confidence: result.confidence || 0,
      distance: result.distance || null,
    });
  } catch (error) {
    console.error('matchFace error:', error);
    const msg = error.response?.data?.detail || error.message || 'Face match service unavailable';
    return res.status(500).json({
      message: msg,
      success: false
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   LIVENESS CHECK (authenticated)
═══════════════════════════════════════════════════════════ */

/**
 * Performs a liveness check for an authenticated user using their stored selfie.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const checkLiveness = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserAndHost.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        success: false
      });
    }

    const selfieUrl = user.selfieImage?.url;
    if (!selfieUrl) {
      return res.status(400).json({
        message: 'Selfie image is required',
        success: false
      });
    }

    const result = await verifyLiveness({
      selfie_url: selfieUrl
    });

    return res.status(200).json({
      message: result.is_live ? 'Liveness check passed' : 'Liveness check failed',
      success: true,
      isLive: result.is_live || false,
      confidence: result.confidence || 0,
    });
  } catch (error) {
    console.error('checkLiveness error:', error);
    const msg = error.response?.data?.detail || error.message || 'Liveness service unavailable';
    return res.status(500).json({
      message: msg,
      success: false
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   FULL KYC VERIFICATION (All-in-one)
═══════════════════════════════════════════════════════════ */

/**
 * Performs full KYC verification (OCR, Face Match, and Liveness) in parallel.
 * 
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>}
 */
const fullKycVerification = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserAndHost.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        success: false
      });
    }

    const selfieUrl = user.selfieImage?.url;
    const cnicFrontUrl = user.cnicImage?.frontImage?.url;

    if (!selfieUrl || !cnicFrontUrl) {
      return res.status(400).json({
        message: 'Selfie and CNIC front image are required for KYC',
        success: false
      });
    }

    const [ocrSettled, faceSettled, livenessSettled] = await Promise.allSettled([
      verifyCnic({
        image_url: cnicFrontUrl
      }),
      verifyFaceMatch({
        selfie_url: selfieUrl,
        cnic_url: cnicFrontUrl
      }),
      verifyLiveness({
        selfie_url: selfieUrl
      }),
    ]);

    const results = {
      ocr: null,
      faceMatch: null,
      liveness: null
    };
    const errors = [];

    // --- OCR ---
    if (ocrSettled.status === 'fulfilled') {
      const ocrResult = ocrSettled.value;
      results.ocr = ocrResult;

      const extracted = normalizeExtractedData(ocrResult.data);
      const {
        cnicNumber,
        fullName
      } = extracted;

      if (ocrResult.success && cnicNumber && fullName) {
        user.cnicData = {
          cnicNumber,
          fullName,
          fatherName: extracted.fatherName,
          dateOfBirth: extracted.dateOfBirth,
          gender: extracted.gender,
          address: extracted.address,
          issueDate: extracted.issueDate,
          expiryDate: extracted.expiryDate,
          confidence: extracted.confidence,
          verifiedAt: new Date(),
          // Preserve audit trail if set by a previous admin review
          kycReviewedBy: user.cnicData?.kycReviewedBy ?? undefined,
          kycReviewedAt: user.cnicData?.kycReviewedAt ?? undefined,
        };
      } else if (ocrResult.success) {
        results.ocr.status = 'rejected';
        results.ocr.message = 'CNIC text is unreadable';
      }
    } else {
      errors.push({
        step: 'ocr',
        message: ocrSettled.reason?.message
      });
    }

    // --- Face match ---
    if (faceSettled.status === 'fulfilled') {
      results.faceMatch = faceSettled.value;
    } else {
      errors.push({
        step: 'faceMatch',
        message: faceSettled.reason?.message
      });
    }

    // --- Liveness ---
    if (livenessSettled.status === 'fulfilled') {
      results.liveness = livenessSettled.value;
    } else {
      errors.push({
        step: 'liveness',
        message: livenessSettled.reason?.message
      });
    }

    // Persist scores into cnicData so admin queue can display them
    if (!user.cnicData) {
      user.cnicData = {};
    }

    if (results.faceMatch != null) {
      user.cnicData.faceMatchScore = results.faceMatch.confidence ?? 0;
    }

    if (results.liveness != null) {
      user.cnicData.livenessScore = results.liveness.confidence ?? 0;
    }

    user.markModified('cnicData');

    // --- Determine final verification status ---
    const statuses = [results.ocr?.status, results.faceMatch?.status, results.liveness?.status];

    if (statuses.includes('rejected')) {
      user.isVerified = 'rejected';
    } else if (statuses.includes('pending_admin_review')) {
      user.isVerified = 'pending';
    } else if (statuses.every((s) => {
        return s === 'verified';
      })) {
      user.isVerified = 'verified';
    } else {
      // All steps errored — [undefined, undefined, undefined]
      user.isVerified = 'pending';
    }

    await user.save({
      validateBeforeSave: false
    });
    await recalculateTrustScore(userId);

    return res.status(200).json({
      message: user.isVerified === 'verified' ? 'KYC verification passed' :
        user.isVerified === 'pending' ? 'KYC submitted for admin review' :
        'KYC verification failed',
      success: true,
      verificationStatus: user.isVerified,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('fullKycVerification error:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      success: false
    });
  }
};

/* ═══════════════════════════════════════════════════════════
   RESUBMIT VERIFICATION (rejected users only)
═══════════════════════════════════════════════════════════ */

/**
 * Allows a rejected user to re-upload documents and re-run KYC.
 * Resets isVerified to "pending" on success.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const resubmitVerification = async (req, res) => {
  let uploadedFront = null;
  let uploadedBack = null;
  let uploadedSelfie = null;

  try {
    const user = await UserAndHost.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isVerified !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: `Cannot resubmit — current status is "${user.isVerified}". Only rejected accounts can resubmit.`,
      });
    }

    const frontImage  = req.files?.frontImage  || req.files?.cnic_front;
    const backImage   = req.files?.backImage   || req.files?.cnic_back;
    const selfieImage = req.files?.selfieImage || req.files?.selfie;

    if (!frontImage || !backImage || !selfieImage) {
      return res.status(400).json({
        success: false,
        message: 'CNIC front, CNIC back, and selfie are all required',
      });
    }

    // Upload new images
    [uploadedFront, uploadedBack, uploadedSelfie] = await Promise.all([
      uploadTempVerificationFile(frontImage, 'cnic_front'),
      uploadTempVerificationFile(backImage, 'cnic_back'),
      uploadTempVerificationFile(selfieImage, 'selfie'),
    ]);

    // Delete old Cloudinary images (best-effort)
    const oldIds = [
      user.cnicImage?.frontImage?.public_id,
      user.cnicImage?.backImage?.public_id,
      user.selfieImage?.public_id,
    ].filter(Boolean);
    oldIds.forEach((pid) => destroyCloudinaryImage(pid).catch(() => {}));

    // Run OCR + face match + liveness in parallel
    const [ocrSettled, faceSettled, livenessSettled] = await Promise.allSettled([
      verifyCnic({ image_url: uploadedFront.secure_url }),
      verifyFaceMatch({ selfie_url: uploadedSelfie.secure_url, cnic_url: uploadedFront.secure_url }),
      verifyLiveness({ selfie_url: uploadedSelfie.secure_url }),
    ]);

    // Update images on user document
    user.cnicImage = {
      frontImage:  { public_id: uploadedFront.public_id,  url: uploadedFront.secure_url  },
      backImage:   { public_id: uploadedBack.public_id,   url: uploadedBack.secure_url   },
    };
    user.selfieImage = { public_id: uploadedSelfie.public_id, url: uploadedSelfie.secure_url };

    // Process OCR result
    if (ocrSettled.status === 'fulfilled' && ocrSettled.value?.success) {
      const extracted = normalizeExtractedData(ocrSettled.value.data);
      user.cnicData = {
        ...user.cnicData,
        cnicNumber:  extracted.cnicNumber,
        fullName:    extracted.fullName,
        fatherName:  extracted.fatherName,
        dateOfBirth: extracted.dateOfBirth,
        gender:      extracted.gender,
        address:     extracted.address,
        issueDate:   extracted.issueDate,
        expiryDate:  extracted.expiryDate,
        confidence:  extracted.confidence,
        verifiedAt:  new Date(),
      };
    }

    if (faceSettled.status === 'fulfilled') {
      user.cnicData = { ...user.cnicData, faceMatchScore: faceSettled.value?.confidence ?? 0 };
    }
    if (livenessSettled.status === 'fulfilled') {
      user.cnicData = { ...user.cnicData, livenessScore: livenessSettled.value?.confidence ?? 0 };
    }

    user.markModified('cnicData');
    user.rejectedReason = undefined;

    /* ─── DECIDE STATUS BASED ON ROLE ─── */
    const MAX_GUEST_AI_ATTEMPTS = 5;
    const isHost = user.role === 'host';

    if (isHost) {
      // Hosts always go to admin review after resubmission
      user.isVerified = 'pending';
    } else {
      // Guests: re-evaluate AI results — same logic as first registration
      const ocrOk = ocrSettled.status === 'fulfilled' && ocrSettled.value?.success;
      const faceOk = faceSettled.status === 'fulfilled' && faceSettled.value?.decision === 'approved';
      const livenessOk = livenessSettled.status === 'fulfilled' && livenessSettled.value?.is_live === true;

      if (ocrOk && faceOk && livenessOk) {
        user.isVerified = 'verified';
      } else {
        user.kycAiAttempts = (user.kycAiAttempts || 0) + 1;
        if (user.kycAiAttempts >= MAX_GUEST_AI_ATTEMPTS) {
          user.isVerified = 'pending';
        } else {
          user.isVerified = 'rejected';
          user.rejectedReason = !livenessOk
            ? 'Liveness check failed — please retake your selfie in good lighting'
            : !faceOk
            ? 'Face match failed — ensure your selfie matches your CNIC photo'
            : 'CNIC data unreadable — please upload a clearer CNIC image';
        }
      }
    }

    await user.save({ validateBeforeSave: false });
    await recalculateTrustScore(user._id);

    const attemptsRemaining = isHost ? null : MAX_GUEST_AI_ATTEMPTS - (user.kycAiAttempts || 0);

    return res.status(200).json({
      success: true,
      verificationStatus: user.isVerified,
      attemptsRemaining,
      message: user.isVerified === 'verified'
        ? 'Identity verified successfully! Welcome to BookVibe.'
        : user.isVerified === 'pending'
        ? 'Documents submitted. Your account is under review (24–48 hours).'
        : `Verification failed. ${attemptsRemaining} attempt(s) remaining before admin review.`,
    });

  } catch (error) {
    // Cleanup any partial uploads
    [uploadedFront, uploadedBack, uploadedSelfie].forEach((u) => {
      if (u?.public_id) destroyCloudinaryImage(u.public_id).catch(() => {});
    });
    console.error('resubmitVerification error:', error);
    const detail = error.response?.data?.detail || '';
    return res.status(error.statusCode || 500).json({
      success: false,
      message: detail || error.message || 'Resubmission failed',
    });
  }
};

export {
  previewCnicOcr,
  previewFaceMatch,
  previewLiveness,
  extractCnicData,
  matchFace,
  checkLiveness,
  fullKycVerification,
  resubmitVerification,
};
