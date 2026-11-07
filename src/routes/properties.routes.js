/**
 * routes/properties.routes.js
 * ------------------------------------------------------------------
 * USER PROPERTY ROUTES
 * ------------------------------------------------------------------
 *
 * GET    /api/properties
 *        -> All available properties
 *
 * GET    /api/properties/:id
 *        -> Single property
 *
 * POST   /api/properties/purchase
 *        -> User property purchase karega
 *        -> Body: { "userID": "0001", "propertyName": "...", "purchasedFaixToken": 25 }
 *        -> FAIX tokens user balance se deduct honge
 *
 * PUT    /api/properties/:id
 *        -> Property update
 *        -> Recommended: Admin only
 *
 * DELETE /api/properties/:id
 *        -> Property delete
 *        -> Recommended: Admin only
 * ------------------------------------------------------------------
 */

const express = require("express");

const { protect } = require("../middlewares/auth.middleware");

const {
  getProperties,
  getPropertyById,
  purchaseProperty,
} = require("../controllers/properties.controller");

const router = express.Router();

/**
 * GET /api/properties
 * Get all properties
 */
router.get("/", protect, getProperties);

/**
 * POST /api/properties/purchase
 * User purchases a property, identified by propertyName in the body
 * (see controllers/properties.controller.js purchaseProperty() for
 * the full deep example). Registered BEFORE "/:id" so the literal
 * word "purchase" is never mistaken for a property's Mongo _id.
 */
router.post(
  "/purchase",
  protect,
  purchaseProperty
);

/**
 * GET /api/properties/:id
 * Get single property
 */
router.get("/:id", protect, getPropertyById);

module.exports = router;
