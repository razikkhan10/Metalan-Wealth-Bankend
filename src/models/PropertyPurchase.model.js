/**
 * models/PropertyPurchase.model.js
 * ------------------------------------------------------------------
 * Stores each successful property purchase.
 *
 * "Kaun property purchase kar raha hai" — every purchase record
 * keeps BOTH:
 *   1. `user` — a live reference (ObjectId) to the User document,
 *      so you can always .populate('user') to get their latest,
 *      up-to-date profile.
 *   2. `buyer*` snapshot fields — a frozen copy of that user's
 *      identity AT THE MOMENT of purchase (name, email, username,
 *      phone, short userId). Snapshots matter because if the user
 *      later changes their name/email, old purchase receipts should
 *      still show who they were at the time of that purchase —
 *      exactly like the propertyName/propertyType/location snapshot
 *      fields below already do for the property side.
 * ------------------------------------------------------------------
 */

const mongoose = require('mongoose');

const propertyPurchaseSchema = new mongoose.Schema(
  {
    // Authenticated user who made the purchase.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ==================================================
    // BUYER SNAPSHOT — "kaun is property ko purchase kar raha hai"
    // Filled in from req.user / the User document at purchase time,
    // never edited afterwards. See purchaseProperty() in
    // controllers/properties.controller.js for how these are set.
    // ==================================================

    buyerUserId: {
      // Short sequential id, e.g. "0001" (User.model.js userId field)
      type: String,
      trim: true,
    },

    buyerName: {
      type: String,
      required: true,
      trim: true,
    },

    buyerUsername: {
      type: String,
      required: true,
      trim: true,
    },

    buyerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    buyerPhone: {
      type: String,
      trim: true,
    },

    // Property purchased by the user.
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },

    // Snapshot fields keep the purchase history readable even if
    // property master data is edited later.
    propertyName: {
      type: String,
      required: true,
      trim: true,
    },

    propertyType: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    purchasedFaixToken: {
      type: Number,
      required: true,
      // Decimal FAIX token amounts are allowed (e.g. 40000.9943) —
      // the previous "whole number only" validator was removed on
      // request, so `min` only guards against 0/negative values.
      min: 0.000001,
    },

    tokenValue: {
      type: Number,
      required: true,
      default: 11,
      min: 0,
    },

    purchaseAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Cancelled'],
      default: 'Completed',
    },
  },
  { timestamps: true },
);

propertyPurchaseSchema.index({ user: 1, createdAt: -1 });
propertyPurchaseSchema.index({ property: 1, createdAt: -1 });

module.exports = mongoose.model('PropertyPurchase', propertyPurchaseSchema);
