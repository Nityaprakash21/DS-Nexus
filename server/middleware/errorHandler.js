// Centralized Production Error Handling Architecture
// Formats all errors into standardized, consistent JSON response schemas

import logger from "../config/logger.js";

export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = "INTERNAL_SERVER_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Wrapper to eliminate repetitive try-catch blocks in Express route handlers
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Global Express Error-Handling Middleware
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "An unexpected error occurred.";
  let errorCode = err.errorCode || "INTERNAL_ERROR";
  let details = null;

  // 1. Zod Schema Validation Errors
  if (err.name === "ZodError" || err?.constructor?.name === "ZodError") {
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    message = "Request validation failed.";
    const issues = Array.isArray(err.errors) ? err.errors : (Array.isArray(err.issues) ? err.issues : []);
    details = issues.map((e) => ({
      field: Array.isArray(e.path) ? e.path.join(".") : String(e.path || ""),
      message: e.message,
    }));
    if (issues.length > 0 && issues[0]?.message) {
      message = issues.map((i) => i.message).join(", ");
    }
  }

  // 2. Mongoose Invalid ObjectId Cast Error
  else if (err.name === "CastError") {
    statusCode = 400;
    errorCode = "INVALID_ID";
    message = `Invalid format for field: ${err.path}`;
  }

  // 3. Mongoose Schema Validation Error
  else if (err.name === "ValidationError") {
    statusCode = 400;
    errorCode = "SCHEMA_VALIDATION_ERROR";
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // 4. MongoDB Duplicate Key Error (11000)
  else if (err.code === 11000) {
    statusCode = 409;
    errorCode = "DUPLICATE_KEY_ERROR";
    const duplicateFields = Object.keys(err.keyValue || {}).join(", ");
    message = `A record with this ${duplicateFields || "key"} already exists.`;
  }

  // 5. JWT Authentication Errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    errorCode = "INVALID_TOKEN";
    message = "Authentication token is invalid.";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    errorCode = "TOKEN_EXPIRED";
    message = "Authentication token has expired. Please log in again.";
  }

  // Log non-operational programmer errors
  if (!err.isOperational && statusCode === 500) {
    logger.error({ err, path: req.originalUrl, method: req.method }, "🚨 UNHANDLED SERVER ERROR");
  }

  return res.status(statusCode).json({
    success: false,
    error: message,
    code: errorCode,
    ...(details ? { details } : {}),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
