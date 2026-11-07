/**
 * controllers/fund.controller.js
 * ------------------------------------------------------------------
 * Fund controller for both Admin and User flows.
 *
 * FAIX rule (same as properties.controller.js):
 *   1 FAIX Token = ₹11
 * ------------------------------------------------------------------
 */

const mongoose = require("mongoose");

const Fund = require("../models/Fund.model");
const FundInvestment = require("../models/FundInvestment.model");
const User = require("../models/User.model");
const Transaction = require("../models/Transaction.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { isTransactionsUnsupportedError } = require("../utils/transactionHelper");

/* ================================================================
   ADMIN: CREATE FUND
   POST /api/admin/funds   (adminProtect — admin token required)

   DEEP EXAMPLE — HOW TO BUILD/READ THIS FUNCTION
   ------------------------------------------------------------------
   Example request:
     POST /api/admin/funds
     Authorization: Bearer <admin protected token>
     Body:
       {
         "name": "Metalan Growth Fund",
         "category": "Growth",
         "value": 125000,
         "growthPercent": 15.3,
         "nav": 108.42,
         "icon": "trending-up",
         "isActive": true
       }

   Step-by-step:
     1. Pull the fields out of req.body and fail fast (400) if any
        REQUIRED field is missing — name, category, value,
        growthPercent, nav. `icon`/`isActive` are optional and get
        sensible defaults.
     2. Convert value/growthPercent/nav to real numbers and validate
        them individually (nav especially must be > 0, because
        investInFund() divides investmentAmount by nav to compute
        units — dividing by 0/garbage would crash or corrupt data).
     3. Create the Fund document. This is what shows up in
        GET /api/funds for users to browse/invest in.
   ================================================================ */

const adminCreateFund = asyncHandler(async (req, res) => {
  const {
    name,
    category,
    value,
    growthPercent,
    nav,
    icon,
    isActive,
  } = req.body;

  ///// Check required fields /////

  if (
    !name ||
    !category ||
    value === undefined ||
    growthPercent === undefined ||
    nav === undefined
  ) {
    throw ApiError.badRequest(
      "name, category, value, growthPercent and nav are required."
    );
  }

  ///// Convert values into numbers /////

  const fundValue = Number(value);
  const fundGrowth = Number(growthPercent);
  const fundNav = Number(nav);

  if (!Number.isFinite(fundNav) || fundNav <= 0) {
    throw ApiError.badRequest(
      "nav must be a valid number greater than 0."
    );
  }

  if (!Number.isFinite(fundValue) || fundValue < 0) {
    throw ApiError.badRequest(
      "value must be a valid number."
    );
  }

  if (!Number.isFinite(fundGrowth)) {
    throw ApiError.badRequest(
      "growthPercent must be a valid number."
    );
  }

  ///// Create fund /////

  const fund = await Fund.create({
    name: String(name).trim(),
    category: String(category).trim(),
    value: fundValue,
    growthPercent: fundGrowth,
    nav: fundNav,
    icon: icon || "trending-up",
    isActive: isActive ?? true,
  });

  return new ApiResponse(
    201,
    "Fund created successfully.",
    { fund }
  ).send(res);
});

// ///// USER: GET ALL FUNDS /////
// ///// GET /api/funds /////

const getFunds = asyncHandler(async (req, res) => {
  const funds = await Fund.find({
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .lean();

  return new ApiResponse(
    200,
    "Funds fetched successfully.",
    {
      count: funds.length,
      funds,
    }
  ).send(res);
});

/* ================================================================
   USER: INVEST IN FUND
   POST /api/funds/invest   (protect — user token required)

   DEEP EXAMPLE — HOW TO BUILD/READ THIS FUNCTION
   ------------------------------------------------------------------
   Required inputs (all in the request BODY now — no :id route
   param — plus the authenticated JWT), same pattern as
   purchaseProperty() in properties.controller.js:
     - `req.user.userId`   -> WHO is investing. The SHORT sequential
                              id ("0001", "0002", ...) baked into the
                              JWT at login (see signToken() in
                              controllers/auth.controller.js). Comes
                              ONLY from the verified JWT, never
                              trusted from the request body.
     - `req.body.fundName` -> WHICH fund is being invested in,
                              matched by its exact name.
     - `req.body.investmentAmount` -> HOW MUCH money (₹) to invest.
     - `req.body.faixTokenUsed`    -> HOW MANY FAIX tokens to spend.

   Example request:
     POST /api/funds/invest
     Authorization: Bearer <protected token>
     Body:
       {
         "userID": "0001",
         "fundName": "Metalan Growth Fund",
         "investmentAmount": 2000,
         "faixTokenUsed": 180
       }

   Note on "userID" in the body: it is OPTIONAL and only used as a
   sanity check against the JWT's userId — never as the source of
   truth. If it's sent and doesn't match the logged-in user's real
   userId, the request is rejected.

   Step-by-step:
     1. Validate investmentAmount (₹) and faixTokenUsed (FAIX
        tokens) are sane numbers, and fundName is present.
     2. Open a MongoDB transaction (like purchaseProperty) — an
        investment touches THREE collections (User, FundInvestment,
        Transaction) and must be all-or-nothing.
     3. Look the user up BY THEIR SHORT userId
        (`User.findOne({ userId })`, NOT `User.findById()`), and the
        fund up by its exact `fundName`
        (`Fund.findOne({ name: fundName })`, must be `isActive`).
     4. Check the user actually has `faixTokenUsed` unused FAIX
        tokens available.
     5. units = investmentAmount / fund.nav
        (e.g. ₹2000 invested at NAV ₹108.42 -> ~18.45 units)
     6. Deduct the used FAIX tokens from the user, bump
        fundsJoinedCount, write the FundInvestment record + a
        matching Transaction log entry.
     7. If this MongoDB is a standalone server (not a replica set),
        the transaction attempt fails with a specific, detectable
        error — in that case, silently retry the exact same logic
        WITHOUT a session (see utils/transactionHelper.js for the
        full explanation of why/how).
   ================================================================ */

const investInFund = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw ApiError.unauthorized(
      "Authenticated userId is missing. Please log in again to get a fresh token."
    );
  }

  const {
    userID: requestUserId,
    fundName,
    investmentAmount,
    faixTokenUsed,
  } = req.body;

  // Optional consistency check only; JWT remains the source of truth.
  if (requestUserId && String(requestUserId) !== String(userId)) {
    throw ApiError.unauthorized("userID does not match the logged-in user.");
  }

  ///// Check required fields /////

  if (!fundName || !String(fundName).trim()) {
    throw ApiError.badRequest("fundName is required.");
  }

  if (
    investmentAmount === undefined ||
    faixTokenUsed === undefined
  ) {
    throw ApiError.badRequest(
      "investmentAmount and faixTokenUsed are required."
    );
  }

  ///// Convert values into numbers /////

  const amount = Number(investmentAmount);
  const tokenUsed = Number(faixTokenUsed);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest(
      "investmentAmount must be a valid number."
    );
  }

  if (!Number.isFinite(tokenUsed) || tokenUsed <= 0) {
    throw ApiError.badRequest(
      "faixTokenUsed must be a valid number greater than 0."
    );
  }

  /**
   * performInvestment(session)
   * ----------------------------------------------------------------
   * All the actual read/validate/write steps, shared by BOTH the
   * transactional path and the non-transactional fallback path
   * below. `session` is either a real Mongoose ClientSession
   * (transactional run) or `null` (fallback run) — every
   * `.session(session)` / `{ session }` call accepts `null` fine.
   * ----------------------------------------------------------------
   */
  async function performInvestment(session) {
    ///// Find user (by SHORT sequential userId, not Mongo _id) /////

    const user = await User.findOne({ userId }).session(session);

    if (!user) {
      throw ApiError.notFound(`No user found with userId "${userId}".`);
    }

    if (!user.isActive) {
      throw ApiError.unauthorized("Your account is inactive.");
    }

    ///// Find active fund by exact name /////

    const fund = await Fund.findOne({
      name: String(fundName).trim(),
      isActive: true,
    }).session(session);

    if (!fund) {
      throw ApiError.notFound(`No active fund found named "${fundName}".`);
    }

    ///// Check available FAIX tokens /////

    const totalFaixToken = Number(user.faixToken) || 0;
    const usedFaixToken = Number(user.usedAmount) || 0;
    const availableFaixToken = Math.max(totalFaixToken - usedFaixToken, 0);

    if (tokenUsed > availableFaixToken) {
      throw ApiError.badRequest(
        `Insufficient FAIX tokens. Available: ${availableFaixToken}, Required: ${tokenUsed}.`
      );
    }

    ///// Calculate fund units /////
    // Example: investmentAmount = 2000, fund.nav = 108.42
    //          units = 2000 / 108.42 = 18.4468...

    const units = amount / fund.nav;

    ///// Deduct FAIX tokens /////

    user.usedAmount = usedFaixToken + tokenUsed;

    user.availableBalance = Math.max(totalFaixToken - user.usedAmount, 0);

    user.fundsJoinedCount = (Number(user.fundsJoinedCount) || 0) + 1;

    await user.save({ session });

    ///// Create fund investment /////

    const [investment] = await FundInvestment.create(
      [
        {
          user: user._id,
          fund: fund._id,
          fundName: fund.name,
          category: fund.category,
          investmentAmount: amount,
          nav: fund.nav,
          units,
          faixTokenUsed: tokenUsed,
          status: "Active",
        },
      ],
      { session }
    );

    ///// Create transaction history /////

    await Transaction.create(
      [
        {
          user: user._id,
          type: "Buy",
          asset: fund.name,
          amount: units,
          price: fund.nav,
          total: amount,
          status: "Completed",
        },
      ],
      { session }
    );

    return investment;
  }

  // ------------------------------------------------------------
  // 1. Try the safe, atomic path first (needs a replica set/mongos).
  // ------------------------------------------------------------
  const session = await mongoose.startSession();
  let investment;
  let transactionsSupported = true;

  try {
    await session.withTransaction(async () => {
      investment = await performInvestment(session);
    });
  } catch (err) {
    if (isTransactionsUnsupportedError(err)) {
      // Standalone MongoDB — fall back below, outside this catch.
      transactionsSupported = false;
    } else {
      // A real error (validation, insufficient balance, fund not
      // found, etc.) — this must still fail the request.
      throw err;
    }
  } finally {
    await session.endSession();
  }

  // ------------------------------------------------------------
  // 2. Fallback: standalone MongoDB doesn't support transactions,
  //    so re-run the exact same steps with session = null.
  // ------------------------------------------------------------
  if (!transactionsSupported) {
    investment = await performInvestment(null);
  }

  return new ApiResponse(
    201,
    "Fund investment successful.",
    { investment }
  ).send(res);
});

///// USER: GET FUND INVESTMENTS /////
// ///// GET /api/funds/investments /////

const getFundInvestments = asyncHandler(async (req, res) => {
  ///// Find user's fund investments /////

  const investments = await FundInvestment.find({
    user: req.user.id,
  })
    .sort({ createdAt: -1 })
    .lean();

  return new ApiResponse(
    200,
    "Fund investments fetched successfully.",
    {
      count: investments.length,
      investments,
    }
  ).send(res);
});

/* ================================================================
   GET WHICH FUNDS A USER HAS INVESTED IN
   GET /api/funds/investments/:id   (protect)

   Same pattern as getUserPurchasedProperties() in
   properties.controller.js — `:id` here is the SHORT sequential
   userId ("0001", "0002", ...), NOT the Mongo _id:

       const params = req.params?.id;   // e.g. "0001"

   Step-by-step:
     1. Read the target userId from the route param.
     2. Permission check: a normal user may only look up their OWN
        investments (target userId must equal their own
        `req.user.userId` from the JWT); an admin
        (`req.user.role === "admin"`) may look up ANY user's.
     3. Look the user up by the short userId to confirm they exist.
     4. Find every `FundInvestment` document where `user` matches
        that user's Mongo _id, newest first.
     5. Return the user's basic identity + the full investment list
        + a simple array of just the fund names invested in.
   ================================================================ */

const getUserFundInvestments = asyncHandler(async (req, res) => {
  const params = req.params?.id;

  if (!params) {
    throw ApiError.badRequest("userId route param is required.");
  }

  const targetUserId = String(params).trim();

  // --------------------------------------------------
  // Permission check: self or admin only.
  // --------------------------------------------------
  const isSelf = req.user?.userId && String(req.user.userId) === targetUserId;
  const isAdmin = req.user?.role === "admin";

  if (!isSelf && !isAdmin) {
    throw ApiError.forbidden("You can only view your own fund investments.");
  }

  // --------------------------------------------------
  // Confirm the target user exists.
  // --------------------------------------------------
  const user = await User.findOne({ userId: targetUserId });

  if (!user) {
    throw ApiError.notFound(`No user found with userId "${targetUserId}".`);
  }

  // --------------------------------------------------
  // Every fund this user has invested in, newest first.
  // --------------------------------------------------
  const investments = await FundInvestment.find({ user: user._id })
    .sort({ createdAt: -1 })
    .lean();

  const investedFundNames = investments.map((inv) => inv.fundName);

  return new ApiResponse(
    200,
    "User fund investments fetched successfully.",
    {
      user: {
        userId: user.userId,
        fullName: user.fullName,
        username: user.username,
      },
      count: investments.length,
      investedFundNames,
      investments,
    }
  ).send(res);
});

module.exports = {
  adminCreateFund,
  getFunds,
  investInFund,
  getFundInvestments,
  getUserFundInvestments,
};

///// FUND CONTROLLER FLOW /////

// Admin creates fund
//        ^
// Validate details
//        ^
// Save fund


// User gets funds
//        ^
// protect JWT
//        ^
// Get active funds


// User invests
//        ^
// Validate amount + FAIX
//        ^
// Try transaction (session) -> fallback to no-session if standalone MongoDB
//        ^
// Find user + fund
//        ^
// Check FAIX
//        ^
// Calculate units
//        ^
// Update user
//        ^
// Create investment
//        ^
// Create transaction
//        ^
// Success


// User gets investments
//        ^
// protect JWT
//        ^
// Find user's investments
//        ^
// Return investments
