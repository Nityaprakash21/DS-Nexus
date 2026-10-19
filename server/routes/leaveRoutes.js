import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createLeaveSchema, updateLeaveStatusSchema, updateLeaveSchema } from "../validators/leaveValidators.js";
import { createLeave, getLeaves, updateLeaveStatus, updateLeave } from "../controllers/leaveController.js";

const leaveRouter = Router();
leaveRouter.post("/", protect, validateBody(createLeaveSchema), createLeave);
leaveRouter.get("/", protect, getLeaves);
leaveRouter.patch("/:id", protect, validateBody(updateLeaveStatusSchema), updateLeaveStatus);
leaveRouter.put("/:id", protect, validateBody(updateLeaveSchema), updateLeave);

export default leaveRouter;