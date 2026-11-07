
/**
 * controllers/dashboard.controller.js
 * ------------------------------------------------------------------
 * Dashboard Controller
 * ------------------------------------------------------------------
 *
 * GET /api/dashboard
 *
 * Authentication:
 *   protect middleware required.
 *
 * Dashboard Summary:
 *
 *   1. Total Amount
 *      -> User ke total FAIX Tokens
 *
 *   2. Used Amount
 *      -> User ne kitne FAIX Tokens use/invest kar liye
 *
 *   3. Total Profit Amount
 *      -> User ne ab tak kitna profit earn kiya
 *
 *   4. Monthly Growth
 *      -> Current monthly growth percentage
 *
 *   5. Available FAIX Tokens
 *      -> Total FAIX Token - Used FAIX Token
 *
 * Other Dashboard Data:
 *
 *   - Top 5 Properties
 *   - Top 5 Funds
 *   - Top 5 Investors
 *   - Recent Transactions
 *
 * ------------------------------------------------------------------
 */

const User = require("../models/User.model");
const Property = require("../models/Property.model");
const Fund = require("../models/Fund.model");
const Transaction = require("../models/Transaction.model");

const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");

// ================================================================
// GET DASHBOARD
// ================================================================

const getDashboard = asyncHandler(async (req, res) => {
  // ==============================================================
  // 1. GET LOGGED-IN USER ID
  // ==============================================================

  const userId = req.user.id;

  // ==============================================================
  // 2. FIND USER
  // ==============================================================

  const user = await User.findById(userId).lean();

  if (!user) {
    throw ApiError.notFound("User not found.");
  }

  // ==============================================================
  // 3. TOTAL FAIX TOKEN
  // ==============================================================
  //
  // User registration ke time:
  //
  // FAIX Token = amountDeposited / 11
  //
  // Example:
  //
  // amountDeposited = 50,000
  //
  // 50,000 / 11 = 4545.4545...
  //
  // Stored (Math.floor removed):
  // 4545.4545454545455
  //
  // Kept as a real decimal — nothing is truncated.
  //
  // ==============================================================

  const totalFaixToken = Number(user.faixToken) || 0;

  // ==============================================================
  // 4. USED FAIX TOKEN
  // ==============================================================
  //
  // User ne kitne FAIX Token use/invest kar liye.
  //
  // Example:
  //
  // Total Token = 4545.4545454545455
  // Used Token  = 1000.5
  //
  // ==============================================================

  const usedFaixToken = Number(user.usedAmount) || 0;

  // ==============================================================
  // 5. TOTAL PROFIT
  // ==============================================================
  //
  // User ne total kitna profit earn kiya.
  //
  // ==============================================================

  const totalProfitAmount =
    Number(user.totalProfitAmount) || 0;

  // ==============================================================
  // 6. MONTHLY GROWTH
  // ==============================================================

  const monthlyGrowthPercent =
    Number(user.monthlyGrowthPercent) || 0;

  // ==============================================================
  // 7. AVAILABLE FAIX TOKEN
  // ==============================================================
  //
  // Available Token:
  //
  // Total FAIX Token - Used FAIX Token
  //
  // ==============================================================

  const availableFaixToken = Math.max(
    totalFaixToken - usedFaixToken,
    0
  );

  // ==============================================================
  // 8. FETCH DASHBOARD DATA
  // ==============================================================

  const [
    topProperties,
    topFunds,
    topInvestorsRaw,
    recentTransactions,
    totalTransactionCount,
    totalInvestorCount,
  ] = await Promise.all([
    // ============================================================
    // TOP 5 PROPERTIES
    // ============================================================

   Property.find({
   status: { $ne: "Inactive" },
  })
      .sort({
        value: -1,
      })
      .limit(5)
      .lean(),

    // ============================================================
    // TOP 5 FUNDS
    // ============================================================

    Fund.find({
      isActive: true,
    })
      .sort({
        value: -1,
      })
      .limit(5)
      .lean(),

    // ============================================================
    // TOP 5 INVESTORS
    // ============================================================

    User.find({
      isActive: true,
    })
      .sort({
        monthlyGrowthPercent: -1,
      })
      .limit(5)
      .select(
        [
          "fullName",
          "createdAt",
          "monthlyGrowthPercent",
          "faixToken",
          "usedAmount",
          "totalProfitAmount",
          "propertiesCount",
          "fundsJoinedCount",
          "tokensCount",
        ].join(" ")
      )
      .lean(),

    // ============================================================
    // RECENT TRANSACTIONS
    // ============================================================

    Transaction.find({
      user: userId,
    })
      .sort({
        date: -1,
        createdAt: -1,
      })
      .limit(20)
      .lean(),

    // ============================================================
    // TOTAL USER TRANSACTIONS
    // ============================================================

    Transaction.countDocuments({
      user: userId,
    }),

    // ============================================================
    // TOTAL ACTIVE INVESTORS
    // ============================================================

    User.countDocuments({
      isActive: true,
    }),
  ]);

  // ==============================================================
  // 9. FORMAT TOP INVESTORS
  // ==============================================================

  const topInvestors = topInvestorsRaw.map(
    (investor, index) => {
      // ----------------------------------------------------------
      // Generate initials
      // ----------------------------------------------------------

      const initials = investor.fullName
        ? investor.fullName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(
              (part) =>
                part[0].toUpperCase()
            )
            .join("")
        : "";

      // ----------------------------------------------------------
      // Investor token calculations
      // ----------------------------------------------------------

      const totalToken = Number(investor.faixToken) || 0;

      const usedToken = Number(investor.usedAmount) || 0;

      const availableToken = Math.max(
        totalToken - usedToken,
        0
      );

      // ----------------------------------------------------------
      // Return investor data
      // ----------------------------------------------------------

      return {
        rank: index + 1,

        id: investor._id,

        fullName: investor.fullName,

        initials,

        memberSince: investor.createdAt,

        // Total FAIX Token
        totalFaixToken: totalToken,

        // Used FAIX Token
        usedFaixToken: usedToken,

        // Remaining FAIX Token
        availableFaixToken: availableToken,

        // Total profit
        totalProfitAmount:
          Number(
            investor.totalProfitAmount
          ) || 0,

        // Monthly growth
        monthlyGrowthPercent:
          Number(
            investor.monthlyGrowthPercent
          ) || 0,

        propertiesCount:
          Number(
            investor.propertiesCount
          ) || 0,

        fundsJoinedCount:
          Number(
            investor.fundsJoinedCount
          ) || 0,

        tokensCount:
          Number(
            investor.tokensCount
          ) || 0,
      };
    }
  );

  // ==============================================================
  // 10. FORMAT PROPERTIES
  // ==============================================================

  const formattedProperties =
    topProperties.map(
      (property, index) => ({
        rank: index + 1,
        ...property,
      })
    );

  // ==============================================================
  // 11. FORMAT FUNDS
  // ==============================================================

  const formattedFunds =
    topFunds.map(
      (fund, index) => ({
        rank: index + 1,
        ...fund,
      })
    );

  // ==============================================================
  // 12. FINAL DASHBOARD RESPONSE
  // ==============================================================

  return new ApiResponse(
    200,
    "Dashboard data fetched successfully.",
    {
      // ==========================================================
      // WELCOME
      // ==========================================================

      welcome: {
        fullName: user.fullName,

        propertiesCount:
          Number(
            user.propertiesCount
          ) || 0,

        fundsJoinedCount:
          Number(
            user.fundsJoinedCount
          ) || 0,

        // Total FAIX Token
        totalFaixToken,

        // Used FAIX Token
        usedFaixToken,

        // Available FAIX Token
        availableFaixToken,

        // Total Profit
        totalProfitAmount,
      },

      // ==========================================================
      // SUMMARY CARDS
      // ==========================================================
      //
      // Frontend cards:
      //
      // Total Amount
      // Used Amount
      // Total Profit Amount
      // Monthly Growth
      //
      // ==========================================================

      summary: {
        // --------------------------------------------------------
        // Card 1
        // --------------------------------------------------------
        // Total Amount = Total FAIX Token

        totalAmount: totalFaixToken,

        // --------------------------------------------------------
        // Card 2
        // --------------------------------------------------------
        // Used Amount = Used FAIX Token

        usedAmount: usedFaixToken,

        // --------------------------------------------------------
        // Card 3
        // --------------------------------------------------------
        // Total Profit Amount = User ka profit

        totalProfitAmount,

        // --------------------------------------------------------
        // Card 4
        // --------------------------------------------------------
        // Monthly Growth

        monthlyGrowthPercent,

        // --------------------------------------------------------
        // Available Token
        // --------------------------------------------------------

        availableFaixToken,
      },

      // ==========================================================
      // TOP PROPERTIES
      // ==========================================================

      topProperties:
        formattedProperties,

      // ==========================================================
      // TOP FUNDS
      // ==========================================================

      topFunds:
        formattedFunds,

      // ==========================================================
      // TOP INVESTORS
      // ==========================================================

      topInvestors: {
        list: topInvestors,

        totalInvestorCount,
      },

      // ==========================================================
      // TRANSACTION HISTORY
      // ==========================================================

      transactionHistory: {
        records:
          recentTransactions,

        totalRecords:
          totalTransactionCount,
      },
    }
  ).send(res);
});

// ================================================================
// EXPORT
// ================================================================

module.exports = {
  getDashboard,
};
