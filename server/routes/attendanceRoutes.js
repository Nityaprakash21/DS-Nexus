import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { clockInOutSchema } from "../validators/attendanceValidators.js";
import {
  clockInOut,
  getAttendance,
  getMonthlyAttendance,
  getEmployeeMonthlyLwp,
  getTeamPunches,
} from "../controllers/attendanceController.js";

const attendanceRouter = Router();

attendanceRouter.post("/", protect, validateBody(clockInOutSchema), clockInOut);
attendanceRouter.get("/", protect, getAttendance);
attendanceRouter.get("/team-punches", protect, getTeamPunches);
attendanceRouter.get("/monthly", protect, getMonthlyAttendance);
attendanceRouter.get("/employee-monthly-lwp", protect, getEmployeeMonthlyLwp);

export default attendanceRouter;