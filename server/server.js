import express from "express";
import cors from "cors";
import "dotenv/config";
import multer from "multer";
import helmet from "helmet";
import compression from "compression";
import { rateLimit, MemoryStore } from "express-rate-limit";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import employeeRouter from "./routes/employeeRoutes.js";
import profileRouter from "./routes/profileRoutes.js";
import attendanceRouter from "./routes/attendanceRoutes.js";
import leaveRouter from "./routes/leaveRoutes.js";
import payslipRouter from "./routes/payslipsRoutes.js";
import dashboardRouter from "./routes/dashboardRoutes.js";
import kpaRouter from "./routes/kpaRoutes.js";
import attendanceCorrectionRouter from "./routes/attendanceCorrectionRoutes.js";
import feedbackRouter from "./routes/feedbackRoutes.js";
import authorizationRouter from "./routes/authorizationRoutes.js";
import adminReminderRouter from "./routes/adminReminderRoutes.js";
import departmentRouter from "./routes/departmentRoutes.js";
import holidayRouter from "./routes/holidayRoutes.js";
import incentiveRouter from "./routes/incentiveRoutes.js";
import activityLogRouter from "./routes/activityLogRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { serve } from "inngest/express";
import { inngest, functions } from "./ingest/index.js";
import logger from "./config/logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import redisClient, { isRedisConnected } from "./config/redis.js";
import { RedisStore } from "rate-limit-redis";

const app = express();
const PORT = process.env.PORT || 4000;

// Trust reverse proxy hops (e.g. Vite dev proxy, Nginx, cloud load balancers)
app.set("trust proxy", 1);

// Security Headers (configured with cross-origin asset support)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Gzip/Brotli response payload compression (reduces payload by up to 70-80%)
app.use(compression());

// CORS & Body Parsing Middleware
app.use(cors());
app.use(express.json());
app.use(multer().none());

// Structured HTTP Request Logger (propagates correlation x-request-id)
app.use(requestLogger);

// Resilient Distributed Rate-Limiting Store with Automatic In-Memory Fallback
class ResilientRateLimitStore {
    constructor(prefix) {
        this.prefix = prefix;
        this.memoryStore = new MemoryStore();
        this.localKeys = true;
        this.redisStore = null;
        this.options = null;

        if (redisClient) {
            const initRedisStore = () => {
                try {
                    const store = new RedisStore({
                        sendCommand: async (...args) => {
                            if (!isRedisConnected()) {
                                throw new Error("Redis connection offline");
                            }
                            return await redisClient.call(...args);
                        },
                        prefix: `rl:${prefix}:`,
                    });
                    if (this.options) {
                        store.init(this.options).catch(() => {});
                    }
                    this.redisStore = store;
                } catch (err) {
                    this.redisStore = null;
                }
            };

            if (isRedisConnected()) {
                initRedisStore();
            }

            redisClient.on("ready", () => {
                initRedisStore();
            });

            redisClient.on("close", () => {
                this.redisStore = null;
            });
        }
    }

    init(options) {
        this.options = options;
        if (this.memoryStore?.init) this.memoryStore.init(options);
        if (this.redisStore && isRedisConnected()) {
            this.redisStore.init(options).catch(() => {});
        }
    }

    async increment(key) {
        if (this.redisStore && isRedisConnected()) {
            try {
                return await this.redisStore.increment(key);
            } catch (err) {
                logger.warn({ key, err: err.message }, "Redis rate-limit increment error; seamlessly falling back to memory store");
            }
        }
        return await this.memoryStore.increment(key);
    }

    async decrement(key) {
        if (this.redisStore && isRedisConnected()) {
            try {
                return await this.redisStore.decrement(key);
            } catch (err) {}
        }
        return await this.memoryStore.decrement(key);
    }

    async resetKey(key) {
        if (this.redisStore && isRedisConnected()) {
            try {
                return await this.redisStore.resetKey(key);
            } catch (err) {}
        }
        return await this.memoryStore.resetKey(key);
    }

    async resetAll() {
        if (this.memoryStore?.resetAll) await this.memoryStore.resetAll();
    }

    async shutdown() {
        if (this.memoryStore?.shutdown) await this.memoryStore.shutdown();
    }
}

const createRateLimitStore = (prefix) => new ResilientRateLimitStore(prefix);

// Rate Limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 attempts per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true, // Fail-open: Never disrupt user login flow due to rate-limiting store errors
    store: createRateLimitStore("auth"),
    validate: { xForwardedForHeader: false },
    message: { error: "Too many login attempts from this IP. Please try again after 15 minutes." }
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 600, // 600 req/min per IP (10 req/s, generous for dashboards)
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true, // Fail-open: Never block API endpoints if store encounters an error
    store: createRateLimitStore("api"),
    validate: { xForwardedForHeader: false },
    message: { error: "Too many requests. Please slow down." }
});

// Production Health Check Endpoint (Monitored by Cloud Load Balancers)
app.get("/api/healthz", (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    const isCacheConnected = isRedisConnected();
    const status = isDbConnected ? "HEALTHY" : "DEGRADED";
    const statusCode = isDbConnected ? 200 : 503;

    res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
            connected: isDbConnected,
            host: mongoose.connection.host || "unknown",
            readyState: mongoose.connection.readyState
        },
        cache: {
            connected: isCacheConnected,
            provider: isCacheConnected ? "Redis" : "In-Memory (Fallback)"
        },
        memoryUsageMB: {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
    });
});

// Root ping
app.get("/", (req, res) => res.send("Server is running"));

// Apply rate limiting to auth routes & global api
app.use("/api/auth/login", authLimiter);
app.use("/api", (req, res, next) => {
    // Skip rate limiting for Inngest internal webhook executor
    if (req.path.startsWith("/inngest")) return next();
    return apiLimiter(req, res, next);
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/employees", employeeRouter);
app.use("/api/departments", departmentRouter);
app.use("/api/holidays", holidayRouter);
app.use("/api/incentives", incentiveRouter);
app.use("/api/profile", profileRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/attendance-corrections", attendanceCorrectionRouter);
app.use("/api/leave", leaveRouter);
app.use("/api/payslips", payslipRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/kpa", kpaRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/authorizations", authorizationRouter);
app.use("/api/admin/reminders", adminReminderRouter);
app.use("/api/activity-logs", activityLogRouter);
app.use("/api/inngest", serve({ client: inngest, functions }));

// Centralized Global Error Handler Middleware
app.use(errorHandler);

// Process Safety Listeners: Prevent Silent Server Crashes
process.on("unhandledRejection", (reason, promise) => {
    logger.error({ reason, promise }, "⚠️ Unhandled Rejection at Promise");
});

process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "🚨 Uncaught Exception detected");
});

await connectDB();
const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} with connection pooling, compression, Redis caching & structured logging`);
});

// Graceful Shutdown on SIGINT/SIGTERM
const gracefulShutdown = (signal) => {
    logger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
        logger.info("🔒 HTTP server closed.");
        try {
            if (redisClient && isRedisConnected()) {
                await redisClient.quit();
                logger.info("🔒 Redis connection closed.");
            }
            await mongoose.connection.close(false);
            logger.info("🔒 MongoDB connection closed.");
            process.exit(0);
        } catch (err) {
            logger.error({ err }, "Error during database close");
            process.exit(1);
        }
    });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));