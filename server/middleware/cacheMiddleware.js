import { getCache, setCache } from "../config/redis.js";
import logger from "../config/logger.js";

/**
 * Express Middleware for HTTP Response Caching
 *
 * @param {number} ttlSeconds Time-to-live in seconds (default: 180s)
 * @param {string} prefix Optional custom cache key prefix
 */
export const cacheResponse = (ttlSeconds = 180, prefix = "") => {
  return async (req, res, next) => {
    // Only cache safe GET requests
    if (req.method !== "GET") {
      return next();
    }

    const keyPrefix = prefix || req.baseUrl || "api";
    const queryString = Object.keys(req.query).length > 0 ? `:${JSON.stringify(req.query)}` : "";
    const userRole = req.session?.role || "ANONYMOUS";
    const cacheKey = `${keyPrefix}:${req.path}:${userRole}${queryString}`;

    try {
      const cachedData = await getCache(cacheKey);
      if (cachedData) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cachedData);
      }
    } catch (err) {
      logger.warn({ cacheKey, err: err.message }, "Cache lookup failed, proceeding to handler");
    }

    // Intercept res.json to capture response payload
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.setHeader("X-Cache", "MISS");

      // Only cache successful 200 responses
      if (res.statusCode >= 200 && res.statusCode < 300 && body) {
        setCache(cacheKey, body, ttlSeconds).catch((err) => {
          logger.warn({ cacheKey, err: err.message }, "Cache set failed");
        });
      }

      return originalJson(body);
    };

    next();
  };
};
