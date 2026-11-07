const express = require('express');
const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboard.routes');
const transactionRoutes = require('./transaction.routes');
const propertyRoutes = require('./properties.routes');
const adminPropertyRoutes = require('./admin.properties.routes');
const adminFundRoutes = require('./admin.funds.routes');
const fundRoutes = require("./fund.routes");
const walletRoutes = require("./wallet.routes");
const adminUsersRoutes = require("./admin.users.routes");

const router = express.Router();

router.get('/health', (req, res) => res.json({ success: true, message: 'OK' }));

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/properties', propertyRoutes);
router.use('/admin/properties', adminPropertyRoutes);
router.use('/transactions', transactionRoutes);
router.use('/admin/funds', adminFundRoutes);
router.use("/funds", fundRoutes);
router.use("/wallet", walletRoutes);
router.use("/admin/users", adminUsersRoutes);

module.exports = router;
