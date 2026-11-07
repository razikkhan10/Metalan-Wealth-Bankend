/**
 * models/Transaction.model.js
 * Feeds the "Transaction History" table on the dashboard.
 */
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['Buy', 'Sell', 'Swap', 'Dividend', 'Deposit', 'Stake', 'Withdraw'],
    },
    asset: { type: String, required: true, trim: true }, // e.g. "FAIX", "BTC", "ETH→FAIX"
    amount: { type: Number, default: 0 }, // quantity; can be 0 for dividends
    price: { type: Number, default: 0 }, // unit price
    total: { type: Number, required: true }, // total value of the transaction
    status: {
      type: String,
      required: true,
      enum: ['Completed', 'Processing', 'Pending', 'Failed'],
      default: 'Pending',
    },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
