/**
 * @fileoverview Authentication and authorization middlewares
 * @module middlewares/auth
 */

import UserAndHost from '../models/UserAndHostModel.js';
import jwt from 'jsonwebtoken';
import { getAccessTokenFromRequest, verifyAccessToken } from '../utils/authTokens.js';

/* -------------------------------------------------------------------------- */
/*                               Authentication                               */
/* -------------------------------------------------------------------------- */

/**
 * Middleware to verify if the request is authenticated with a valid JWT
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const isAuthenticated = async (req, res, next) => {
  try {
    const token = getAccessTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        message: "Authentication token missing",
        success: false
      });
    }

    const decoded = verifyAccessToken(token);

    const user = await UserAndHost.findById(decoded.id)
      .select("-password -refreshTokenHash -refreshTokenExpiresAt");

    if (!user) {
      return res.status(401).json({
        message: "User not found",
        success: false
      });
    }

    if (user.isDeleted) {
      return res.status(403).json({
        message: "Account not available",
        success: false
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        message: "Your account has been blocked. Contact support.",
        success: false
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        message: 'Token has expired',
        success: false
      });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        message: 'Invalid or expired token',
        success: false
      });
    }
    console.error('Unexpected auth middleware error:', error);
    return res.status(500).json({
      message: 'Internal Server Error',
      success: false
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                                Authorization                               */
/* -------------------------------------------------------------------------- */

/**
 * Middleware factory to check if the authenticated user has one of the allowed roles
 * @param {...string} allowedRoles - List of roles permitted to access the route
 * @returns {Function} Middleware function
 */
const isAuthorized = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access Denied: Unauthorized Role",
        success: false
      });
    }
    next();
  };
};

export { isAuthenticated, isAuthorized };
