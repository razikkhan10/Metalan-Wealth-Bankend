/**
 * middlewares/validate.middleware.js
 * ------------------------------------------------------------------
 * Express Validator Middleware
 *
 * Usage:
 *
 * router.post(
 *   "/register",
 *   validate(validateRegister),
 *   register
 * );
 *
 * This middleware:
 *   1. Runs all express-validator rules.
 *   2. Collects validation errors.
 *   3. If there are errors -> returns HTTP 400.
 *   4. If everything is valid -> continues to controller.
 *
 * This keeps controllers clean and avoids putting
 * req.body validation logic inside controllers.
 * ------------------------------------------------------------------
 */

const { validationResult } = require("express-validator");
const ApiResponse = require("../utils/ApiResponse");

function validate(validations) {
  return async (req, res, next) => {
    try {
      // --------------------------------------------------
      // 1. Run all validation chains
      // --------------------------------------------------
      await Promise.all(
        validations.map((chain) => chain.run(req))
      );

      // --------------------------------------------------
      // 2. Get validation result
      // --------------------------------------------------
      const errors = validationResult(req);

      // --------------------------------------------------
      // 3. No errors -> continue to controller
      // --------------------------------------------------
      if (errors.isEmpty()) {
        return next();
      }

      // --------------------------------------------------
      // 4. Format validation errors
      // --------------------------------------------------
      const formattedErrors = errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      }));

      // --------------------------------------------------
      // 5. Return validation error
      // --------------------------------------------------
      return new ApiResponse(
        400,
        "Validation failed",
        formattedErrors
      ).send(res);
    } catch (error) {
      // --------------------------------------------------
      // 6. Pass unexpected errors to global error handler
      // --------------------------------------------------
      return next(error);
    }
  };
}

module.exports = validate;


// Registration flow
// Your final registration request will now work like:


/*
Frontend
   ↓
POST /api/auth/register
   ↓
validateRegister
   ↓
validate.middleware.js
   ↓
Validation OK?
   ├── NO → 400 Validation failed
   │
   └── YES
        ↓
auth.controller.js
        ↓
Generate username
        ↓
Generate password
        ↓
bcrypt hash password
        ↓
Create User
        ↓
FAIX Token = floor(amountDeposited / 11)
        ↓
Create Wallet
        ↓
Return username + password + FAIX Token

*/