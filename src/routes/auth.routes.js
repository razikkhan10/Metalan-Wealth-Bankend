/**
 * routes/auth.routes.js
 * ------------------------------------------------------------------
 * Mounted at /api/auth (see routes/index.js).
 * ------------------------------------------------------------------
 */



const express = require("express");
const authController = require("../controllers/auth.controller");
const validate = require("../middlewares/validate.middleware");
const { protect } = require("../middlewares/auth.middleware");
const {
  validateRegister,
  validateLogin,
  validateAdminLogin,
  validateChangePassword,
} = require("../validators/auth.validator");

const router = express.Router();

// Public
router.post("/register", validate(validateRegister), authController.register);
router.post("/login", validate(validateLogin), authController.login);

// Admin login — email + password (see controllers/auth.controller.js
// adminLogin(), and src/seed/adminSeed.js for the seeded account).
router.post(
  "/admin-login",
  validate(validateAdminLogin),
  authController.adminLogin
);

// Protected
router.get("/me", protect, authController.getMe);
router.post("/logout", protect, authController.logout);
router.put(
  "/change-password",
  protect,
  validate(validateChangePassword),
  authController.changePassword
);

module.exports = router;
