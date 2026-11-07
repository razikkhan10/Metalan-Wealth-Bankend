/**
 * routes/admin.properties.routes.js
 * ------------------------------------------------------------------
 * ADMIN PROPERTY ROUTES
 * ------------------------------------------------------------------
 *
 * POST   /api/admin/properties
 *        -> Admin new property create karega
 *
 * PUT    /api/admin/properties/:id
 *        -> Admin property update karega
 *
 * DELETE /api/admin/properties/:id
 *        -> Admin property delete karega
 * ------------------------------------------------------------------
 */

const express = require("express");

const {
  adminProtect,
} = require("../middlewares/admin.middleware");

const {
  adminCreateProperty,
  adminUpdateProperty,
  adminDeleteProperty,
} = require("../controllers/properties.controller");

const router = express.Router();

/**
 * POST /api/admin/properties
 * Admin creates property
 */
router.post(
  "/",
  adminProtect,
  adminCreateProperty
);

/**
 * PUT /api/admin/properties/:id
 * Admin updates property
 */
router.put(
  "/:id",
  adminProtect,
  adminUpdateProperty
);

/**
 * DELETE /api/admin/properties/:id
 * Admin deletes property
 */
router.delete(
  "/:id",
  adminProtect,
  adminDeleteProperty
);

module.exports = router;
