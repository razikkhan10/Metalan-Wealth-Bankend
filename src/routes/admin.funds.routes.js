const express = require("express");

const { adminProtect } = require("../middlewares/admin.middleware");

const {
  adminCreateFund,
} = require("../controllers/fund.controller");

const router = express.Router();

///// POST /api/admin/funds /////
///// Admin creates fund /////

router.post(
  "/",
  adminProtect,
  adminCreateFund
);

module.exports = router;