import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import {
  getIncentives,
  getIncentiveStats,
  getEmployeeMonthlyIncentive,
  createIncentive,
  updateIncentive,
  deleteIncentive,
} from "../controllers/incentiveController.js";

const incentiveRouter = Router();

// All incentive routes require valid user login AND Admin role
incentiveRouter.use(protect);
incentiveRouter.use(protectAdmin);

incentiveRouter.get("/", getIncentives);
incentiveRouter.get("/stats", getIncentiveStats);
incentiveRouter.get("/employee-monthly-incentive", getEmployeeMonthlyIncentive);
incentiveRouter.post("/", createIncentive);
incentiveRouter.put("/:id", updateIncentive);
incentiveRouter.delete("/:id", deleteIncentive);

export default incentiveRouter;
