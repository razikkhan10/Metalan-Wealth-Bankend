/**
 * controllers/auth.controller.js
 *
 * ------------------------------------------------------------------
 * Authentication controller
 * ------------------------------------------------------------------
 *
 * POST /api/auth/register
 *   Accepts: fullName, email, gender, address, country, city, state,
 *            dob, amountDeposited, phone
 *   Does NOT accept username/password from the client — those are
 *   generated server-side (see utils/generateCredentials.js) and
 *   returned ONCE in the response so the user can save them.
 *
 * POST /api/auth/login
 *   Accepts: username, password
 *   Returns: protected token + basic profile.
 *   Also SAVES the raw JWT on the user document (user.token) so
 *   every later request can be checked against the database copy —
 *   see the big comment above login() below for the full flow.
 *
 * POST /api/auth/admin-login
 *   Accepts: email, password
 *   Only succeeds for a user whose role === "admin".
 *   Same protected-token + database-stored-token flow as login().
 *
 * POST /api/auth/logout        (protected)
 *   Clears the stored token in the database, instantly invalidating
 *   the current session even though the JWT itself has not expired.
 *
 * GET /api/auth/me            (protected)
 *   Returns the logged-in user's profile.
 *
 * PUT /api/auth/change-password   (protected)
 *   Accepts: currentPassword, newPassword, confirmPassword
 *   Re-hashes and stores the new password; current one must match.
 *
 * Field-level validation for these routes lives in
 * validators/auth.validator.js and runs via
 * middlewares/validate.middleware.js — controllers below assume
 * req.body has already passed validation.
 * ------------------------------------------------------------------
 */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User.model");
const Wallet = require("../models/Wallet.model");

const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const {
  protectToken,
} = require("../utils/token/tokenService");

const {
  generateUsernameFromFullName,
  generateStrongPassword,
} = require("../utils/generateCredentials");

const SALT_ROUNDS = 10;

// ---------------------------------------------------------------
// JWT TOKEN
// ---------------------------------------------------------------
//
// signToken(user) builds the RAW JWT (the actual jsonwebtoken
// string, e.g. "eyJhbGciOiJIUzI1NiIs..."). This raw value is what
// gets:
//   1. Saved as-is into User.token in MongoDB.
//   2. Passed to protectToken() (base64 + random prefix/suffix)
//      before being handed to the frontend, so the raw JWT never
//      travels over the wire in its plain, recognizable form.
// ---------------------------------------------------------------

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      // Short sequential id ("0001", "0002", ...) — generated ONCE
      // at registration (see the pre("save") hook in
      // models/User.model.js) and never regenerated afterwards.
      // Included here so every protected controller can read
      // `req.user.userId` directly from the verified JWT instead of
      // trusting a value the frontend might send in the body.
      userId: user.userId,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );
}

/**
 * issueTokenForUser(user)
 * ------------------------------------------------------------------
 * Shared helper used by BOTH login() and adminLogin() so the
 * "sign -> store in DB -> protect for the frontend" flow only has
 * to be written (and gets tested/fixed) in one place.
 *
 * DEEP EXAMPLE — full lifecycle of a single login:
 *
 *   1. signToken(user)
 *        -> raw JWT, e.g.
 *           "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjY4ZiJ9.f9a1c2..."
 *
 *   2. user.token = rawToken; await user.save();
 *        -> That EXACT string is written into the `token` field of
 *           this user's document in MongoDB. This is the "token
 *           database mein store hona chahiye" requirement: the
 *           original JWT, not the encoded one, is what lives in
 *           the DB.
 *
 *   3. protectToken(rawToken)
 *        -> wraps it as `${randomPrefix}${base64(rawToken)}${randomSuffix}`
 *           e.g. "3f9a...<base64 blob>...8b7d"
 *        -> THIS is the string returned to the frontend and the
 *           value the frontend must send back as:
 *               Authorization: Bearer <protectedToken>
 *
 *   4. On every later request, middlewares/auth.middleware.js does
 *      the reverse: restoreToken() -> jwt.verify() -> re-fetch the
 *      user -> compare `decoded token === user.token` from the DB.
 *      If someone logs in again (or logs out), `user.token` changes
 *      / clears, so any older protected token stops working even
 *      though the JWT itself hasn't expired yet.
 *
 * @param {import('mongoose').Document} user - a Mongoose User document
 * @returns {Promise<string>} protectedToken - safe to send to the frontend
 */
async function issueTokenForUser(user) {
  // Step 1: create the real JWT
  const rawToken = signToken(user);

  // Step 2: persist the RAW token on the user so it can be checked
  // "use by use" (on every protected request) against the DB copy.
  user.token = rawToken;
  await user.save({ validateBeforeSave: false });

  // Step 3: encode/obfuscate it before it ever leaves the server.
  const protectedToken = protectToken(rawToken);

  return protectedToken;
}

// ---------------------------------------------------------------
// REGISTER
// ---------------------------------------------------------------

const register = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    gender,
    address,
    country,
    city,
    state,
    dob,
    amountDeposited,
    phone,
  } = req.body;

  // --------------------------------------------------
  // 1. Required fields
  // --------------------------------------------------

  if (
    !fullName ||
    !email ||
    !gender ||
    !address ||
    !country ||
    !city ||
    !state ||
    !dob ||
    !phone
  ) {
    throw ApiError.badRequest("All required fields must be provided");
  }

  // --------------------------------------------------
  // 2. Normalize email
  // --------------------------------------------------

  const normalizedEmail = String(email).toLowerCase().trim();

  // --------------------------------------------------
  // 3. Check existing email
  // --------------------------------------------------

  const existingEmail = await User.findOne({
    email: normalizedEmail,
  });

  if (existingEmail) {
    throw ApiError.conflict("An account with this email already exists");
  }

  // --------------------------------------------------
  // 4. Generate username
  // --------------------------------------------------

  const username = await generateUsernameFromFullName(
    fullName,
    async (candidate) => {
      const taken = await User.findOne({
        username: candidate,
      });

      return Boolean(taken);
    },
  );

  // --------------------------------------------------
  // 5. Generate password
  // --------------------------------------------------

  const generatedPassword = generateStrongPassword(fullName);

  // --------------------------------------------------
  // 6. Hash password
  // --------------------------------------------------

  // const hashedPassword = await bcrypt.hash(generatedPassword, SALT_ROUNDS);

  // --------------------------------------------------
  // 7. Deposit amount
  // --------------------------------------------------

  const depositAmount = Number(amountDeposited) || 0;

  // --------------------------------------------------
  // AMOUNT CALCULATION
  // --------------------------------------------------

  // FAIX Token = Amount Deposited / 11
  // NOTE: kept as a real decimal (Math.floor removed) — e.g.
  // depositAmount = 5000 -> faixToken = 454.5454545454545,
  // NOT truncated down to 454. This keeps every ₹ of the deposit
  // reflected exactly in tokens instead of losing the remainder.
  const faixToken = depositAmount / 11;

  // --------------------------------------------------
  // 8. Create user
  // --------------------------------------------------

  const user = await User.create({
    fullName,
    email: normalizedEmail,
    gender,
    address,
    country,
    city,
    state,
    dob,
    phone,

    username,
    password: generatedPassword,

    // Deposit
    amountDeposited: depositAmount,

    // Automatically calculated FAIX Token
    faixToken: faixToken,

    // Dashboard
    totalAmount: faixToken,
    usedAmount: 0,
    totalProfitAmount: 0,
    monthlyGrowthPercent: 0,

    propertiesCount: 0,
    fundsJoinedCount: 0,
    tokensCount: 0,

    availableBalance: faixToken,
    isActive: true,
  });

  // --------------------------------------------------
  // 9. Create wallet
  // --------------------------------------------------

  await Wallet.create({
    user: user._id,
    balance: depositAmount,
    totalDeposited: depositAmount,
  });

  // --------------------------------------------------
  // 10. Response
  // --------------------------------------------------

  return new ApiResponse(
    201,
    "Account created successfully. Save your login credentials below — the password will not be shown again.",
    {
      user: {
        id: user._id,
        // Short sequential display id, e.g. "0001" (auto-generated
        // in models/User.model.js — see the pre("save") hook there).
        userId: user.userId,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        gender: user.gender,
        address: user.address,
        country: user.country,
        city: user.city,
        state: user.state,
        dob: user.dob,
        phone: user.phone,
        amountDeposited: user.amountDeposited,
      },

      credentials: {
        username,
        password: generatedPassword,
      },
    },
  ).send(res);
});

// ---------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------
//
// DEEP EXAMPLE — how to build a "login" controller function:
//
//   1. Pull `username` and `password` out of req.body, and fail
//      fast with a 400 if either is missing (never trust the
//      client, even though validate.middleware.js already checked
//      this — defence in depth costs nothing here).
//
//   2. Look the user up by username. `.select("+password")` is
//      required because the schema marks `password: { select: false }`
//      — Mongoose hides it from normal queries unless you ask for
//      it explicitly, which stops it from ever leaking into an
//      unrelated response by accident.
//
//   3. Compare the submitted password to the stored one, and return
//      a single generic "Invalid username or password." error for
//      BOTH "user not found" and "wrong password" — never reveal
//      which one it was, or you leak which usernames exist.
//
//   4. Only once the password is confirmed, call
//      issueTokenForUser(user) — this signs a fresh JWT, WRITES the
//      raw JWT into user.token in MongoDB, and returns the
//      protected (encoded) token that is safe to hand to the
//      frontend. See issueTokenForUser()'s own comment above for
//      the full step-by-step.
//
//   5. Respond with { token, user }. Never put the raw JWT, the
//      password, or the hashed password in this response.
// ---------------------------------------------------------------

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw ApiError.badRequest("username and password are required.");
  }

  const user = await User.findOne({
    username: String(username).toLowerCase(),
  }).select("+password");

  if (!user || !user.isActive) {
    throw ApiError.unauthorized("Invalid username or password.");
  }

  // const isMatch = await bcrypt.compare(password, user.password);

  const isMatch = password === user.password;

  if (!isMatch) {
    throw ApiError.unauthorized("Invalid username or password.");
  }

  // Sign a fresh JWT, store the RAW token on the user in the DB,
  // and get back the protected/encoded token for the frontend.
  const protectedToken = await issueTokenForUser(user);

  return new ApiResponse(200, "Login successful.", {
    token: protectedToken,

    user: {
      role: user.role,
      id: user._id,
      userId: user.userId,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
    },
  }).send(res);
});

// ---------------------------------------------------------------
// ADMIN LOGIN
// ---------------------------------------------------------------
// POST /api/auth/admin-login
// Body: { "email": "razikkhan982@gmail.com", "password": "admin@123" }
//
// DEEP EXAMPLE — why this is a SEPARATE function from login():
//
//   - Normal investor accounts log in with `username` + `password`
//     (server-generated username, see register()).
//   - The admin account logs in with `email` + `password` instead,
//     because the admin is a real, known person, not an auto
//     generated investor profile.
//   - We still reuse the exact same secure token pipeline
//     (issueTokenForUser) so the DB-stored-token / protected-token
//     behaviour is identical for admins and normal users.
//   - The extra `role !== "admin"` check makes sure a normal user
//     can never authenticate through the admin door, even if they
//     somehow know another user's email + password.
//
// The admin account itself is created once via
// `npm run seed:admin` (see src/seed/adminSeed.js) with:
//     email:    razikkhan982@gmail.com
//     password: admin@123
// ---------------------------------------------------------------

const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw ApiError.badRequest("email and password are required.");
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const admin = await User.findOne({
    email: normalizedEmail,
    role: "admin",
  }).select("+password");

  // Same generic message whether the email doesn't exist, isn't an
  // admin, or is inactive — never hint at which case it was.
  if (!admin || !admin.isActive) {
    throw ApiError.unauthorized("Invalid admin email or password.");
  }

  // Admin passwords are always stored bcrypt-hashed (see
  // src/seed/adminSeed.js), so this always uses a real hash compare.
  const isMatch = await bcrypt.compare(password, admin.password);

  if (!isMatch) {
    throw ApiError.unauthorized("Invalid admin email or password.");
  }

  const protectedToken = await issueTokenForUser(admin);

  return new ApiResponse(200, "Admin login successful.", {
    token: protectedToken,

    admin: {
      role: admin.role,
      id: admin._id,
      userId: admin.userId,
      fullName: admin.fullName,
      email: admin.email,
      username: admin.username,
    },
  }).send(res);
});

// ---------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------
// POST /api/auth/logout (protected — needs a valid Bearer token)
//
// Clears the token stored on the user in the database. Because
// every protected request checks the incoming token AGAINST the
// database copy (see middlewares/auth.middleware.js), clearing it
// here immediately kills the session everywhere — the still-valid,
// non-expired JWT the client is holding will be rejected on its
// very next request.
// ---------------------------------------------------------------

const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { token: null });

  return new ApiResponse(200, "Logged out successfully.", {}).send(res);
});

// ---------------------------------------------------------------
// GET ME
// ---------------------------------------------------------------

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    throw ApiError.notFound("User not found.");
  }

  return new ApiResponse(200, "Profile fetched successfully.", {
    user: {
      id: user._id,
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      gender: user.gender,
      address: user.address,
      country: user.country,
      city: user.city,
      state: user.state,
      dob: user.dob,
      role: user.role,
      phone: user.phone,

      amountDeposited: user.amountDeposited,
      totalAmount: user.totalAmount,
      usedAmount: user.usedAmount,
      totalProfitAmount: user.totalProfitAmount,
      monthlyGrowthPercent: user.monthlyGrowthPercent,

      propertiesCount: user.propertiesCount,
      fundsJoinedCount: user.fundsJoinedCount,
      tokensCount: user.tokensCount,

      availableBalance: user.availableBalance,

      createdAt: user.createdAt,
    },
  }).send(res);
});

// ---------------------------------------------------------------
// CHANGE PASSWORD
// ---------------------------------------------------------------

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest(
      "Current password and new password are required.",
    );
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    throw ApiError.badRequest(
      "New password and confirm password do not match.",
    );
  }

  const user = await User.findById(req.user.id).select("+password");

  if (!user) {
    throw ApiError.notFound("User not found.");
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);

  if (!isMatch) {
    throw ApiError.unauthorized("Current password is incorrect.");
  }

  const sameAsOld = await bcrypt.compare(newPassword, user.password);

  if (sameAsOld) {
    throw ApiError.badRequest(
      "New password must be different from the current password.",
    );
  }

  user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await user.save();

  return new ApiResponse(200, "Password changed successfully.", {}).send(res);
});

// ---------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------

module.exports = {
  register,
  login,
  adminLogin,
  logout,
  getMe,
  changePassword,
};

// So complete flow:

/* 

Register User
     ↓
Create User
     ↓
Create Wallet
     ↓
Wallet balance = amountDeposited
     ↓
Return username + generated password


*/
