/**
 * @fileoverview Utility for managing JWT authentication tokens and cookies
 * @module utils/authTokens
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET_KEY || process.env.JWT_SECRET_KEY;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET_KEY || process.env.JWT_SECRET_KEY;

if (!ACCESS_TOKEN_SECRET) {
  throw new Error('[authTokens] ACCESS_TOKEN_SECRET_KEY or JWT_SECRET_KEY must be set in .env');
}
if (!REFRESH_TOKEN_SECRET) {
  throw new Error('[authTokens] REFRESH_TOKEN_SECRET_KEY or JWT_SECRET_KEY must be set in .env');
}

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// ── Cookie cross-origin configuration ────────────────────────────────────────
//
// Same-origin (localhost dev, same-domain prod): COOKIE_SAME_SITE=lax (default)
// Cross-origin prod (e.g. Vercel frontend + Render backend, different domains):
//   set COOKIE_SAME_SITE=none in backend .env
//   SameSite=None requires Secure=true per browser spec, so we enforce it.
//
const COOKIE_SAME_SITE = process.env.COOKIE_SAME_SITE || 'lax';
const COOKIE_SECURE =
  process.env.NODE_ENV === 'production' || COOKIE_SAME_SITE === 'none';

/* -------------------------------------------------------------------------- */
/*                                Cookie Options                              */
/* -------------------------------------------------------------------------- */

/**
 * Gets base cookie options (no sameSite — set per-cookie below).
 * @returns {Object} Cookie options
 */
const getSharedCookieOptions = () => ({
  httpOnly: true,
  secure: COOKIE_SECURE,
  path: '/',
});

/**
 * Gets options for access token cookie.
 * sameSite is read from COOKIE_SAME_SITE env var (default 'lax').
 * @returns {Object} Cookie options
 */
const getAccessTokenCookieOptions = () => ({
  ...getSharedCookieOptions(),
  sameSite: COOKIE_SAME_SITE,
  maxAge: ACCESS_TOKEN_MAX_AGE,
});

/**
 * Gets options for refresh token cookie.
 * sameSite is read from COOKIE_SAME_SITE env var (default 'lax').
 * @returns {Object} Cookie options
 */
const getRefreshTokenCookieOptions = () => ({
  ...getSharedCookieOptions(),
  sameSite: COOKIE_SAME_SITE,
  maxAge: REFRESH_TOKEN_MAX_AGE,
});

/* -------------------------------------------------------------------------- */
/*                                Token Helpers                               */
/* -------------------------------------------------------------------------- */

/**
 * Hashes a token using SHA256
 * @param {string} token - The raw token
 * @returns {string} Hashed token hex string
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Creates a new JWT access token
 * @param {string} userId - The ID of the user
 * @returns {string} Signed JWT
 */
const createAccessToken = (userId) => jwt.sign(
  { id: userId },
  ACCESS_TOKEN_SECRET,
  { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
);

/**
 * Creates a new JWT refresh token
 * @param {string} userId - The ID of the user
 * @returns {string} Signed JWT
 */
const createRefreshToken = (userId) => jwt.sign(
  { id: userId, type: 'refresh' },
  REFRESH_TOKEN_SECRET,
  { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
);

/**
 * Verifies a JWT access token
 * @param {string} token - The token to verify
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => jwt.verify(token, ACCESS_TOKEN_SECRET);

/**
 * Verifies a JWT refresh token
 * @param {string} token - The token to verify
 * @returns {Object} Decoded token payload
 */
const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_TOKEN_SECRET);

/* -------------------------------------------------------------------------- */
/*                               Request/Response                             */
/* -------------------------------------------------------------------------- */

/**
 * Extracts the access token from the request cookies or headers
 * @param {Object} req - Express request object
 * @returns {string|null} The token or null if not found
 */
const getAccessTokenFromRequest = (req) => {
  // ── SECURITY HARDENING: Prioritize HttpOnly Cookie ──
  const cookieToken = req.cookies?.token;
  if (cookieToken) return cookieToken;

  // Fallback to Bearer token (useful for mobile apps or specialized clients)
  const bearerToken = req.headers.authorization;
  if (bearerToken?.startsWith('Bearer ')) return bearerToken.split(' ')[1];

  return null;
};

/**
 * Issues new access and refresh tokens for a user
 * @param {Object} user - The user document
 * @returns {Promise<Object>} Object containing both tokens
 */
const issueAuthTokens = async (user) => {
  const accessToken = createAccessToken(user._id);
  const refreshToken = createRefreshToken(user._id);

  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE);
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

/**
 * Sets authentication cookies on the response
 * @param {Object} res - Express response object
 * @param {Object} tokens - Object containing accessToken and refreshToken
 */
const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie('token', accessToken, getAccessTokenCookieOptions());
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());
};

/**
 * Clears authentication cookies from the response.
 * Options must match what was used during Set-Cookie (path + sameSite).
 * @param {Object} res - Express response object
 */
const clearAuthCookies = (res) => {
  const base = getSharedCookieOptions();
  res.clearCookie('token', { ...base, sameSite: COOKIE_SAME_SITE });
  res.clearCookie('refreshToken', { ...base, sameSite: COOKIE_SAME_SITE === 'none' ? 'none' : 'strict' });
};

/**
 * Clears the stored refresh token hash from the user document
 * @param {Object} user - The user document
 */
const clearStoredRefreshToken = async (user) => {
  if (!user) return;
  user.refreshTokenHash = undefined;
  user.refreshTokenExpiresAt = undefined;
  await user.save({ validateBeforeSave: false });
};

export {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  clearAuthCookies,
  clearStoredRefreshToken,
  getAccessTokenFromRequest,
  hashToken,
  issueAuthTokens,
  setAuthCookies,
  verifyAccessToken,
  verifyRefreshToken,
};
