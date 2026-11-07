/**
 * middleware/auth.middleware.js
 * ------------------------------------------------------------------
 * Authentication middleware
 *
 * Verifies:
 *   Authorization: Bearer <JWT_TOKEN>
 *
 * If token is valid:
 *   req.user = decoded JWT payload
 *
 * JWT payload:
 *   {
 *     id,
 *     username
 *   }
 *
 * If token is missing, invalid, or expired:
 *   Returns HTTP 401
 * ------------------------------------------------------------------
 */

const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User.model");
const {
  restoreToken,
} = require("../utils/token/tokenService");
const validateTokenFormat = require("../utils/token/tokenValidator");

/**
 * protect
 * ------------------------------------------------------------------
 * DEEP EXAMPLE — every check this middleware runs, in order, and WHY:
 *
 *   1. Read the `Authorization` header and split it into
 *      ["Bearer", "<protectedToken>"]. Anything else (missing
 *      header, missing "Bearer " prefix, empty token) is rejected
 *      immediately with 401.
 *
 *   2. TOKEN LENGTH CHECK — validateTokenFormat(protectedToken).
 *      A real protected token always looks like:
 *          <32-char random prefix><base64 JWT><32-char random suffix>
 *      which is always well over 64 characters. If someone sends a
 *      short/garbage string, we reject it here with a clear message
 *      BEFORE doing any decoding work — cheap check, fails fast.
 *
 *   3. restoreToken(protectedToken) — reverses protectToken():
 *      strips the random 32-char prefix/suffix, base64-decodes the
 *      middle, and returns the original raw JWT string
 *      (tokenEncoder/tokenDecoder + tokenConfig under the hood).
 *
 *   4. jwt.verify(token, JWT_SECRET) — tokenDecode/tokenEncode only
 *      reversed the *obfuscation*; this step verifies the JWT's
 *      signature and expiry using the real jsonwebtoken library.
 *      A tampered or expired JWT is rejected here.
 *
 *   5. DATABASE CHECK ("use by use") — re-fetch the user by
 *      decoded.id and compare the JWT we just restored against
 *      `user.token` stored in MongoDB at login time. If they don't
 *      match (user logged in again elsewhere, logged out, or the
 *      account was deactivated), the request is rejected even
 *      though the JWT itself is technically still valid/unexpired.
 *      This is what makes logout / "one active session" possible.
 *
 *   6. Only after ALL five checks pass do we attach `req.user` and
 *      call next() so the controller can run.
 * ------------------------------------------------------------------
 */
const protect = asyncHandler(async (req, res, next) => {
  // --------------------------------------------------
  // 1. Get Authorization header
  // --------------------------------------------------
  const header = req.headers.authorization || "";

  // Expected:
  // Authorization: Bearer eyJhbGciOi...
  const [scheme, protectedToken] = header.split(" ");

  // --------------------------------------------------
  // 2. Check Bearer token
  // --------------------------------------------------
  if (scheme !== "Bearer" || !protectedToken) {
    throw ApiError.unauthorized(
      "Not authorized. Missing or malformed token."
    );
  }

  // --------------------------------------------------
  // 3. Token length / format check
  //    (protected tokens are always > 64 chars — see
  //    utils/token/tokenValidator.js)
  // --------------------------------------------------
  if (!validateTokenFormat(protectedToken)) {
    throw ApiError.unauthorized(
      "Not authorized. Token length/format is invalid."
    );
  }

  // --------------------------------------------------
  // 4. Decode the protected token back into the raw JWT
  // --------------------------------------------------
  let token;

  try {
    token = restoreToken(protectedToken);
  } catch (error) {
    throw ApiError.unauthorized(
      "Not authorized. Invalid token format."
    );
  }

  // --------------------------------------------------
  // 5. Verify the raw JWT's signature + expiry
  // --------------------------------------------------
  let decoded;

  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );
  } catch (error) {
    throw ApiError.unauthorized(
      "Not authorized. Invalid or expired token."
    );
  }

  // --------------------------------------------------
  // 6. Confirm this exact token is still the one stored
  //    in the database for this user (use-by-use check).
  //    This is what lets login() invalidate old sessions
  //    and logout() kill the current one instantly.
  // --------------------------------------------------
  const user = await User.findById(decoded.id).select("+token");

  if (!user || !user.isActive) {
    throw ApiError.unauthorized(
      "Not authorized. User not found or inactive."
    );
  }

  if (!user.token || user.token !== token) {
    throw ApiError.unauthorized(
      "Not authorized. Session has expired or logged in elsewhere."
    );
  }

  // --------------------------------------------------
  // 7. Attach user information to request
  // --------------------------------------------------
  req.user = decoded;

  // Example:
  // req.user = {
  //   id: "68xxxxxxxxxxxx",
  //   username: "aditya.sharma",
  //   role: "user"
  // };

  next();
});

module.exports = {
  protect,
};




// Your complete authentication flow

/*

LOGIN
  ↓
username + password
  ↓
POST /api/auth/login
  ↓
Check User
  ↓
Password verification
  ↓
JWT generated (signToken)
  ↓
Raw JWT SAVED on user.token in MongoDB   <-- "database mein store"
  ↓
protectToken()
  ↓
Protected Token
  ↓
Frontend receives protected token
  ↓
Store token
  ↓
Protected API request
  ↓
Authorization: Bearer <protected token>
  ↓
protect middleware
  ↓
validateTokenFormat() — length check
  ↓
restoreToken()
  ↓
Decode original JWT
  ↓
jwt.verify()
  ↓
Re-fetch user, compare decoded JWT === user.token in DB
  ↓
req.user = decoded
  ↓
Controller
  ↓
Response

*/