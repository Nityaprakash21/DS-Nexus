import mongoose from "mongoose";
import logger from "./logger.js";

const connectDB = async () => {
    try {
        mongoose.connection.on("connected", () => {
            logger.info(`✅ Database connected to: ${mongoose.connection.host}`);
        });

        mongoose.connection.on("error", (err) => {
            logger.error({ err: err.message }, "❌ MongoDB connection runtime error");
        });

        mongoose.connection.on("disconnected", () => {
            logger.warn("⚠️ MongoDB disconnected. Mongoose will attempt to reconnect automatically.");
        });

        // Production-tuned connection pool options
        const options = {
            maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || "50", 10),
            minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || "10", 10),
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        };

        await mongoose.connect(process.env.MONGODB_URI, options);
    } catch (error) {
        logger.error({ err: error.message }, "❌ Database connection error");
    }
};

export default connectDB;