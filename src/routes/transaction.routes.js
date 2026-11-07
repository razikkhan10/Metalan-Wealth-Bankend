const express = require('express');
const { listTransactions, createTransaction } = require('../controllers/transaction.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', protect, listTransactions);
router.post('/', protect, createTransaction);

module.exports = router;
