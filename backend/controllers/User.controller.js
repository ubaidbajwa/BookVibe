import fs from "fs"
import UserAndHost from "../models/UserAndHostModel.js"
import PendingVerification from "../models/PendingVerificationModel.js"
import PropertyModel from "../models/PropertyModel.js"
import BookingModel from "../models/BookingModel.js"
import Review from "../models/ReviewModel.js"
import Blacklist from "../models/BlacklistModel.js"
import bcrypt from "bcrypt"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import cloudinary from "../middlewares/cloudinary.js"
import {
  sendPasswordResetEmail,
  sendUserRegistrationEmail,
  sendOTPEmail,
} from "../middlewares/Emails/UserRegisterEmail.js"
import {
  clearAuthCookies,
  clearStoredRefreshToken,
  getAccessTokenFromRequest,
  hashToken,
  issueAuthTokens,
  setAuthCookies,
  verifyAccessToken,
  verifyRefreshToken,
} from "../utils/authTokens.js"
import { verifyCnic, verifyFaceMatch, verifyLiveness } from "../utils/verificationService.js"
import { notifyAdmin } from "../utils/notificationHelper.js"
import { sendContactEmail } from "../middlewares/Emails/ContactEmail.js"

/* ── Helpers ──────────────────────────────────────────────── */

const buildAuthResponse = ({ user, accessToken, message }) => ({
  message, success: true, user, accessToken, token: accessToken,
})

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString()
const PHONE_REGEX = /^\+\d{7,15}$/

// Issue 5 fix: delete OS temp file after Cloudinary upload in registerUser
const unlinkTempFile = (tempFilePath) => {
  if (!tempFilePath) return
  fs.unlink(tempFilePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.warn(`[Register] Could not delete temp file ${tempFilePath}:`, err.message)
    }
  })
}

const SENSITIVE =
  "-password -refreshTokenHash -refreshTokenExpiresAt -otpHash -otpExpiresAt -phoneOtpHash -phoneOtpExpiresAt -passwordResetTokenHash -passwordResetExpiresAt"

const defaultSettings = {
  notifications: {
    emailBookings: true, emailPayments: true, emailPromotions: false, smsAlerts: false, browserPush: true,
    // Admin-only alert preferences (no-ops for guest/host accounts)
    notifyNewUsers: true, notifyComplaints: true, notifyHighValueBookings: true, emailDigest: true,
  },
  privacy: { profilePublic: true, showPhone: false, showEmail: false },
  appearanceTheme: "system",
}

const normalizeSettings = (s = {}) => ({
  notifications: { ...defaultSettings.notifications, ...(s.notifications || {}) },
  privacy: { ...defaultSettings.privacy, ...(s.privacy || {}) },
  appearanceTheme: ["light", "dark", "system"].includes(s.appearanceTheme) ? s.appearanceTheme : defaultSettings.appearanceTheme,
})

const recalculateTrustScore = async (userId, userInstance = null) => {
  try {
    const user = userInstance || await UserAndHost.findById(userId).lean()
    if (!user) return 0
    let score = 0
    if (user.isEmailVerified) score += 15
    if (user.isPhoneVerified) score += 15
    if (user.cnicImage?.frontImage?.url) score += 10
    if (user.selfieImage?.url) score += 5
    if (user.cnicData?.cnicNumber) score += 5

    const [reviews, completedBookings] = await Promise.all([
      Review.find({ guest: userId }).select("rating").lean(),
      BookingModel.countDocuments({
        userId, bookingStatus: "confirmed", paymentStatus: "paid", checkOut: { $lt: new Date() },
      })
    ])

    if (reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      score += Math.round((avg / 5) * 30)
    }
    score += Math.min(completedBookings * 4, 20)

    const finalScore = Math.min(score, 100)

    if (userInstance && typeof userInstance.save === 'function') {
      userInstance.trustScore = finalScore
    } else {
      await UserAndHost.updateOne({ _id: userId }, { $set: { trustScore: finalScore } })
    }
    return finalScore
  } catch (err) {
    console.error("recalculateTrustScore error:", err)
    return 0
  }
}

/* ═══════════════════════════════════════════════════════════
   PRE-REGISTRATION OTP ENDPOINTS
═══════════════════════════════════════════════════════════ */
 
const sendEmailOTP = async (req, res) => {
  try {
    const email = req.body?.email?.trim().toLowerCase()
    const username = req.body?.username?.trim()
    if (!email) return res.status(400).json({ message: "Email is required", success: false })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address", success: false })
    }

    const existing = await UserAndHost.findOne({ email })
    if (existing) return res.status(400).json({ message: "Email is already registered", success: false })

    // Reject emails that have been permanently banned from the platform.
    const emailBanned = await Blacklist.findOne({ email })
    if (emailBanned) {
      return res.status(403).json({
        message: "This email has been permanently banned from BookVibe.",
        success: false,
        code: "BLACKLISTED",
      })
    }

    const rawOtp = generateOTP()
    const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex")
    const expires = new Date(Date.now() + 10 * 60 * 1000)

    await PendingVerification.findOneAndUpdate(
      { email, otpType: "email" },
      { email, otpHash, otpType: "email", expiresAt: expires, username: username || "", verified: false },
      { upsert: true, new: true }
    )

    try {
      await sendOTPEmail(username || "User", email, rawOtp)
    } catch (mailError) {
      await PendingVerification.deleteOne({ email, otpType: "email" })
      console.error("sendEmailOTP mail error:", mailError?.code || mailError?.responseCode || mailError?.message)
      return res.status(503).json({
        message: "Could not send OTP email right now. Please check your email address or try again in a moment.",
        success: false,
      })
    }

    return res.status(200).json({ message: "Verification code sent to your email", success: true })
  } catch (error) {
    console.error("sendEmailOTP error:", error)
    return res.status(500).json({ message: error?.message || "Internal Server Error", success: false })
  }
}

const verifyEmailOTPPreRegister = async (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required", success: false })
    const pending = await PendingVerification.findOne({ email, otpType: "email" })
    if (!pending) return res.status(400).json({ message: "No OTP found. Please request a new one.", success: false })
    if (new Date() > pending.expiresAt) {
      await PendingVerification.deleteOne({ email, otpType: "email" })
      return res.status(400).json({ message: "OTP expired. Please request a new one.", success: false })
    }
    const incoming = crypto.createHash("sha256").update(otp.toString()).digest("hex")
    if (incoming !== pending.otpHash) return res.status(400).json({ message: "Invalid OTP. Please try again.", success: false })
    await PendingVerification.findOneAndUpdate(
      { email, otpType: "email" },
      { otpHash: null, verified: true, expiresAt: new Date(Date.now() + 30 * 60 * 1000) }
    )
    return res.status(200).json({ message: "Email verified!", success: true })
  } catch (error) {
    console.error("verifyEmailOTPPreRegister error:", error)
    return res.status(500).json({ message: "Internal Server Error", success: false })
  }
}

/* ═══════════════════════════════════════════════════════════
   REGISTER USER / HOST  ── FIXED VERSION
   
   ✅ All OCR fields properly saved (fatherName, gender, etc.)
   ✅ Face match ENFORCED on backend
   ✅ Liveness ENFORCED on backend
   ✅ Decision-based isVerified status
═══════════════════════════════════════════════════════════ */

const registerUser = async (req, res) => {
  try {
    const { username, email, dob, phone, address, role } = req.body
    let { password } = req.body
    const normalizedPhone = phone?.toString().trim()

    if (!username || !email || !password || !dob || !normalizedPhone || !role) {
      return res.status(400).json({ message: "All fields are required", success: false })
    }
    if (!PHONE_REGEX.test(normalizedPhone)) {
      return res.status(400).json({ message: "Use valid international format, e.g. +923001234567", success: false })
    }
    if (role !== "guest" && role !== "host") {
      return res.status(400).json({ message: "Invalid role", success: false })
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters", success: false })
    }

    const existingUser = await UserAndHost.findOne({ email })
    if (existingUser) {
      if (existingUser.isDeleted) {
        return res.status(400).json({ message: "This email is linked to an archived account. Contact support.", success: false })
      }
      return res.status(400).json({ message: "Email already registered", success: false })
    }

    const emailVerified = await PendingVerification.findOne({ email, otpType: "email", verified: true })
    if (!emailVerified) {
      return res.status(400).json({ message: "Email not verified. Complete email verification first.", success: false })
    }

    const frontImage = req.files?.frontImage
    const backImage = req.files?.backImage
    const selfieImage = req.files?.selfieImage

    if (!frontImage || !backImage || !selfieImage) {
      return res.status(400).json({ message: "CNIC front, back and selfie are required for registration", success: false })
    }

    // MED-4 fix: add explicit timeout on all registration uploads — previously these had
    // no timeout and could hang indefinitely on a degraded Cloudinary connection.
    const UPLOAD_OPTS = { timeout: 120000, chunk_size: 6000000 }

    const [f, b, s] = await Promise.all([
      cloudinary.uploader.upload(frontImage.tempFilePath,  { folder: "BookVibe/Users/CNIC",   ...UPLOAD_OPTS }),
      cloudinary.uploader.upload(backImage.tempFilePath,   { folder: "BookVibe/Users/CNIC",   ...UPLOAD_OPTS }),
      cloudinary.uploader.upload(selfieImage.tempFilePath, { folder: "BookVibe/Users/Selfie", ...UPLOAD_OPTS }),
    ])
    unlinkTempFile(frontImage.tempFilePath)
    unlinkTempFile(backImage.tempFilePath)
    unlinkTempFile(selfieImage.tempFilePath)

    let profileImage = null
    if (req.files?.profileImage) {
      const up = await cloudinary.uploader.upload(req.files.profileImage.tempFilePath, { folder: "BookVibe/Users", ...UPLOAD_OPTS })
      unlinkTempFile(req.files.profileImage.tempFilePath)
      profileImage = { public_id: up.public_id, url: up.secure_url }
    }

    const salt = await bcrypt.genSalt(12)
    password = await bcrypt.hash(password, salt)

    /* ─── BACKEND VERIFICATION (CRITICAL) ─── */
    let ocrResult = null
    let ocrBackResult = null
    let faceMatchResult = null
    let livenessResult = null

    try { ocrResult = await verifyCnic({ image_url: f.secure_url }) }
    catch (e) {
        if (e.response?.data?.detail === 'INVALID_DOCUMENT_TYPE') {
            await Promise.all([
                cloudinary.uploader.destroy(f.public_id),
                cloudinary.uploader.destroy(b.public_id),
                cloudinary.uploader.destroy(s.public_id),
            ])
            return res.status(400).json({
                success: false,
                message: "Invalid Image Detected. Please upload a clear, actual photo of your Pakistani CNIC.",
                code: "INVALID_DOCUMENT_TYPE"
            })
        }
    }

    try { ocrBackResult = await verifyCnic({ image_url: b.secure_url }) }
    catch { /* non-critical — front CNIC is primary */ }

    try { faceMatchResult = await verifyFaceMatch({ selfie_url: s.secure_url, cnic_url: f.secure_url }) }
    catch (e) {
      if (role !== 'host') {
        // Guests need face match to auto-verify — service down is a hard blocker
        await Promise.all([
          cloudinary.uploader.destroy(f.public_id),
          cloudinary.uploader.destroy(b.public_id),
          cloudinary.uploader.destroy(s.public_id),
        ])
        return res.status(503).json({
          message: "Face matching service is unavailable. Please try again in a few minutes.",
          success: false,
        })
      }
      // Hosts go to admin review regardless — service being down is non-critical
    }

    try { livenessResult = await verifyLiveness({ selfie_url: s.secure_url }) }
    catch { /* non-critical — liveness is advisory */ }

    /* ─── ENFORCE FACE MATCH DECISION ─── */
    // For hosts when face match service was down (null result), default to manual_review
    // so they still get created and go to admin queue instead of being hard-rejected
    const faceDecision = faceMatchResult?.decision ?? (role === 'host' ? 'manual_review' : 'rejected')
    const faceConfidence = Number(faceMatchResult?.confidence || 0)

    // Hard reject — selfie clearly doesn't match CNIC photo
    if (faceDecision === "rejected") {
      await Promise.all([
        cloudinary.uploader.destroy(f.public_id),
        cloudinary.uploader.destroy(b.public_id),
        cloudinary.uploader.destroy(s.public_id),
      ])
      return res.status(400).json({
        message: `Identity check failed. Your selfie does not match the CNIC photo (${faceConfidence}% match). Please use your own CNIC.`,
        success: false,
      })
    }

    /* ─── LIVENESS + FACE FLAGS ─── */
    // faceDecision is "approved" or "manual_review" here (rejected was caught above)
    const faceApproved = faceDecision === 'approved'
    const livenessOk   = livenessResult?.is_live === true

    /* ─── BUILD CNIC DATA (ALL FIELDS NOW INCLUDED) ─── */
    const ocrFront = ocrResult?.data || {}
    const ocrBack = ocrBackResult?.data || {}

    const cnicNumber = ocrFront.cnic_number || ocrBack.cnic_number
    const fullName   = ocrFront.full_name   || ocrBack.full_name

    // ── MINIMUM DATA REQUIREMENT VALIDATION ──
    if (!cnicNumber || !fullName) {
      if (role !== 'host') {
        console.warn(`[KYC-REJECT] Face matched (${faceConfidence}%) but text unreadable. User: ${email}`)
        await Promise.all([
          cloudinary.uploader.destroy(f.public_id),
          cloudinary.uploader.destroy(b.public_id),
          cloudinary.uploader.destroy(s.public_id),
        ])
        return res.status(400).json({
          success: false,
          message: "Identity photo matched, but CNIC text is unreadable. Please upload a clearer, high-resolution image of your CNIC.",
          code: "KYC_TEXT_UNREADABLE"
        })
      }
      // Host: OCR failed but images are uploaded — admin will verify manually
      console.warn(`[KYC-HOST-OCR-FAIL] OCR unreadable for host ${email} — proceeding to admin review`)
    }

    // ── CNIC UNIQUENESS VALIDATION ──
    // Guard: skip if cnicNumber is null (host with OCR failure — admin will verify manually)
    const cnicExists = cnicNumber
      ? await UserAndHost.findOne({ 'cnicData.cnicNumber': cnicNumber })
      : null
    if (cnicExists) {
      await Promise.all([
        cloudinary.uploader.destroy(f.public_id),
        cloudinary.uploader.destroy(b.public_id),
        cloudinary.uploader.destroy(s.public_id),
        ...(profileImage?.public_id ? [cloudinary.uploader.destroy(profileImage.public_id)] : []),
      ])
      return res.status(400).json({
        success: false,
        message: "An account is already registered with this CNIC number. Each person may only have one account.",
        code: "CNIC_DUPLICATE",
      })
    }

    // ── BLACKLIST VALIDATION (CNIC / email / phone permanently banned) ──
    const banned = await Blacklist.findOne({
      $or: [
        ...(cnicNumber ? [{ cnicNumber }] : []),
        { email: email.toLowerCase() },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
    })
    if (banned) {
      await Promise.all([
        cloudinary.uploader.destroy(f.public_id),
        cloudinary.uploader.destroy(b.public_id),
        cloudinary.uploader.destroy(s.public_id),
        ...(profileImage?.public_id ? [cloudinary.uploader.destroy(profileImage.public_id)] : []),
      ])
      return res.status(403).json({
        success: false,
        message: "This identity has been permanently banned from BookVibe and cannot register again.",
        code: "BLACKLISTED",
      })
    }

    const cnicData = {
      cnicNumber,
      fullName,
      fatherName:    ocrFront.father_name    || ocrBack.father_name    || null,
      dateOfBirth:   ocrFront.date_of_birth  || ocrBack.date_of_birth  || null,
      address:       ocrBack.address         || ocrFront.address       || null,
      issueDate:     ocrFront.issue_date     || ocrBack.issue_date     || null,
      expiryDate:    ocrFront.expiry_date    || ocrBack.expiry_date    || null,
      gender:        ocrFront.gender         || ocrBack.gender         || null,
      confidence:    ocrFront.confidence     || ocrBack.confidence     || null,
      faceMatchScore: faceConfidence || null,
      livenessScore:  Number(livenessResult?.confidence || 0) || null,
      verifiedAt: new Date(),
    }

    /* ─── DECIDE FINAL VERIFICATION STATUS ─── */
    const MAX_GUEST_AI_ATTEMPTS = 5;
    let finalStatus = "pending";
    let rejectedReason = null;
    let kycAiAttempts = 0;

    if (role === "host") {
      // Hosts always require admin review regardless of AI result
      finalStatus = "pending";
    } else {
      // Guests: auto-verify if AI fully passes, otherwise track attempt and let them retry
      if (faceApproved && livenessOk) {
        finalStatus = "verified";
      } else {
        kycAiAttempts = 1;
        finalStatus = "rejected";
        rejectedReason = !livenessOk
          ? "Liveness check failed — please retake your selfie in good lighting"
          : `Face match borderline (${faceConfidence}%) — please take a clearer selfie`;
      }
    }

    /* ─── CREATE USER ─── */
    const newUser = new UserAndHost({
      username, email, password, dob, phone: normalizedPhone, address, role,
      profileImage,
      cnicImage: {
        frontImage: { public_id: f.public_id, url: f.secure_url },
        backImage:  { public_id: b.public_id, url: b.secure_url },
      },
      selfieImage: { public_id: s.public_id, url: s.secure_url },
      cnicData,
      isEmailVerified: true,
      isPhoneVerified: true,
      isVerified: finalStatus,
      rejectedReason,
      kycAiAttempts,
      trustScore: 0,
    })

    await newUser.save()
    await PendingVerification.deleteMany({ email })
    await recalculateTrustScore(newUser._id)
    sendUserRegistrationEmail(username, email).catch((e) => console.error("[Welcome Email]", e))

    notifyAdmin('user:new', {
      title: 'New User Registered',
      message: `${username} signed up as a ${role}${role === 'host' ? ' — pending KYC review' : ''}.`,
      type: 'system',
      severity: role === 'host' ? 'warning' : 'info',
      link: role === 'host' ? '/admin/host-verification' : '/admin/management/users',
      data: { userId: newUser._id },
    }, 'notifyNewUsers').catch((e) => console.error('[notifyAdmin:user:new]', e))

    /* ─── RESPONSE ─── */
    if (role === "host") {
      return res.status(201).json({
        message: "Host application submitted! Your account is under review. We'll notify you within 24-48 hours.",
        success: true,
        isVerified: "pending",
      });
    }
    if (finalStatus === "verified") {
      return res.status(201).json({
        message: "Account created and identity verified! Welcome to BookVibe.",
        success: true,
        isVerified: "verified",
      });
    }
    // Guest AI check failed — account created, but they must resubmit clearer images
    return res.status(201).json({
      message: `Account created! Identity verification failed — please re-upload clearer images. ${MAX_GUEST_AI_ATTEMPTS - kycAiAttempts} attempt(s) remaining.`,
      success: true,
      isVerified: "rejected",
      attemptsRemaining: MAX_GUEST_AI_ATTEMPTS - kycAiAttempts,
    });

  } catch (error) {
    console.error("registerUser error:", error)
    return res.status(500).json({ message: "Internal Server Error", success: false })
  }
}

/* ═══════════════════════════════════════════════════════════
   POST-REGISTRATION OTP / LOGIN / REFRESH / FORGOT
   (Same as before — no changes)
═══════════════════════════════════════════════════════════ */

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required", success: false })
    const user = await UserAndHost.findOne({ email })
    if (!user) return res.status(404).json({ message: "Account not found", success: false })
    if (user.isEmailVerified) return res.status(400).json({ message: "Email already verified", success: false })
    if (!user.otpHash || !user.otpExpiresAt) return res.status(400).json({ message: "No OTP found.", success: false })
    if (new Date() > user.otpExpiresAt) {
      user.otpHash = undefined; user.otpExpiresAt = undefined
      await user.save({ validateBeforeSave: false })
      return res.status(400).json({ message: "OTP expired.", success: false })
    }
    const incoming = crypto.createHash("sha256").update(otp.toString()).digest("hex")
    if (incoming !== user.otpHash) return res.status(400).json({ message: "Invalid OTP", success: false })
    user.isEmailVerified = true; user.otpHash = undefined; user.otpExpiresAt = undefined
    await user.save({ validateBeforeSave: false })
    await recalculateTrustScore(user._id)
    const { accessToken, refreshToken } = await issueAuthTokens(user)
    setAuthCookies(res, { accessToken, refreshToken })
    await UserAndHost.findByIdAndUpdate(user._id, { lastLogin: new Date() })
    const freshUser = await UserAndHost.findById(user._id).select(SENSITIVE)
    return res.status(200).json(buildAuthResponse({ user: freshUser, accessToken, message: "Email verified!" }))
  } catch (error) { return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const resendOTP = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: "Email is required", success: false })
    const user = await UserAndHost.findOne({ email })
    if (!user) return res.status(404).json({ message: "Account not found", success: false })
    if (user.isEmailVerified) return res.status(400).json({ message: "Email already verified", success: false })
    if (user.otpExpiresAt) {
      const timeLeft = (new Date(user.otpExpiresAt) - new Date()) / 1000
      if (timeLeft > 10 * 60 - 60) return res.status(429).json({ message: "Wait 60 seconds.", success: false })
    }
    const rawOtp = generateOTP()
    user.otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex")
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
    await user.save({ validateBeforeSave: false })
    await sendOTPEmail(user.username, email, rawOtp)
    return res.status(200).json({ message: "A new OTP has been sent.", success: true })
  } catch { return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: "All fields are required", success: false })
    const user = await UserAndHost.findOne({ email })
    if (!user) return res.status(404).json({ message: "User not found", success: false })
    
    if (user.isBlocked) return res.status(403).json({ message: "Account blocked.", success: false })
    
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials", success: false })

    // Reactivate if deactivated
    if (user.isDeactivated) {
      user.isDeactivated = false;
      user.deactivatedAt = null;
      await user.save({ validateBeforeSave: false });
    }

    if (!user.isEmailVerified) {
      const rawOtp = generateOTP()
      user.otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex")
      user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
      await user.save({ validateBeforeSave: false })
      sendOTPEmail(user.username, email, rawOtp).catch(() => {})
      return res.status(403).json({ message: "Please verify email.", success: false, requiresOTP: true, email })
    }
    const { accessToken, refreshToken } = await issueAuthTokens(user)
    setAuthCookies(res, { accessToken, refreshToken })
    await UserAndHost.findByIdAndUpdate(user._id, { lastLogin: new Date() })
    const freshUser = await UserAndHost.findById(user._id).select(SENSITIVE)
    return res.status(200).json(buildAuthResponse({ user: freshUser, accessToken, message: "Login successfully" }))
  } catch (error) { console.error("login:", error); return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const refreshSession = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken
    if (!refreshToken) return res.status(401).json({ message: "Refresh token missing", success: false })

    const decoded = verifyRefreshToken(refreshToken)
    if (decoded.type !== "refresh") return res.status(401).json({ message: "Invalid refresh token", success: false })

    const user = await UserAndHost.findById(decoded.id)
    if (!user) { clearAuthCookies(res); return res.status(401).json({ message: "User not found", success: false }) }
    
    // Reactivate if deactivated
    if (user.isDeactivated) {
      user.isDeactivated = false;
      user.deactivatedAt = null;
      await user.save({ validateBeforeSave: false });
    }

    const presentedHash = hashToken(refreshToken)
    const storedHash    = user.refreshTokenHash
    const expired       = user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()

    if (expired) {
      await clearStoredRefreshToken(user)
      clearAuthCookies(res)
      return res.status(401).json({ message: "Session expired. Please log in again.", success: false })
    }

    if (presentedHash !== storedHash) {
      // Valid JWT but hash does not match the stored one → token was already rotated.
      // This is the refresh-token reuse signal (potential token theft).
      if (storedHash) {
        console.warn(`[Security] Refresh token reuse detected — user ${user._id} | IP ${req.ip} — invalidating session`)
      }
      await clearStoredRefreshToken(user)
      clearAuthCookies(res)
      return res.status(401).json({ message: "Session expired. Please log in again.", success: false })
    }

    if (user.isBlocked) { await clearStoredRefreshToken(user); clearAuthCookies(res); return res.status(403).json({ message: "Account blocked.", success: false }) }

    const { accessToken, refreshToken: nextRT } = await issueAuthTokens(user)
    setAuthCookies(res, { accessToken, refreshToken: nextRT })
    const freshUser = await UserAndHost.findById(user._id).select(SENSITIVE)
    return res.status(200).json(buildAuthResponse({ user: freshUser, accessToken, message: "Session refreshed" }))
  } catch (error) {
    clearAuthCookies(res)
    if (error instanceof jwt.TokenExpiredError) return res.status(401).json({ message: "Session expired. Please log in again.", success: false })
    if (error instanceof jwt.JsonWebTokenError) return res.status(401).json({ message: "Invalid refresh token", success: false })
    return res.status(500).json({ message: "Internal Server Error", success: false })
  }
}

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: "Email is required", success: false })
    const user = await UserAndHost.findOne({ email })
    if (!user || user.isDeleted) return res.status(200).json({ message: "If an account exists, a reset link has been sent.", success: true })
    const rawToken = crypto.randomBytes(32).toString("hex")
    user.passwordResetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
    user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000)
    await user.save({ validateBeforeSave: false })
    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${rawToken}`
    await sendPasswordResetEmail(user.username, user.email, resetUrl)
    return res.status(200).json({ message: "If an account exists, a reset link has been sent.", success: true })
  } catch { return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const resetPasswordWithToken = async (req, res) => {
  try {
    const { token } = req.params
    const { password } = req.body
    if (!token || !password || password.length < 6) return res.status(400).json({ message: "Token + min 6 char password", success: false })
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")
    const user = await UserAndHost.findOne({ passwordResetTokenHash: hashedToken, passwordResetExpiresAt: { $gt: new Date() } })
    if (!user) return res.status(400).json({ message: "Reset link invalid or expired", success: false })
    const salt = await bcrypt.genSalt(12)
    user.password = await bcrypt.hash(password, salt)
    user.passwordResetTokenHash = undefined; user.passwordResetExpiresAt = undefined
    await clearStoredRefreshToken(user)
    await user.save({ validateBeforeSave: false })
    clearAuthCookies(res)
    return res.status(200).json({ message: "Password reset. Login again.", success: true })
  } catch { return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken
    const accessToken = getAccessTokenFromRequest(req)
    let userId = null
    if (refreshToken) { try { userId = verifyRefreshToken(refreshToken).id } catch {} }
    if (!userId && accessToken) { try { userId = verifyAccessToken(accessToken).id } catch {} }
    if (userId) { const user = await UserAndHost.findById(userId); if (user) await clearStoredRefreshToken(user) }
    clearAuthCookies(res)
    return res.status(200).json({ message: "Logged out successfully", success: true })
  } catch { clearAuthCookies(res); return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const getMyProfile = async (req, res) => {
  try {
    const userId = req.user?._id
    if (!userId) return res.status(401).json({ message: "Unauthorized", success: false })
    if (req.user.isDeleted) return res.status(403).json({ message: "Account deleted.", success: false, accountDeleted: true })
    const user = await UserAndHost.findById(userId).select(SENSITIVE)
    if (!user) return res.status(404).json({ message: "User not found", success: false })
    return res.status(200).json({ message: "Profile fetched", success: true, user })
  } catch { return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const getGuestDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id
    const [totalBookings, activeBookings, completedBookings, cancelledBookings, reviews, user] = await Promise.all([
      BookingModel.countDocuments({ userId }),
      BookingModel.countDocuments({ userId, bookingStatus: "confirmed", checkOut: { $gt: new Date() } }),
      BookingModel.countDocuments({ userId, bookingStatus: "confirmed", paymentStatus: "paid", checkOut: { $lt: new Date() } }),
      BookingModel.countDocuments({ userId, bookingStatus: "cancel" }),
      Review.find({ guest: userId }).populate("property", "name type city images").sort({ createdAt: -1 }).limit(3),
      UserAndHost.findById(userId).select("trustScore isEmailVerified isPhoneVerified cnicImage cnicData"),
    ])
    const recentBookings = await BookingModel.find({ userId }).populate("propertyId", "name type city country images price").sort({ createdAt: -1 }).limit(3)
    const spendAgg = await BookingModel.aggregate([{ $match: { userId, paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$totalPrice" } } }])
    return res.status(200).json({
      message: "Stats fetched", success: true,
      stats: {
        totalBookings, activeBookings, completedBookings, cancelledBookings,
        totalSpent: spendAgg[0]?.total || 0,
        trustScore: user?.trustScore || 0,
        isEmailVerified: user?.isEmailVerified || false,
        isPhoneVerified: user?.isPhoneVerified || false,
        hasIdUploaded: !!user?.cnicImage?.frontImage?.url,
        cnicVerified: !!user?.cnicData?.cnicNumber,
      },
      recentBookings, myReviews: reviews,
    })
  } catch { return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Both fields required", success: false })
    if (newPassword.length < 6) return res.status(400).json({ message: "Min 6 chars", success: false })
    if (currentPassword === newPassword) return res.status(400).json({ message: "Must be different", success: false })
    const user = await UserAndHost.findById(req.user._id)
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) return res.status(400).json({ message: "Current password wrong", success: false })
    const salt = await bcrypt.genSalt(12)
    user.password = await bcrypt.hash(newPassword, salt)
    await clearStoredRefreshToken(user); await user.save(); clearAuthCookies(res)
    return res.status(200).json({ message: "Password updated. Login again.", success: true, requiresRelogin: true })
  } catch (error) {
    console.error("[updatePassword]", error)
    return res.status(500).json({ message: "Internal Server Error", success: false })
  }
}

const updateProfile = async (req, res) => {
  try {
    const { username, phone, address, dob } = req.body
    const userId = req.user._id
    const updateData = {}

    if (username !== undefined) {
      const trimmed = username.trim()
      if (trimmed.length < 2) {
        return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' })
      }
      updateData.username = trimmed
    }
    if (phone !== undefined && phone !== '') {
      const normalizedPhone = phone.trim()
      if (!PHONE_REGEX.test(normalizedPhone)) {
        return res.status(400).json({ message: "Use valid international format, e.g. +923001234567", success: false })
      }
      updateData.phone = normalizedPhone
    }
    if (address !== undefined) updateData.address = address.trim()
    if (dob) updateData.dob = dob

    if (req.files?.profileImage) {
      const file = req.files.profileImage
      const existingUser = await UserAndHost.findById(userId).select('profileImage')
      const oldPublicId = existingUser?.profileImage?.public_id || null
      try {
        const up = await cloudinary.uploader.upload(file.tempFilePath, { folder: "BookVibe/Users" })
        updateData.profileImage = { public_id: up.public_id, url: up.secure_url }
        // Delete old image only after the new one successfully uploaded
        if (oldPublicId) cloudinary.uploader.destroy(oldPublicId).catch(() => {})
      } catch (uploadErr) {
        console.error('[updateProfile] Cloudinary upload failed:', uploadErr.message)
        return res.status(500).json({ success: false, message: 'Image upload failed. Please try again.' })
      } finally {
        unlinkTempFile(file.tempFilePath)
      }
    }

    const updated = await UserAndHost.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true }).select(SENSITIVE)
    return res.status(200).json({ message: "Profile updated successfully", success: true, user: updated })
  } catch (error) {
    console.error("[updateProfile]", error)
    return res.status(500).json({ message: "Internal Server Error", success: false })
  }
}

const updatePreferences = async (req, res) => {
  try {
    const { defaultCity, preferredPropertyType, language } = req.body
    const updateData = {}
    if (defaultCity) updateData["preferences.defaultCity"] = defaultCity
    if (preferredPropertyType) updateData["preferences.preferredPropertyType"] = preferredPropertyType
    if (language) updateData["preferences.language"] = language
    const updated = await UserAndHost.findByIdAndUpdate(req.user._id, updateData, { new: true }).select("preferences")
    return res.status(200).json({ message: "Preferences updated", success: true, preferences: updated.preferences })
  } catch { return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const getSettings = async (req, res) => {
  try {
    const user = await UserAndHost.findById(req.user._id).select("settings isDeactivated isDeleted isEmailVerified preferences")
    if (!user || user.isDeleted) return res.status(404).json({ message: "User not found", success: false })
    return res.status(200).json({
      message: "Settings fetched", success: true,
      settings: normalizeSettings(user.settings),
      preferences: user.preferences || {},
      accountStatus: { isDeactivated: user.isDeactivated, isDeleted: user.isDeleted, isEmailVerified: user.isEmailVerified },
    })
  } catch { return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const updateSettings = async (req, res) => {
  try {
    const user = await UserAndHost.findById(req.user._id)
    if (!user || user.isDeleted) return res.status(404).json({ message: "User not found", success: false })
    const next = normalizeSettings({ ...user.settings?.toObject?.(), ...req.body })
    user.settings = next
    await user.save({ validateBeforeSave: false })
    return res.status(200).json({ message: "Settings updated", success: true, settings: next })
  } catch { return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const deactivateAccount = async (req, res) => {
  try {
    const user = await UserAndHost.findById(req.user._id)
    if (!user || user.isDeleted) return res.status(404).json({ message: "User not found", success: false })
    user.isDeactivated = true; user.deactivatedAt = new Date()
    await clearStoredRefreshToken(user); await user.save({ validateBeforeSave: false })
    clearAuthCookies(res)
    return res.status(200).json({ message: "Account deactivated", success: true })
  } catch { return res.status(500).json({ message: "Internal Server Error", success: false }) }
}

const deleteAccount = async (req, res) => {
  try {
    const user = await UserAndHost.findById(req.user._id)
    if (!user) return res.status(404).json({ message: "User not found", success: false })

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

    // Cancel upcoming confirmed bookings
    await BookingModel.updateMany(
      { userId: user._id, bookingStatus: "confirmed", checkIn: { $gt: new Date() } },
      { $set: { bookingStatus: "cancel" } }
    )

    // Make properties unavailable if host
    await PropertyModel.updateMany({ hostBy: user._id }, { $set: { available: false } })

    // Permanently remove user from database
    await UserAndHost.findByIdAndDelete(user._id)

    clearAuthCookies(res)
    return res.status(200).json({ message: "Account permanently deleted.", success: true })
  } catch (error) {
    console.error("deleteAccount error:", error)
    return res.status(500).json({ message: "Internal Server Error", success: false })
  }
}

const authenticate = async (req, res) => res.status(200).json({ message: "Authenticated", success: true })

/**
 * Handles a public "Contact Us" form submission by emailing the support inbox.
 * Input is HTML-escaped before it's placed into the email body to prevent
 * HTML/markup injection in the support mailbox.
 */
const contactSupport = async (req, res) => {
  try {
    const name = (req.body?.name || "").trim()
    const email = (req.body?.email || "").trim()
    const message = (req.body?.message || "").trim()

    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields are required", success: false })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "A valid email is required", success: false })
    }
    if (message.length > 5000) {
      return res.status(400).json({ message: "Message is too long", success: false })
    }

    const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ))

    await sendContactEmail({
      name: escapeHtml(name),
      email: escapeHtml(email),
      message: escapeHtml(message),
    })

    return res.status(200).json({ message: "Message sent. We'll get back to you soon.", success: true })
  } catch (error) {
    console.error("[User:contactSupport] error:", error.message)
    return res.status(500).json({ message: "Failed to send message. Please try again later.", success: false })
  }
}

export {
  registerUser, sendEmailOTP, verifyEmailOTPPreRegister, verifyOTP, resendOTP,
  login, forgotPassword, resetPasswordWithToken, refreshSession, logout,
  authenticate, getMyProfile, getGuestDashboardStats,
  updatePassword, updateProfile, updatePreferences, getSettings, updateSettings,
  deactivateAccount, deleteAccount, recalculateTrustScore,
  contactSupport,
}
