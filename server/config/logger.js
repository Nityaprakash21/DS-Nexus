import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Production-Grade Structured JSON Logger using Pino
 * In Development: Uses pino-pretty for clean, colorized terminal output.
 * In Production: Emits ultra-fast, structured JSON suitable for Datadog, CloudWatch, Loki, and ELK.
 */
const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  base: {
    service: "ds-nexus-api",
    env: process.env.NODE_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

export default logger;
