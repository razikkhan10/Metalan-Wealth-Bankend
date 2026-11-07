const crypto = require("crypto");

///// Generate random key /////

const generateRandomKey = () => {
  return crypto.randomBytes(16).toString("hex");
};

module.exports = {
  generateRandomKey,
};