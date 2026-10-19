import mongoose from "mongoose";

const adminReminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      index: true,
    },
    startTime: {
      type: String,
      default: null, // e.g. "10:00 AM" or "10:00"
    },
    endTime: {
      type: String,
      default: null, // e.g. "11:30 AM" or "11:30"
    },
    isAllDay: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: String,
      enum: ["PRIORITY", "MEDIUM", "NORMAL"],
      default: "NORMAL",
      index: true,
    },
    category: {
      type: String,
      default: "General",
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const AdminReminder =
  mongoose.models.AdminReminder ||
  mongoose.model("AdminReminder", adminReminderSchema);

export default AdminReminder;
