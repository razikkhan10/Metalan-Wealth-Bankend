const express = require("express");
const { adminProtect } = require("../middlewares/admin.middleware");
const { getUserByUserId } = require("../controllers/admin.user.controller");

const router = express.Router();

// GET /api/admin/users/0001 -> full details of that user
router.get("/:userId", adminProtect, getUserByUserId);

module.exports = router;
