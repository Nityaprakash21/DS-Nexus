import { Router } from "express";
import { protect, protectAdmin } from "../middleware/auth.js";
import { requirePermissionOrAdmin } from "../middleware/permission.js";
import { createPayslip, getPayslipById, getPayslips, deletePayslip } from "../controllers/payslipController.js";

const payslipRouter = Router();
payslipRouter.post("/", protect, requirePermissionOrAdmin("canManageTeamPayslips"), createPayslip);
payslipRouter.get("/", protect, getPayslips);
payslipRouter.get("/:id", protect, getPayslipById);
payslipRouter.delete("/:id", protect, protectAdmin, deletePayslip);

export default payslipRouter;