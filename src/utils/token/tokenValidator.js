///// Validate protected token format /////

const validateTokenFormat = (value) => {
  return (
    typeof value === "string" &&
    value.length > 64
  );
};

module.exports = validateTokenFormat;