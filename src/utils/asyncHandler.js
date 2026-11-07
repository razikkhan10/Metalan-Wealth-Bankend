/**
 * utils/asyncHandler.js
 * ------------------------------------------------------------------
 * Wraps an async Express route/controller function so that any
 * rejected promise (thrown error) is automatically forwarded to
 * `next(error)` — and therefore to our central error middleware —
 * instead of crashing the process or requiring a try/catch block
 * in every single controller.
 *
 * Usage:
 *   router.get("/", asyncHandler(async (req, res) => {
 *     const items = await SomeModel.find();
 *     res.json(items);
 *   }));
 * ------------------------------------------------------------------
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;