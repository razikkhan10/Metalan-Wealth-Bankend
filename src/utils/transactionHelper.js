/**
 * utils/transactionHelper.js
 * ------------------------------------------------------------------
 * Shared by every controller that uses MongoDB sessions
 * (properties.controller.js purchaseProperty, fund.controller.js
 * investInFund, ...).
 *
 * MongoDB transactions (session.withTransaction) only work on a
 * replica set or a mongos (sharded cluster) — NOT on a plain
 * standalone `mongod`. A standalone server rejects the very first
 * transaction operation with:
 *
 *   MongoServerError: Transaction numbers are only allowed on a
 *   replica set member or mongos
 *   code: 20, codeName: "IllegalOperation"
 *
 * The standard pattern in this codebase is:
 *   1. Try the operation inside session.withTransaction() first —
 *      atomic and safe when the DB supports it.
 *   2. If it fails ONLY because of this specific error, re-run the
 *      exact same steps with session = null (non-atomic, but still
 *      correct/functional) so local/standalone MongoDB keeps
 *      working with zero extra configuration.
 *   3. Any OTHER error (validation, insufficient balance, etc.)
 *      must still be re-thrown as-is.
 * ------------------------------------------------------------------
 */

function isTransactionsUnsupportedError(err) {
  return (
    err?.code === 20 ||
    err?.codeName === 'IllegalOperation' ||
    /Transaction numbers are only allowed/i.test(err?.message || '')
  );
}

module.exports = { isTransactionsUnsupportedError };
