const express = require("express");

const { protect } = require("../middlewares/auth.middleware");

const {
  getFunds,
  investInFund,
  getFundInvestments,
  getUserFundInvestments,
} = require("../controllers/fund.controller");

const router = express.Router();

///// GET /api/funds /////
///// User gets active funds /////

router.get(
  "/",
  protect,
  getFunds
);


///// GET /api/funds/investments /////
///// (self — "my investments", via the JWT's Mongo _id) /////

router.get(
  "/investments",
  protect,
  getFundInvestments
);

///// GET /api/funds/investments/:id /////
///// Which funds a user (by short userId, e.g. "0001") has
///// invested in — self or admin only. /////

router.get(
  "/investments/:id",
  protect,
  getUserFundInvestments
);

///// POST /api/funds/invest /////
///// Body: { userID?, fundName, investmentAmount, faixTokenUsed } /////
///// Registered BEFORE "/:id" is not needed here since there is no
///// "/:id/invest" route anymore — the fund is identified by name
///// in the body (see controllers/fund.controller.js investInFund()
///// for the full deep example). /////

router.post(
  "/invest",
  protect,
  investInFund
);

module.exports = router;