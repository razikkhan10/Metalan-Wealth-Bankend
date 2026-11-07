class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = null
  ) {
    super(message);

    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errors = null) {
    return new ApiError(400, message, errors);
  }

  static conflict(message, errors = null) {
    return new ApiError(409, message, errors);
  }

  static unauthorized(message, errors = null) {
    return new ApiError(401, message, errors);
  }

  static notFound(message, errors = null) {
    return new ApiError(404, message, errors);
  }

  static internal(message, errors = null) {
    return new ApiError(500, message, errors);
  }

  static forbidden(message, errors = null) {
  return new ApiError(403, message, errors);
  }
}

module.exports = ApiError;