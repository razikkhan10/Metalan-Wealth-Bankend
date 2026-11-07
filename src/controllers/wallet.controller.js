/**
 * controllers/wallet.controller.js
 * ------------------------------------------------------------------
 * FAIX rule (same as properties.controller.js):
 *   1 FAIX Token = ₹11
 *
 * Exposes:
 *   POST /api/wallet/deposit   (protected) — add money, get FAIX tokens
 *   GET  /api/wallet/me        (protected) — see current balance/tokens
 * ------------------------------------------------------------------
 */

const User = require('../models/User.model');
const Wallet = require('../models/Wallet.model');
const Transaction = require('../models/Transaction.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const TOKEN_VALUE = 11; // ₹11 = 1 FAIX Token

/* ================================================================
   DEPOSIT / TOP-UP WALLET
   POST /api/wallet/deposit

   DEEP EXAMPLE — HOW TO BUILD/READ THIS FUNCTION
   ------------------------------------------------------------------
   Why this exists:
     At registration, `amountDeposited` is set ONCE and converted to
     FAIX tokens (`faixToken = amountDeposited / 11`). If that was 0
     (or too small), the user has no tokens to spend and
     purchaseProperty() correctly rejects with
     "Insufficient FAIX tokens. Available: 0, Required: X."
     This endpoint is how an EXISTING user tops up later, instead of
     having to register a brand-new account.

   Example request:
     POST /api/wallet/deposit
     Authorization: Bearer <protected token>
     Body: { "amount": 5000 }

   Step-by-step:
     1. Read the logged-in user from the verified JWT (req.user.id) —
        never from the request body, so nobody can top up someone
        else's account.
     2. Validate `amount` is a real, positive number.
     3. Convert the deposited money into FAIX tokens using the same
        formula as registration: addedFaixToken = floor(amount / 11).
     4. Add the new amount/tokens ON TOP of whatever the user already
        had (never overwrite — a deposit is additive):
          user.amountDeposited += amount
          user.faixToken       += addedFaixToken
          user.totalAmount     += addedFaixToken   (dashboard summary)
          user.availableBalance = faixToken - usedAmount (recomputed)
     5. Update (or create, if missing) the user's Wallet document —
        this is the *money* balance (₹), separate from `faixToken`
        (the *token* balance) on the User document.
     6. Log a `Transaction` record (type: "Deposit") so it shows up
        in the transaction history / dashboard exactly like a
        purchase does.
     7. Return the updated balances so the frontend can refresh
        immediately without a second API call.
   ================================================================ */

const deposit = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw ApiError.unauthorized('Authenticated user ID is missing.');
  }

  const { amount } = req.body;
  const depositAmount = Number(amount);

  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    throw ApiError.badRequest('amount must be a number greater than 0.');
  }

  // --------------------------------------------------
  // 1. Find the user
  // --------------------------------------------------
  const user = await User.findById(userId);

  if (!user) {
    throw ApiError.notFound('User not found.');
  }

  if (!user.isActive) {
    throw ApiError.unauthorized('Your account is inactive.');
  }

  // --------------------------------------------------
  // 2. Convert ₹ deposited into FAIX tokens
  //    Same formula used at registration:
  //      faixToken = amountDeposited / 11
  //    Kept as a real decimal (Math.floor removed) so a deposit
  //    like ₹5000 adds exactly 454.5454545454545 tokens instead of
  //    being truncated down to 454.
  // --------------------------------------------------
  const addedFaixToken = depositAmount / TOKEN_VALUE;

  // --------------------------------------------------
  // 3. Add on top of existing balances (never overwrite)
  // --------------------------------------------------
  user.amountDeposited = Number(user.amountDeposited || 0) + depositAmount;
  user.faixToken = Number(user.faixToken || 0) + addedFaixToken;
  user.totalAmount = Number(user.totalAmount || 0) + addedFaixToken;

  // Recompute available balance = total faixToken - already used
  user.availableBalance = Math.max(
    user.faixToken - Number(user.usedAmount || 0),
    0,
  );

  await user.save();

  // --------------------------------------------------
  // 4. Update (or create) the wallet's ₹ balance
  // --------------------------------------------------
  let wallet = await Wallet.findOne({ user: user._id });

  if (!wallet) {
    wallet = await Wallet.create({
      user: user._id,
      balance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
    });
  }

  wallet.balance = Number(wallet.balance || 0) + depositAmount;
  wallet.totalDeposited = Number(wallet.totalDeposited || 0) + depositAmount;

  await wallet.save();

  // --------------------------------------------------
  // 5. Log the deposit as a Transaction (shows in history)
  // --------------------------------------------------
  const transaction = await Transaction.create({
    user: user._id,
    type: 'Deposit',
    asset: 'FAIX',
    amount: addedFaixToken,
    price: TOKEN_VALUE,
    total: depositAmount,
    status: 'Completed',
  });

  // --------------------------------------------------
  // 6. Respond with fresh balances
  // --------------------------------------------------
  const result = {
    transaction,

    depositSummary: {
      depositAmount,
      addedFaixToken,
      tokenValue: TOKEN_VALUE,
    },

    userTokenSummary: {
      totalFaixToken: user.faixToken,
      usedFaixToken: user.usedAmount,
      availableFaixToken: user.availableBalance,
    },

    walletSummary: {
      balance: wallet.balance,
      totalDeposited: wallet.totalDeposited,
      totalWithdrawn: wallet.totalWithdrawn,
    },
  };

  return new ApiResponse(200, 'Wallet deposited successfully.', result).send(
    res,
  );
});

/* ================================================================
   GET MY WALLET
   GET /api/wallet/me   (protected)

   Quick read-only summary so the frontend can show current
   balances without recomputing anything client-side.
   ================================================================ */

const getMyWallet = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw ApiError.unauthorized('Authenticated user ID is missing.');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw ApiError.notFound('User not found.');
  }

  const wallet = await Wallet.findOne({ user: user._id });

  const result = {
    userTokenSummary: {
      totalFaixToken: Number(user.faixToken || 0),
      usedFaixToken: Number(user.usedAmount || 0),
      availableFaixToken: Math.max(
        Number(user.faixToken || 0) - Number(user.usedAmount || 0),
        0,
      ),
    },

    walletSummary: {
      balance: Number(wallet?.balance || 0),
      totalDeposited: Number(wallet?.totalDeposited || 0),
      totalWithdrawn: Number(wallet?.totalWithdrawn || 0),
    },
  };

  return new ApiResponse(200, 'Wallet fetched successfully.', result).send(
    res,
  );
});

module.exports = {
  deposit,
  getMyWallet,
};
