/**
 * @file UserAndHostModel.js
 * @description Mongoose model for users (guests, hosts, admins), including authentication, KYC, and settings.
 */

import mongoose from "mongoose";
import validator from "validator";

// ─── SCHEMAS ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} UserAndHost
 * @property {string} username - Chosen username.
 * @property {string} email - Unique email address.
 * @property {string} password - Hashed password.
 * @property {string} dob - Date of birth.
 * @property {string} phone - Phone number.
 * @property {string} address - Physical address.
 * @property {string} role - User role (guest, host, admin).
 * @property {Object} profileImage - Profile image storage details.
 * @property {Object} cnicImage - CNIC images for identity verification.
 * @property {Object} selfieImage - Real-time selfie for liveness/identity verification.
 * @property {Object} cnicData - Data extracted from CNIC via OCR and identity verification scores.
 * @property {string} isVerified - Overall verification status.
 * @property {string} rejectedReason - Reason for verification rejection.
 * @property {boolean} isEmailVerified - Email verification flag.
 * @property {boolean} isPhoneVerified - Phone verification flag.
 * @property {string} otpHash - Hashed email OTP.
 * @property {Date} otpExpiresAt - Email OTP expiration.
 * @property {string} phoneOtpHash - Hashed phone OTP.
 * @property {Date} phoneOtpExpiresAt - Phone OTP expiration.
 * @property {string} passwordResetTokenHash - Hashed password reset token.
 * @property {Date} passwordResetExpiresAt - Password reset token expiration.
 * @property {string} refreshTokenHash - Hashed refresh token.
 * @property {Date} refreshTokenExpiresAt - Refresh token expiration.
 * @property {number} trustScore - Platform trust score (0-100).
 * @property {boolean} isBlocked - Administrative block flag.
 * @property {boolean} isDeactivated - Self-deactivation flag.
 * @property {Date} deactivatedAt - Deactivation timestamp.
 * @property {boolean} isDeleted - Soft delete flag.
 * @property {Date} deletedAt - Soft delete timestamp.
 * @property {Date} lastLogin - Last login timestamp.
 * @property {number} hostBalance - Balance for hosts (Stripe).
 * @property {number} outstandingDebt - Platform fees owed from cash bookings.
 * @property {Object} settings - User preferences and privacy settings.
 * @property {Object} preferences - Search and UI preferences.
 */
const userAndHostSchema = new mongoose.Schema({

  username: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    validate: [validator.isEmail, 'Please provide valid email']
  },

  password: {
    type: String,
    required: true,
    minlength: [6, 'Password must be at least 6 characters']
  },

  dob: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    type: String
  },

  role: {
    type: String,
    enum: ['guest', 'host', 'admin'],
    default: 'guest',
  },

  profileImage: {
    public_id: {
      type: String
    },
    url: {
      type: String
    },
  },

  // ── CNIC Images (REQUIRED for BOTH guest + host) ──
  cnicImage: {
    frontImage: {
      public_id: {
        type: String
      },
      url: {
        type: String
      },
    },
    backImage: {
      public_id: {
        type: String
      },
      url: {
        type: String
      },
    },
  },

  // ── Real-time Selfie (REQUIRED for BOTH guest + host) ──
  selfieImage: {
    public_id: String,
    url: String,
  },

  // ── OCR Extracted Data from CNIC (auto-filled by Python service) ──
  cnicData: {
    cnicNumber: {
      type: String
    },
    fullName: {
      type: String
    },
    fatherName: {
      type: String
    },
    dateOfBirth: {
      type: String
    },
    address: {
      type: String
    },
    issueDate: {
      type: String
    },
    expiryDate: {
      type: String
    },
    gender: {
      type: String
    },
    confidence: {
      type: Number
    }, // OCR confidence %
    faceMatchScore: {
      type: Number
    }, // Selfie vs CNIC face match %
    livenessScore: {
      type: Number
    }, // Liveness check %
    verifiedAt: {
      type: Date
    }, // When OCR was run
    // Issue 8: admin audit trail
    kycReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserAndHost'
    },
    kycReviewedAt: {
      type: Date
    },
  },

  // ── Verification Status ──
  isVerified: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  rejectedReason: {
    type: String
  },

  // ── Email & Phone Verification (BOTH required for guest + host) ──
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },

  // ── OTP Fields (for post-registration verification) ──
  otpHash: {
    type: String
  },
  otpExpiresAt: {
    type: Date
  },
  phoneOtpHash: {
    type: String
  },
  phoneOtpExpiresAt: {
    type: Date
  },

  // ── Password Reset ──
  passwordResetTokenHash: {
    type: String
  },
  passwordResetExpiresAt: {
    type: Date
  },

  // ── Auth Tokens ──
  refreshTokenHash: {
    type: String
  },
  refreshTokenExpiresAt: {
    type: Date
  },

  // ── Trust Score (0-100) ──
  trustScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // ── Guest KYC AI attempt counter (hosts always go to admin, guests get 5 AI tries) ──
  kycAiAttempts: {
    type: Number,
    default: 0,
  },

  // ── Account Status ──
  isBlocked: {
    type: Boolean,
    default: false
  },
  isDeactivated: {
    type: Boolean,
    default: false
  },
  deactivatedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },

  lastLogin: {
    type: Date
  },

  // ── Host Financials ──
  hostBalance: {
    type: Number,
    default: 0
  }, // For Stripe earnings
  outstandingDebt: {
    type: Number,
    default: 0
  }, // For Cash on Arrival platform fees

  // ── Settings ──
  settings: {
    notifications: {
      emailBookings: {
        type: Boolean,
        default: true
      },
      emailPayments: {
        type: Boolean,
        default: true
      },
      emailPromotions: {
        type: Boolean,
        default: false
      },
      smsAlerts: {
        type: Boolean,
        default: false
      },
      browserPush: {
        type: Boolean,
        default: true
      },
      // ── Admin-only alert preferences (no-ops for guest/host accounts) ──
      notifyNewUsers: {
        type: Boolean,
        default: true
      },
      notifyComplaints: {
        type: Boolean,
        default: true
      },
      notifyHighValueBookings: {
        type: Boolean,
        default: true
      },
      emailDigest: {
        type: Boolean,
        default: true
      },
    },
    privacy: {
      profilePublic: {
        type: Boolean,
        default: true
      },
      showPhone: {
        type: Boolean,
        default: false
      },
      showEmail: {
        type: Boolean,
        default: false
      },
    },
    appearanceTheme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
  },

  // ── Preferences ──
  preferences: {
    defaultCity: {
      type: String
    },
    preferredPropertyType: {
      type: String
    },
    language: {
      type: String,
      default: 'en'
    },
  },

}, {
  timestamps: true
});

// ─── INDEXES ─────────────────────────────────────────────────────────────────

userAndHostSchema.index({
  role: 1
});

userAndHostSchema.index({
  isVerified: 1
});

userAndHostSchema.index({
  isDeleted: 1
});

// ─── MODELS ──────────────────────────────────────────────────────────────────

/**
 * UserAndHost model.
 */
const UserAndHost = mongoose.model("UserAndHost", userAndHostSchema);

export default UserAndHost;
