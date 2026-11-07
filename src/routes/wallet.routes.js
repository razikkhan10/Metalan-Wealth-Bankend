const express = require('express');
const walletController = require('../controllers/wallet.controller');
const validate = require('../middlewares/validate.middleware');
const { protect } = require('../middlewares/auth.middleware');
const { validateDeposit } = require('../validators/wallet.validator');

const router = express.Router();

// All wallet routes require a logged-in user.
router.post('/deposit', protect, validate(validateDeposit), walletController.deposit);
router.get('/me', protect, walletController.getMyWallet);

module.exports = router;
