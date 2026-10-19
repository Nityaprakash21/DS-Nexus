import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import { cacheResponse } from "../middleware/cacheMiddleware.js";
import {
  getActivityLogs,
  getActivityUsers,
  getActivityStats,
  clearOldActivityLogs,
} from "../controllers/activityLogController.js";

const activityLogRouter = Router();

// Strictly protected for Admin role only
activityLogRouter.use(protect);
activityLogRouter.use(protectAdmin);

activityLogRouter.get("/", getActivityLogs);
activityLogRouter.get("/users", cacheResponse(180, "activity-users"), getActivityUsers);
activityLogRouter.get("/stats", cacheResponse(60, "activity-stats"), getActivityStats);
activityLogRouter.delete("/clear", clearOldActivityLogs);

export default activityLogRouter;
