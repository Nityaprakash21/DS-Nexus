import express from "express";
import {
  getAuthorizations,
  updateAuthorizations,
  getMyDelegations,
} from "../controllers/authorizationController.js";
import { protect, protectAdmin } from "../middleware/auth.js";

const router = express.Router();

// Admin-only management endpoints
router.get("/", protect, protectAdmin, getAuthorizations);
router.put("/", protect, protectAdmin, updateAuthorizations);

// Delegated employee inquiry endpoint
router.get("/my-delegations", protect, getMyDelegations);

export default router;
