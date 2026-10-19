import express from "express";
import {
    getHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday
} from "../controllers/holidayController.js";
import { protect, protectAdmin } from "../middleware/auth.js";
import { cacheResponse } from "../middleware/cacheMiddleware.js";

const router = express.Router();

// Get holidays (accessible to all authenticated users for calendars and schedules)
router.get("/", protect, cacheResponse(300, "holidays"), getHolidays);

// Admin-only management endpoints
router.post("/", protect, protectAdmin, createHoliday);
router.put("/:id", protect, protectAdmin, updateHoliday);
router.delete("/:id", protect, protectAdmin, deleteHoliday);

export default router;
