/**
 * seed/adminSeed.js
 * ------------------------------------------------------------------
 * Creates (or updates) the ONE admin account used to log in via
 *   POST /api/auth/admin-login   { "email": ..., "password": ... }
 *
 * Run with: npm run seed:admin
 *
 * DEEP EXAMPLE — why a seed script instead of a public "register
 * admin" API:
 *   - There must be exactly one, known admin identity; letting
 *     anyone hit an API to create admins would be a serious
 *     security hole.
 *   - This script is meant to be run ONCE (safe to re-run — it
 *     upserts, so re-running just resets the password instead of
 *     erroring on "duplicate email").
 *   - The password is bcrypt-hashed here, exactly the way
 *     controllers/auth.controller.js `adminLogin()` expects to
 *     verify it (bcrypt.compare), unlike the plaintext-compare
 *     currently used for normal investor logins.
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User.model');

const SALT_ROUNDS = 10;

// ------------------------------------------------------------------
// Admin identity — as requested:
//   email:    razikkhan982@gmail.com
//   password: admin@123
// ------------------------------------------------------------------
const ADMIN_EMAIL = 'razikkhan982@gmail.com';
const ADMIN_PASSWORD = 'admin@123';

(async () => {
  await connectDB();

  const normalizedEmail = ADMIN_EMAIL.toLowerCase().trim();
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

  // NOTE: we intentionally use findOne + create/save (NOT
  // findOneAndUpdate with upsert) because the sequential userId
  // ("0001", "0002", ...) is generated inside a `pre("save")` hook
  // on the User model — that hook only runs on .save()/.create(),
  // not on findOneAndUpdate. Using create/save here guarantees the
  // admin also gets a proper userId, same as any registered user.
  let admin = await User.findOne({ email: normalizedEmail });

  const adminFields = {
    fullName: 'Razik Khan',
    email: normalizedEmail,
    gender: 'Male',
    address: 'Admin HQ',
    country: 'India',
    city: 'Indore',
    state: 'Madhya Pradesh',
    dob: new Date('1995-01-01'),
    phone: '+91-0000000000',
    username: 'admin',
    password: hashedPassword,
    role: 'admin',
    isActive: true,
  };

  if (admin) {
    // Already exists — refresh details/password, keep the same
    // userId and _id (safe to re-run this script any time).
    Object.assign(admin, adminFields);
    await admin.save();
  } else {
    // First run — create a brand-new admin user document. This
    // triggers the pre("save") hook that assigns userId ("0001",
    // "0002", ... whichever is next in the sequence).
    admin = await User.create(adminFields);
  }

  console.log('[seed:admin] Admin account ready:');
  console.log(`  userId:   ${admin.userId}`);
  console.log(`  email:    ${admin.email}`);
  console.log(`  username: ${admin.username}`);
  console.log('  password: admin@123 (as configured, already hashed in DB)');
  console.log('Login with: POST /api/auth/admin-login { "email": "razikkhan982@gmail.com", "password": "admin@123" }');

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('[seed:admin] Failed:', err);
  process.exit(1);
});
