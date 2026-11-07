/**
 * models/Fund.model.js
 * Catalog of investment funds, ranked for "Top Funds".
 */
const mongoose = require('mongoose');

const fundSchema = new mongoose.Schema(
  {
    // Fund name — now the lookup key used by investInFund()
    // (POST /api/funds/invest identifies the fund by name, not by
    // its Mongo _id) — so it must be unique, or two funds with the
    // same name would make that lookup ambiguous.
    name: { type: String, required: true, trim: true, unique: true }, // "Metalan Growth Fund"
    category: {
      type: String,
      required: true,
      enum: ['Growth', 'Index', 'Balanced', 'Fixed', 'Commodity'],
    },
    value: { type: Number, required: true, min: 0 }, // "F 125,000"
    growthPercent: { type: Number, required: true }, // "+15.3"

    ///// Current NAV /////

    nav: {
      type: Number,
      required: true,
      min: 0,
    },

    icon: { type: String, default: 'trending-up' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Fund', fundSchema);
