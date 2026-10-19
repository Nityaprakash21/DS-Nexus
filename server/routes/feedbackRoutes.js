import express from "express";
import { protect } from "../middleware/auth.js";
import { requirePermissionOrAdmin } from "../middleware/permission.js";
import {
    getFeedbacks,
    createFeedback,
    updateFeedbackStatus,
    deleteFeedback
} from "../controllers/feedbackController.js";

const router = express.Router();

router.get("/", protect, getFeedbacks);
router.post("/", protect, createFeedback);
router.patch("/:id/status", protect, requirePermissionOrAdmin("canReviewFeedback"), updateFeedbackStatus);
router.delete("/:id", protect, deleteFeedback);

export default router;
