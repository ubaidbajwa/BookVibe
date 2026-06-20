import express from "express";
import rateLimit from "express-rate-limit";
import {
  registerUser, sendEmailOTP, verifyEmailOTPPreRegister,
  verifyOTP, resendOTP, login, forgotPassword, resetPasswordWithToken,
  refreshSession, logout, authenticate, getMyProfile, getGuestDashboardStats,
  updatePassword, updateProfile, updatePreferences,
  getSettings, updateSettings, deactivateAccount, deleteAccount,
  contactSupport,
} from "../controllers/User.controller.js";
import { isAuthenticated, isAuthorized } from "../middlewares/authMiddleware.js";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many login attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Throttle the public contact form to curb inbox-spam abuse.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many messages. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// Public contact form
router.post("/contact", contactLimiter, contactSupport);

// Pre-registration
router.post("/send-email-otp",   sendEmailOTP);
router.post("/verify-email-otp", verifyEmailOTPPreRegister);

// Auth
router.post("/register-user",          registerUser);
router.post("/login",                  loginLimiter, login);
router.post("/forgot-password",        forgotPassword);
router.post("/reset-password/:token",  resetPasswordWithToken);
router.post("/refresh",                refreshSession);
router.post("/logout",                 logout);
router.get("/authenticate",            isAuthenticated, authenticate);

// Profile & dashboard
router.get("/me",              isAuthenticated, getMyProfile);
router.get("/guest-dashboard", isAuthenticated, isAuthorized("guest"), getGuestDashboardStats);
router.put("/update-password", isAuthenticated, updatePassword);
router.put("/update-profile",  isAuthenticated, updateProfile);
router.put("/update-preferences", isAuthenticated, updatePreferences);

// Settings
router.get("/settings",        isAuthenticated, getSettings);
router.put("/settings",        isAuthenticated, updateSettings);
router.put("/update-settings", isAuthenticated, updateSettings);

// Account management
router.post("/deactivate",         isAuthenticated, deactivateAccount);
router.post("/deactivate-account", isAuthenticated, deactivateAccount);
router.post("/delete",             isAuthenticated, deleteAccount);
router.delete("/delete-account",   isAuthenticated, deleteAccount);

// OTP (post-registration)
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);

export default router;
