import express from "express";
import {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment
} from "../controllers/departmentController.js";
import { protect, protectAdmin } from "../middleware/auth.js";
import { cacheResponse } from "../middleware/cacheMiddleware.js";

const router = express.Router();

// Fetch all departments (accessible by all authenticated users for dropdowns and filters)
router.get("/", protect, cacheResponse(300, "departments"), getDepartments);

// Admin-only management endpoints
router.post("/", protect, protectAdmin, createDepartment);
router.put("/:id", protect, protectAdmin, updateDepartment);
router.delete("/:id", protect, protectAdmin, deleteDepartment);

export default router;
