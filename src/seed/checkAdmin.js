/**
 * seed/checkAdmin.js
 * ------------------------------------------------------------------
 * DIAGNOSTIC ONLY — run this to see exactly why admin-login is
 * failing, without guessing.
 *
 * Run with: node src/seed/checkAdmin.js
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User.model');

const ADMIN_EMAIL = 'razikkhan982@gmail.com';
const ADMIN_PASSWORD = 'admin@123';

(async () => {
  await connectDB();

  const normalizedEmail = ADMIN_EMAIL.toLowerCase().trim();

  // Search WITHOUT the role filter, so we can tell "doesn't exist"
  // apart from "exists but role isn't admin".
  const anyUserWithEmail = await User.findOne({ email: normalizedEmail }).select('+password +token');

  console.log('--------------------------------------------------');
  console.log('Checking DB for:', normalizedEmail);
  console.log('--------------------------------------------------');

  if (!anyUserWithEmail) {
    console.log('❌ NO user with this email exists in the DB at all.');
    console.log('   -> Fix: run `npm run seed:admin`');
  } else {
    console.log('✅ A user with this email DOES exist:');
    console.log('   _id:      ', anyUserWithEmail._id.toString());
    console.log('   userId:   ', anyUserWithEmail.userId);
    console.log('   email:    ', anyUserWithEmail.email);
    console.log('   role:     ', anyUserWithEmail.role);
    console.log('   isActive: ', anyUserWithEmail.isActive);
    console.log('   password (hash, first 10 chars):', String(anyUserWithEmail.password).slice(0, 10));

    if (anyUserWithEmail.role !== 'admin') {
      console.log('❌ role is NOT "admin" — this is why adminLogin rejects it.');
      console.log('   -> Fix: run `npm run seed:admin` again (it sets role: "admin").');
    }

    if (!anyUserWithEmail.isActive) {
      console.log('❌ isActive is false — adminLogin rejects inactive users.');
    }

    const looksHashed = /^\$2[aby]\$/.test(anyUserWithEmail.password || '');
    if (!looksHashed) {
      console.log('❌ password does NOT look like a bcrypt hash (should start with $2a$/$2b$).');
      console.log('   -> This user was probably created by the normal /register flow');
      console.log('      (plaintext password), NOT by seed:admin. Run `npm run seed:admin`.');
    } else {
      const matches = await bcrypt.compare(ADMIN_PASSWORD, anyUserWithEmail.password);
      console.log(
        matches
          ? '✅ Password "admin@123" MATCHES the stored hash.'
          : '❌ Password "admin@123" does NOT match the stored hash.',
      );
      if (!matches) {
        console.log('   -> Fix: run `npm run seed:admin` to reset the password.');
      }
    }
  }

  console.log('--------------------------------------------------');

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('[checkAdmin] Failed:', err);
  process.exit(1);
});
