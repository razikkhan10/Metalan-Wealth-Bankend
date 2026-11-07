/**
 * config/db.js
 * ------------------------------------------------------------------
 * Establishes and exports the Mongoose connection to MongoDB.
 * ------------------------------------------------------------------
 */
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wealth_db';
    const conn = await mongoose.connect(uri);
    console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
