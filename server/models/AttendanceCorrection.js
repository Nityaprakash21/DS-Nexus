import mongoose from "mongoose";

const attendanceCorrectionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    inTime: {
      type: String,
      required: true, // e.g., "09:30 AM" or "09:30"
    },
    outTime: {
      type: String,
      required: true, // e.g., "06:30 PM" or "18:30"
    },
    reason: {
      type: String,
      required: true, // Mandatory explanation for missed / inaccurate punch
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    adminRemarks: {
      type: String,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Optimize query index
attendanceCorrectionSchema.index({ employeeId: 1, date: -1 });
attendanceCorrectionSchema.index({ status: 1, createdAt: -1 });

const AttendanceCorrection =
  mongoose.models.AttendanceCorrection ||
  mongoose.model("AttendanceCorrection", attendanceCorrectionSchema);

export default AttendanceCorrection;
