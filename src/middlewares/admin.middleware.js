/**
 * middlewares/admin.middleware.js
 * ------------------------------------------------------------------
 * Admin JWT authentication.
 *
 * IMPORTANT:
 * The JWT payload must identify an admin. This example accepts either:
 *   role: 'admin'
 * or
 *   isAdmin: true
 *
 * Adjust the check to match your existing Admin JWT payload if needed.
 * ------------------------------------------------------------------
 */

const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User.model');
const { restoreToken } = require('../utils/token/tokenService');
const validateTokenFormat = require('../utils/token/tokenValidator');

/**
 * adminProtect
 * ------------------------------------------------------------------
 * Same 5-step chain as middlewares/auth.middleware.js `protect`
 * (length check -> restore -> jwt.verify -> DB token match), PLUS
 * one extra check at the end: the decoded payload's role must be
 * "admin". This is what stops a normal investor's valid, logged-in
 * token from being used on /api/admin/** routes.
 *
 * DEEP EXAMPLE:
 *   - A normal user logs in via POST /api/auth/login -> gets back a
 *     token with { role: "user" } in its JWT payload.
 *   - The admin logs in via POST /api/auth/admin-login -> gets back
 *     a token with { role: "admin" } in its JWT payload.
 *   - Both tokens pass steps 1-4 below (they're both valid,
 *     unexpired, DB-matching tokens) — but only the second one
 *     passes the final `isAdmin` check and is allowed through.
 * ------------------------------------------------------------------
 */
const adminProtect = asyncHandler(async (req, res, next) => {
  // 1. Read + shape-check the Authorization header
  const header = req.headers.authorization || '';
  const [scheme, protectedToken] = header.split(' ');

  if (scheme !== 'Bearer' || !protectedToken) {
    throw ApiError.unauthorized('Not authorized. Missing or malformed token.');
  }

  // 2. Token length / format check
  if (!validateTokenFormat(protectedToken)) {
    throw ApiError.unauthorized('Not authorized. Token length/format is invalid.');
  }

  let decoded;
  let restoredToken;

  try {
    // 3. Undo protectToken() to get the raw JWT back
    restoredToken = restoreToken(protectedToken);

    // 4. Verify the raw JWT's signature + expiry
    decoded = jwt.verify(
      restoredToken,
      process.env.JWT_SECRET
    );
  } catch (error) {
    throw ApiError.unauthorized('Not authorized. Invalid or expired token.');
  }

  // 5. Database check — this exact JWT must still be the one saved
  //    on the admin's document (see issueTokenForUser in
  //    controllers/auth.controller.js).
  const admin = await User.findById(decoded.id).select('+token');

  if (!admin || !admin.isActive) {
    throw ApiError.unauthorized('Not authorized. Admin not found or inactive.');
  }

  if (!admin.token || admin.token !== restoredToken) {
    throw ApiError.unauthorized('Not authorized. Session has expired or logged in elsewhere.');
  }

  // 6. Role check — only now do we confirm this is really an admin.
  const isAdmin = admin.role === 'admin' || decoded.role === 'admin' || decoded.isAdmin === true;

  if (!isAdmin) {
    throw ApiError.forbidden('Admin access required.');
  }

  req.admin = decoded;
  next();
});

module.exports = { adminProtect };
