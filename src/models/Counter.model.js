/**
 * models/Counter.model.js
 * ------------------------------------------------------------------
 * Generic sequence/counter collection.
 *
 * WHY THIS EXISTS
 * ------------------------------------------------------------------
 * MongoDB's default `_id` is a random ObjectId (e.g. "68f2a1c9...").
 * That is great for uniqueness but useless if the business wants
 * short, human-friendly, SEQUENTIAL ids like:
 *
 *     0001, 0002, 0003, ... 9999, 10000, ...
 *
 * Mongo has no built-in "auto increment" like SQL's AUTO_INCREMENT,
 * so the standard pattern is:
 *
 *   1. Keep ONE document per counter name in this collection.
 *      Example document for the "userId" counter:
 *        { name: "userId", seq: 7 }
 *
 *   2. Every time a new number is needed, run an ATOMIC
 *      "increment and return the new value" operation
 *      (findOneAndUpdate with $inc). Atomic = safe even if two
 *      users register at the exact same millisecond, because
 *      MongoDB guarantees only one of the two increments "wins"
 *      first and the other gets the next number — no duplicate
 *      ids, no race condition.
 *
 * HOW IT'S USED
 * ------------------------------------------------------------------
 * See utils/generateUserId.js, which wraps this model and turns the
 * raw number into the padded string format the product wants
 * ("0001", "0002", ...).
 * ------------------------------------------------------------------
 */

const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  // Name of the sequence, e.g. "userId"
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  // Last number that was handed out for this sequence
  seq: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("Counter", counterSchema);
