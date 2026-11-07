/**
 * models/User.model.js
 * ------------------------------------------------------------------
 * Investor User Account
 *
 * Registration fields:
 * - fullName
 * - email
 * - gender
 * - address
 * - country
 * - city
 * - state
 * - dob
 * - amountDeposited
 * - phone
 *
 * Server-generated:
 * - username
 * - password
 *
 * FAIX Token Formula:
 * faixToken = amountDeposited / 11
 * ------------------------------------------------------------------
 */

const mongoose = require("mongoose");
const getNextUserId = require("../utils/generateUserId");

const userSchema = new mongoose.Schema(
  {
    // ==================================================
    // SHORT SEQUENTIAL USER ID (display id)
    // ==================================================
    // This is NOT the MongoDB _id. It's a short human-friendly id
    // used to show/search users in the admin panel, e.g.:
    //   1st user created -> "0001"
    //   2nd user created -> "0002"
    // It is generated automatically (see the pre("save") hook at
    // the bottom of this file) — no controller needs to set it.
    // ==================================================

    userId: {
      type: String,
      unique: true,
      trim: true,
      index: true,
    },

    // ==================================================
    // BASIC USER INFORMATION
    // ==================================================

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\S+@\S+\.\S+$/,
        "Please enter a valid email address",
      ],
    },

    gender: {
      type: String,
      required: true,
      enum: ["Male", "Female", "Other"],
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    // ==================================================
    // ADDRESS INFORMATION
    // ==================================================

    address: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },
    // ==================================================
    // USER ROLE
    // ==================================================
    // "user"  -> Normal investor
    // "admin" -> Admin user
    // ==================================================

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // ==================================================
    // DATE OF BIRTH
    // ==================================================

    dob: {
      type: Date,
      required: true,
    },

    // ==================================================
    // SERVER-GENERATED LOGIN CREDENTIALS
    // ==================================================

    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Password is stored as bcrypt hash
    password: {
      type: String,
      required: true,
      select: false,
    },

    // ==================================================
    // CURRENT LOGIN TOKEN (single active session)
    // ==================================================
    // The RAW (unprotected) JWT created at login is stored here —
    // NOT the encoded/protected string that goes to the frontend.
    //
    //   signToken()      -> raw JWT            -> saved in `token` below
    //   protectToken()   -> encodes the raw JWT -> sent to the frontend
    //   restoreToken()   -> decodes it back     -> compared to `token`
    //
    // Every protected request restores the raw JWT from the
    // Authorization header and checks it against this field
    // (see middlewares/auth.middleware.js). This means:
    //   - Logging in again overwrites this value, so an old token
    //     stops working the moment a new login happens.
    //   - Logout can instantly kill a session by clearing this field.
    // `select: false` keeps it out of normal queries/responses;
    // it must be explicitly requested with .select("+token").
    // ==================================================

    token: {
      type: String,
      default: null,
      select: false,
    },

    // ==================================================
    // INITIAL DEPOSIT
    // ==================================================

    amountDeposited: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    // ==================================================
    // FAIX TOKEN
    //
    // Formula:
    // FAIX Token = amountDeposited / 11
    //
    // Example:
    // amountDeposited = 50000
    // faixToken = 50000 / 11 = 4545.4545
    // ==================================================

    faixToken: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==================================================
    // DASHBOARD / PORTFOLIO SUMMARY
    // ==================================================

    // Total portfolio value
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Amount currently invested
    usedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Total profit earned
    totalProfitAmount: {
      type: Number,
      default: 0,
    },

    // Monthly growth percentage
    monthlyGrowthPercent: {
      type: Number,
      default: 0,
    },

    // ==================================================
    // INVESTMENT COUNTERS
    // ==================================================

    propertiesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    fundsJoinedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    tokensCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==================================================
    // AVAILABLE BALANCE
    // ==================================================

    availableBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==================================================
    // ACCOUNT STATUS
    // ==================================================

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ==================================================
// AUTO-GENERATE SEQUENTIAL userId BEFORE FIRST SAVE
// ==================================================
//
// DEEP EXAMPLE — how this hook works:
//
//   1. Someone calls `User.create({ fullName: "Razik Khan", ... })`
//      (this happens in controllers/auth.controller.js register()).
//
//   2. Mongoose is ABOUT to write the document to MongoDB, but
//      first it runs every `pre("save")` hook registered below.
//
//   3. `this.isNew` is true only for a brand-new document (not for
//      an update to an existing one), so existing users never get
//      their userId regenerated/overwritten by mistake.
//
//   4. `getNextUserId()` talks to the Counter collection and
//      atomically returns the next free number, already padded
//      ("0001", "0002", ...). See utils/generateUserId.js for the
//      full explanation of that step.
//
//   5. We set `this.userId = "0001"` and call `next()` so Mongoose
//      continues with the actual save.
//
// Net effect: every route that creates a user (register, admin
// seed script, etc.) gets a sequential userId for free, with zero
// extra code in the controller.
// ==================================================

userSchema.pre("save", async function assignSequentialUserId(next) {
  try {
    if (this.isNew && !this.userId) {
      this.userId = await getNextUserId();
    }
    next();
  } catch (error) {
    next(error);
  }
});

// ==================================================
// USER INITIALS METHOD
//
// Example:
// "Razik Khan" -> "RK"
// "Syed Faizan Ali" -> "SF"
// ==================================================

userSchema.methods.initials = function () {
  return this.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
};

// ==================================================
// EXPORT USER MODEL
// ==================================================

module.exports = mongoose.model("User", userSchema);