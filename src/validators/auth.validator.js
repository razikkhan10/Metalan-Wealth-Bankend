/**
 * validators/auth.validator.js
 * ------------------------------------------------------------------
 * express-validator chains for auth routes. Consumed by
 * middlewares/validate.middleware.js — never run directly in the
 * route file, keeping routes.js purely declarative.
 * ------------------------------------------------------------------
 */
const { body } = require('express-validator');

const validateRegister = [
  body('fullName').trim().notEmpty().withMessage('fullName is required'),
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('gender')
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('gender must be Male, Female, or Other'),
  body('address').trim().notEmpty().withMessage('address is required'),
  body('country').trim().notEmpty().withMessage('country is required'),
  body('city').trim().notEmpty().withMessage('city is required'),
  body('state').trim().notEmpty().withMessage('state is required'),
  body('dob').isISO8601().withMessage('dob must be a valid date (YYYY-MM-DD)'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('phone is required')
    .isLength({ min: 7, max: 20 })
    .withMessage('phone must be between 7 and 20 characters'),
    body('amountDeposited')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('amountDeposited must be a non-negative number'),
];

const validateLogin = [
  body('username').trim().notEmpty().withMessage('username is required'),
  body('password').notEmpty().withMessage('password is required'),
];

// Admin logs in with email + password instead of username + password.
const validateAdminLogin = [
  body('email').isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('password is required'),
];

const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('currentPassword is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('newPassword must be at least 8 characters')
    .matches(/[a-z]/)
    .withMessage('newPassword must include a lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('newPassword must include an uppercase letter')
    .matches(/[0-9]/)
    .withMessage('newPassword must include a digit'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('confirmPassword must match newPassword');
    }
    return true;
  }),
];

module.exports = {
  validateRegister,
  validateLogin,
  validateAdminLogin,
  validateChangePassword,
};
