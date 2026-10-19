import Redis from "ioredis";
import logger from "./logger.js";

const redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);
const isEnabled = process.env.REDIS_ENABLED === "true";

let redisClient = null;
let isConnected = false;

// Initialize connection with resilience
if (isEnabled && (redisUrl || process.env.NODE_ENV === "production" || process.env.REDIS_HOST)) {
  try {
    const connectionUrl = redisUrl || "redis://127.0.0.1:6379";
    redisClient = new Redis(connectionUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 2) {
          // Stop reconnect attempts if Redis daemon is down
          return null;
        }
        return Math.min(times * 1000, 2000);
      },
    });

    redisClient.on("connect", () => {
      isConnected = true;
      logger.info("✅ Redis connected successfully. Distributed caching & rate-limiting active.");
    });

    redisClient.on("ready", () => {
      isConnected = true;
    });

    redisClient.on("error", (err) => {
      isConnected = false;
      // Do not crash application if Redis is not running locally
      logger.warn({ err: err.message }, "⚠️ Redis connection unavailable. Gracefully operating in fallback mode.");
    });

    redisClient.on("close", () => {
      isConnected = false;
    });

    // Attempt non-blocking connection
    redisClient.connect().catch((err) => {
      isConnected = false;
      logger.warn({ err: err.message }, "⚠️ Initial Redis connection failed. Application will operate without cache.");
    });
  } catch (err) {
    logger.warn({ err: err.message }, "Failed to initialize Redis client. Operating in memory fallback mode.");
    redisClient = null;
    isConnected = false;
  }
} else {
  logger.info("ℹ️ Redis not configured or disabled via REDIS_ENABLED=false. Operating in memory fallback mode.");
}

/**
 * Checks if Redis is currently connected and responsive
 */
export const isRedisConnected = () => Boolean(isConnected && redisClient && redisClient.status === "ready");

/**
 * Get cached JSON value
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export const getCache = async (key) => {
  if (!isRedisConnected()) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.warn({ key, err: err.message }, "Redis getCache error");
    return null;
  }
};

/**
 * Set cached JSON value with TTL
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds Default: 300 seconds (5 minutes)
 */
export const setCache = async (key, value, ttlSeconds = 300) => {
  if (!isRedisConnected() || value === undefined || value === null) return;
  try {
    const serialized = JSON.stringify(value);
    await redisClient.set(key, serialized, "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ key, err: err.message }, "Redis setCache error");
  }
};

/**
 * Delete a specific cache key
 * @param {string} key
 */
export const delCache = async (key) => {
  if (!isRedisConnected()) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    logger.warn({ key, err: err.message }, "Redis delCache error");
  }
};

/**
 * Invalidate all cache keys matching a pattern (e.g. `departments:*`, `holidays:*`)
 * @param {string} pattern
 */
export const clearCachePattern = async (pattern) => {
  if (!isRedisConnected()) return;
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    logger.warn({ pattern, err: err.message }, "Redis clearCachePattern error");
  }
};

export default redisClient;
