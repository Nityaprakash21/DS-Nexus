import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userEmail: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    userRole: {
      type: String,
      enum: ["ADMIN", "EMPLOYEE", "SYSTEM"],
      default: "EMPLOYEE",
      index: true,
    },
    category: {
      type: String,
      enum: [
        "AUTH",
        "ATTENDANCE",
        "LEAVE",
        "PROFILE",
        "EMPLOYEES",
        "DEPARTMENTS",
        "HOLIDAYS",
        "INCENTIVES",
        "PAYSLIPS",
        "KPA",
        "FEEDBACK",
        "SETTINGS",
        "SYSTEM",
      ],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: "",
      trim: true,
    },
    userAgent: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "WARNING", "FAILED"],
      default: "SUCCESS",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast date-range + user/category queries
activityLogSchema.index({ createdAt: -1, userId: 1 });
activityLogSchema.index({ createdAt: -1, category: 1 });

const ActivityLog =
  mongoose.models.ActivityLog ||
  mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLog;
