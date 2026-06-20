/**
 * @fileoverview Admin-gate enforcement middleware.
 * @module middlewares/adminGate
 *
 * The admin panel sits behind a second factor: a 6-digit PIN verified by
 * `verifyAdminPin`, which issues a short-lived signed "gate token". This
 * middleware enforces that token on sensitive admin routes so the PIN is a
 * REAL server-side boundary, not just a client-side redirect.
 *
 * Must be composed AFTER `isAuthenticated` and `isAuthorized('admin')` so that
 * `req.user` is populated — the token is bound to the specific admin's id.
 *
 * The client sends the token in the `X-Admin-Gate` header (it's stored in
 * sessionStorage after PIN verification and attached by getAuthConfig()).
 */

import jwt from 'jsonwebtoken';

/**
 * Verifies the admin gate token. On any failure responds 403 with
 * `code: 'ADMIN_GATE_REQUIRED'` so the client can clear the stale token and
 * send the admin back to the PIN gate.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requireAdminGate = (req, res, next) => {
  const token =
    req.headers['x-admin-gate'] ||
    req.headers['X-Admin-Gate'] ||
    null;

  if (!token) {
    return res.status(403).json({
      success: false,
      code: 'ADMIN_GATE_REQUIRED',
      message: 'Admin PIN verification required',
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET_KEY || process.env.JWT_SECRET_KEY
    );

    // Token must be a genuine gate token AND belong to the authenticated admin —
    // a gate token minted for one admin can't be replayed by another account.
    if (!decoded?.adminGate || String(decoded.uid) !== String(req.user?._id)) {
      return res.status(403).json({
        success: false,
        code: 'ADMIN_GATE_REQUIRED',
        message: 'Invalid admin gate session',
      });
    }

    next();
  } catch {
    // Expired or tampered token — force re-verification.
    return res.status(403).json({
      success: false,
      code: 'ADMIN_GATE_REQUIRED',
      message: 'Admin gate session expired. Please re-enter your PIN.',
    });
  }
};

export { requireAdminGate };
