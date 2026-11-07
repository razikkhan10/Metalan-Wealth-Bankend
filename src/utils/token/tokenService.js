const { generateRandomKey } = require("./tokenConfig");

const encodeToken = require("./tokenEncoder");
const decodeToken = require("./tokenDecoder");

///// Protect token with random prefix and suffix /////

const protectToken = (token) => {
  if (!token) {
    throw new Error("Token is required");
  }

  const prefix = generateRandomKey();
  const suffix = generateRandomKey();

  const encodedToken = encodeToken(token);

  return `${prefix}${encodedToken}${suffix}`;
};

///// Restore original token /////

const restoreToken = (value) => {
  if (typeof value !== "string" || value.length < 64) {
    throw new Error("Invalid token format");
  }

  const encodedToken = value.slice(32, -32);

  return decodeToken(encodedToken);
};

module.exports = {
  protectToken,
  restoreToken,
};