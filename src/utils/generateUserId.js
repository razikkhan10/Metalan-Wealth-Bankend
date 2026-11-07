/**
 * utils/generateUserId.js
 * ------------------------------------------------------------------
 * Generates short, sequential, human-friendly user ids:
 *
 *     1st user  -> "0001"
 *     2nd user  -> "0002"
 *     ...
 *     9999th    -> "9999"
 *     10000th   -> "10000"   (auto-grows past 4 digits instead of
 *                             breaking, so it never overflows)
 *
 * ------------------------------------------------------------------
 * DEEP EXAMPLE — HOW THIS FUNCTION IS BUILT AND HOW TO CALL IT
 * ------------------------------------------------------------------
 *
 * Step 1: We keep a single counter document in the `counters`
 *         collection (see models/Counter.model.js):
 *
 *             { name: "userId", seq: 3 }
 *
 * Step 2: `getNextUserId()` runs:
 *
 *             Counter.findOneAndUpdate(
 *               { name: "userId" },     // find this counter
 *               { $inc: { seq: 1 } },   // atomically add 1 to it
 *               { new: true, upsert: true } // create it if missing,
 *                                            // return the UPDATED doc
 *             )
 *
 *         `$inc` is executed by MongoDB itself as a single atomic
 *         operation, so even if 100 users register at once, every
 *         request gets its own unique, strictly increasing number —
 *         nobody can ever receive the same number twice.
 *
 * Step 3: The returned `seq` (a plain number, e.g. 4) is padded
 *         with leading zeros to 4 digits -> "0004".
 *
 * USAGE EXAMPLE
 * ------------------------------------------------------------------
 *   const getNextUserId = require("../utils/generateUserId");
 *
 *   const userId = await getNextUserId();
 *   // userId === "0001" for the very first call ever made,
 *   // "0002" for the next call, and so on.
 *
 * This is called automatically from models/User.model.js in a
 * `pre("save")` hook, so every new User document gets a `userId`
 * without any controller having to remember to set it.
 * ------------------------------------------------------------------
 */

const Counter = require("../models/Counter.model");

const SEQUENCE_NAME = "userId";
const PAD_LENGTH = 4; // 0001, 0002, ... grows automatically past 9999

async function getNextUserId() {
  // findOneAndUpdate + $inc + upsert:true is the standard, race-safe
  // way to build an auto-increment counter on top of MongoDB.
  const counter = await Counter.findOneAndUpdate(
    { name: SEQUENCE_NAME },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  // Pad with leading zeros: 1 -> "0001", 25 -> "0025", 12345 -> "12345"
  return String(counter.seq).padStart(PAD_LENGTH, "0");
}

module.exports = getNextUserId;
