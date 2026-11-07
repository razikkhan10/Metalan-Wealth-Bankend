/**
 * validators/wallet.validator.js
 * ------------------------------------------------------------------
 * express-validator chain for POST /api/wallet/deposit.
 * ------------------------------------------------------------------
 */
const { body } = require('express-validator');

const validateDeposit = [
  body('amount')
    .notEmpty()
    .withMessage('amount is required')
    .isFloat({ gt: 0 })
    .withMessage('amount must be a number greater than 0'),
];

module.exports = { validateDeposit };
