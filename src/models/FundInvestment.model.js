const mongoose = require("mongoose");

const fundInvestmentSchema = new mongoose.Schema(
  {
    ///// User /////

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    ///// Fund /////

    fund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fund",
      required: true,
      index: true,
    },

    ///// Fund Information /////

    fundName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    ///// Investment Amount /////

    investmentAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    ///// NAV at Investment /////

    nav: {
      type: Number,
      required: true,
      min: 0,
    },

    ///// Fund Units /////

    units: {
      type: Number,
      required: true,
      min: 0,
    },

    ///// FAIX Tokens Used /////
    // Decimal FAIX token amounts are allowed (e.g. 40000.9943) —
    // the previous "whole number only" validator was removed on
    // request, so `min` only guards against 0/negative values.

    faixTokenUsed: {
      type: Number,
      required: true,
      min: 0.000001,
    },

    ///// Investment Status /////

    status: {
      type: String,
      enum: ["Pending", "Active", "Completed", "Cancelled"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

///// Indexes /////

fundInvestmentSchema.index({
  user: 1,
  createdAt: -1,
});

fundInvestmentSchema.index({
  fund: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "FundInvestment",
  fundInvestmentSchema
);