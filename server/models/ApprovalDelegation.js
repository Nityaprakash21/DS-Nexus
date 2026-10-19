import mongoose from "mongoose";

const approvalDelegationSchema = new mongoose.Schema(
  {
    // The target employee whose actions require approval
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      unique: true,
      index: true,
    },
    // The designated approver for leaves (null = Admin / Super Admin)
    leaveApproverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    // The designated approver for attendance corrections (null = Admin / Super Admin)
    attendanceApproverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    // The designated evaluator for KPA performance appraisals (null = Admin / Super Admin)
    kpaEvaluatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    // Custom permission toggles for specific module actions
    customPermissions: {
      canViewTeamAttendance: { type: Boolean, default: false },
      canManageTeamPayslips: { type: Boolean, default: false },
      canReviewFeedback: { type: Boolean, default: false },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const ApprovalDelegation =
  mongoose.models.ApprovalDelegation ||
  mongoose.model("ApprovalDelegation", approvalDelegationSchema);

export default ApprovalDelegation;
