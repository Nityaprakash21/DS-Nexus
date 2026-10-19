import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  attendanceCorrectionSchema,
  reviewCorrectionSchema,
} from "../validators/attendanceValidators.js";
import {
  createCorrectionRequest,
  getCorrectionRequests,
  reviewCorrectionRequest,
} from "../controllers/attendanceCorrectionController.js";

const attendanceCorrectionRouter = Router();

// Employee submits correction
attendanceCorrectionRouter.post("/", protect, validateBody(attendanceCorrectionSchema), createCorrectionRequest);

// Employee & Admin fetch corrections
attendanceCorrectionRouter.get("/", protect, getCorrectionRequests);

// Admin or delegated approver reviews (approve/reject)
attendanceCorrectionRouter.patch("/:id/review", protect, validateBody(reviewCorrectionSchema), reviewCorrectionRequest);

export default attendanceCorrectionRouter;
