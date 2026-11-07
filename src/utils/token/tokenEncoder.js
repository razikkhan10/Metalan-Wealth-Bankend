///// Encode token into Base64 /////

const encodeToken = (token) => {
  return Buffer.from(token, "utf8").toString("base64");
};

module.exports = encodeToken;