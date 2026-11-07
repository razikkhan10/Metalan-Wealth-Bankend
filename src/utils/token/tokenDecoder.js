///// Decode Base64 token /////

const decodeToken = (encodedToken) => {
  return Buffer.from(encodedToken, "base64").toString("utf8");
};

module.exports = decodeToken;