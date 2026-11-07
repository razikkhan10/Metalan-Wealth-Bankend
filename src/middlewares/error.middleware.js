/**
 * middleware/error.middleware.js
 * ------------------------------------------------------------------
 * Global Error Handling Middleware
 *
 * Handles:
 *   1. 404 - Route not found
 *   2. Mongoose validation errors
 *   3. MongoDB duplicate key errors
 *   4. ApiError custom errors
 *   5. Unknown/internal server errors
 *
 * This middleware should be registered LAST in app.js/server.js.
 * ------------------------------------------------------------------
 */

const ApiResponse = require("../utils/ApiResponse");

// ---------------------------------------------------------------
// 404 - ROUTE NOT FOUND
// ---------------------------------------------------------------

function notFound(req, res, next) {
  return new ApiResponse(
    404,
    `Route not found: ${req.method} ${req.originalUrl}`,
    null
  ).send(res);
}

// ---------------------------------------------------------------
// GLOBAL ERROR HANDLER
// ---------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error("[error]", err);

  // --------------------------------------------------
  // 1. Mongoose Validation Error
  // --------------------------------------------------
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map(
      (error) => error.message
    );

    return new ApiResponse(
      400,
      "Validation failed",
      errors
    ).send(res);
  }

  // --------------------------------------------------
  // 2. MongoDB Duplicate Key Error
  // --------------------------------------------------
  if (err.code === 11000) {
    const field =
      Object.keys(err.keyValue || {})[0] || "field";

    return new ApiResponse(
      409,
      `${field} already in use`,
      null
    ).send(res);
  }

  // --------------------------------------------------
  // 3. Custom ApiError
  // --------------------------------------------------
  const statusCode =
    err.statusCode && err.statusCode >= 400
      ? err.statusCode
      : 500;

  // --------------------------------------------------
  // 4. Send Final Response
  // --------------------------------------------------
  return new ApiResponse(
    statusCode,
    err.message || "Internal server error",
    null
  ).send(res);
}

// ---------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------

module.exports = {
  notFound,
  errorHandler,
};