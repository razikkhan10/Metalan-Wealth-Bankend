const express = require('express');
const { getDashboard } = require('../controllers/dashboard.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', protect, getDashboard);

module.exports = router;
