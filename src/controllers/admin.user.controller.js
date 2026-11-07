/**
 * controllers/admin.user.controller.js
 * ------------------------------------------------------------------
 * Admin-only: look up a user by their SHORT sequential userId
 * ("0001", "0002", ...) — not the MongoDB _id — and get back their
 * FULL details: profile, wallet, every property they've purchased,
 * and every fund they've invested in.
 * ------------------------------------------------------------------
 */

const User = require("../models/User.model");
const Wallet = require("../models/Wallet.model");
const PropertyPurchase = require("../models/PropertyPurchase.model");
const FundInvestment = require("../models/FundInvestment.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");

/* ================================================================
   ADMIN: GET USER BY SHORT userId ("0001", "0002", ...)
   GET /api/admin/users/:userId   (adminProtect — admin token required)

   DEEP EXAMPLE — HOW TO BUILD/READ THIS FUNCTION
   ------------------------------------------------------------------
   Example request:
     GET /api/admin/users/0001
     Authorization: Bearer <admin protected token>

   Why look up by `userId` and not the Mongo `_id`:
     `_id` is a long random ObjectId
     ("68f2a1c9b4e7d2a1f0c3b6e9") that's painful to type/read.
     `userId` is the short, human-friendly sequential id
     ("0001") generated once at registration (see the
     pre("save") hook in models/User.model.js) — exactly what an
     admin would actually type into a search box.

   Step-by-step:
     1. Read `:userId` from the route params, e.g. "0001".
     2. Find the User document where `userId` matches EXACTLY
        (it's a zero-padded string, so no numeric conversion is
        needed or wanted — "0001" must stay "0001", not become 1).
     3. If no user is found, return 404 — never assume/guess.
     4. In parallel, fetch:
          - that user's Wallet (₹ balance),
          - every PropertyPurchase document where `user` matches
            (newest first) — each one already carries a full buyer +
            property snapshot (see PropertyPurchase.model.js),
          - every FundInvestment document where `user` matches.
     5. Assemble ONE response object with everything an admin would
        need to see about this user on a single screen: profile,
        wallet, FAIX token summary, purchases, investments.
   ================================================================ */

const getUserByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw ApiError.badRequest("userId is required.");
  }

  // --------------------------------------------------
  // 1. Find the user by the SHORT sequential id (not _id)
  // --------------------------------------------------
  const user = await User.findOne({ userId: String(userId).trim() });

  if (!user) {
    throw ApiError.notFound(`No user found with userId "${userId}".`);
  }

  // --------------------------------------------------
  // 2. Fetch everything related to this user, in parallel
  // --------------------------------------------------
  const [wallet, propertyPurchases, fundInvestments] = await Promise.all([
    Wallet.findOne({ user: user._id }).lean(),

    PropertyPurchase.find({ user: user._id })
      .sort({ createdAt: -1 })
      .lean(),

    FundInvestment.find({ user: user._id })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  // --------------------------------------------------
  // 3. FAIX token summary (same formula used everywhere else —
  //    see properties.controller.js / fund.controller.js)
  // --------------------------------------------------
  const totalFaixToken = Number(user.faixToken) || 0;
  const usedFaixToken = Number(user.usedAmount) || 0;
  const availableFaixToken = Math.max(totalFaixToken - usedFaixToken, 0);

  // --------------------------------------------------
  // 4. Full response — everything about this user on one screen
  // --------------------------------------------------
  const result = {
    profile: {
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
      phone: user.phone,
      isActive: user.isActive,
      role: user.role,
      createdAt: user.createdAt,
    },

    faixTokenSummary: {
      totalFaixToken,
      usedFaixToken,
      availableFaixToken,
    },

    walletSummary: {
      balance: Number(wallet?.balance || 0),
      totalDeposited: Number(wallet?.totalDeposited || 0),
      totalWithdrawn: Number(wallet?.totalWithdrawn || 0),
    },

    counts: {
      propertiesCount: propertyPurchases.length,
      fundsJoinedCount: fundInvestments.length,
    },

    propertyPurchases,
    fundInvestments,
  };

  return new ApiResponse(
    200,
    "User details fetched successfully.",
    result,
  ).send(res);
});

module.exports = {
  getUserByUserId,
};
