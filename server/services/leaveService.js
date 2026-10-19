import LeaveApplication from "../models/LeaveApplication.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import ApprovalDelegation from "../models/ApprovalDelegation.js";
import { getPassedMarketHolidaysCount } from "../constants/marketHolidays.js";
import { AppError } from "../middleware/errorHandler.js";
import { runInTransaction } from "../utils/dbTransactions.js";

export const LEAVE_QUOTAS = {
  SICK: 5,
  CASUAL: 10,
  ANNUAL: 20,
};

// Calculate calendar days between two dates inclusive
export const calculateLeaveDays = (startDate, endDate) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

// Calculate consumed/committed leaves in the financial year
export const calculateCommittedLeaves = async (employeeId, fy) => {
  const allFyCommittedLeaves = await LeaveApplication.find({
    employeeId,
    status: { $in: ["APPROVED", "PENDING"] },
    startDate: { $lte: fy.endDate },
    endDate: { $gte: fy.startDate },
  }).lean();

  const passedHolidays = await getPassedMarketHolidaysCount(fy);

  const sickCommitted = allFyCommittedLeaves
    .filter((l) => l.type === "SICK")
    .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);

  const casualCommitted = allFyCommittedLeaves
    .filter((l) => l.type === "CASUAL")
    .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);

  const annualCommitted =
    passedHolidays +
    allFyCommittedLeaves
      .filter((l) => l.type === "ANNUAL")
      .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);

  return {
    sickCommitted,
    casualCommitted,
    annualCommitted,
    sickRemaining: Math.max(0, LEAVE_QUOTAS.SICK - sickCommitted),
    casualRemaining: Math.max(0, LEAVE_QUOTAS.CASUAL - casualCommitted),
  };
};

// Review Leave Application with ACID Transaction guarantees
export const reviewLeaveWithTransaction = async (leaveId, status, sessionUser, rejectionReason = null) => {
  const leave = await LeaveApplication.findById(leaveId);
  if (!leave) {
    throw new AppError("Leave application not found", 404, "NOT_FOUND");
  }

  // Authorization check
  if (sessionUser.role !== "ADMIN") {
    const currentEmp = await Employee.findOne({ userId: sessionUser.userId }).lean();
    if (!currentEmp) {
      throw new AppError("Employee profile not found", 403, "FORBIDDEN");
    }

    const delegation = await ApprovalDelegation.findOne({
      employeeId: leave.employeeId,
      leaveApproverId: currentEmp._id,
    });

    if (!delegation) {
      throw new AppError(
        "You are not authorized to approve or reject leave applications for this employee.",
        403,
        "UNAUTHORIZED_APPROVER"
      );
    }
  }

  const startD = new Date(leave.startDate);
  startD.setHours(0, 0, 0, 0);
  const endD = new Date(leave.endDate);
  endD.setHours(23, 59, 59, 999);

  return runInTransaction(async (session) => {
    leave.status = status;
    if (status === "REJECTED" && rejectionReason) {
      leave.rejectionReason = rejectionReason;
    }
    leave.reviewedBy = sessionUser.userId;
    leave.reviewedAt = new Date();
    await leave.save(session ? { session } : {});

    if (status === "APPROVED") {
      const query = Attendance.find({
        employeeId: leave.employeeId,
        date: { $gte: startD, $lte: endD },
      });
      if (session) query.session(session);
      const attendanceRecords = await query;

      for (const att of attendanceRecords) {
        const hasPunches = Boolean(att.checkIn || (att.punches && att.punches.length > 0));
        if (hasPunches) {
          att.status = "PRESENT";
          const isLateBuf = Boolean(att.isLateBuffer || att.wasLate);
          if (isLateBuf) {
            att.isLateBuffer = true;
            att.wasLate = true;
          }
          att.requiresCorrection = false;
          att.verdict = `Regularized via Approved ${
            leave.type === "SICK" ? "Sick" : "Casual"
          } Leave${isLateBuf ? " (Late Arrival Recorded)" : ""}`;
          if (!att.dayType || att.dayType === "Absent") {
            att.dayType = "Full Day";
          }
          await att.save(session ? { session } : {});
        } else {
          await Attendance.findByIdAndDelete(att._id, session ? { session } : {});
        }
      }
    } else if (status === "REJECTED") {
      const updateOptions = session ? { session } : {};
      await Attendance.updateMany(
        {
          employeeId: leave.employeeId,
          date: { $gte: startD, $lte: endD },
          status: "ABSENT",
        },
        {
          $set: {
            requiresCorrection: true,
            verdict: `Leave Application Rejected (${leave.type}). Marked Absent - Regularize via Attendance Correction or recorded as Leave Without Pay (LWP).`,
          },
        },
        updateOptions
      );
    }

    return leave;
  });
};
