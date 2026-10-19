import crypto from "crypto";
import logger from "../config/logger.js";

/**
 * Structured HTTP Request Logger Middleware
 * - Injects or propagates correlation ID via `x-request-id` header
 * - Measures request latency with high precision
 * - Logs request metadata, status code, latency, and user context
 * - Skips noiseless endpoints (e.g. `/api/healthz`, `/api/inngest`)
 */
export const requestLogger = (req, res, next) => {
  // Generate or propagate correlation request ID
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader("x-request-id", requestId);

  // Skip noisy automated health checks & internal webhooks from request logging
  const isNoisyPath =
    req.path === "/api/healthz" ||
    req.path.startsWith("/api/inngest") ||
    req.path === "/";

  if (isNoisyPath) {
    return next();
  }

  const startTime = process.hrtime.bigint();

  res.on("finish", () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;

    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: parseFloat(durationMs.toFixed(2)),
      ip: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
      userId: req.session?.userId || req.user?.userId || null,
      userRole: req.session?.role || req.user?.role || null,
    };

    if (res.statusCode >= 500) {
      logger.error(logData, `HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${durationMs.toFixed(2)}ms)`);
    } else if (res.statusCode >= 400) {
      logger.warn(logData, `HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${durationMs.toFixed(2)}ms)`);
    } else {
      logger.info(logData, `HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${durationMs.toFixed(2)}ms)`);
    }
  });

  next();
};
