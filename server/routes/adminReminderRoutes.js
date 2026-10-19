import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  markAsRead,
  markAllAsRead,
} from "../controllers/adminReminderController.js";

const adminReminderRouter = Router();

// All reminder operations require valid authentication (scoped per user)
adminReminderRouter.use(protect);

adminReminderRouter.get("/", getReminders);
adminReminderRouter.post("/", createReminder);
adminReminderRouter.patch("/read-all", markAllAsRead);
adminReminderRouter.patch("/:id/read", markAsRead);
adminReminderRouter.put("/:id", updateReminder);
adminReminderRouter.delete("/:id", deleteReminder);

export default adminReminderRouter;
