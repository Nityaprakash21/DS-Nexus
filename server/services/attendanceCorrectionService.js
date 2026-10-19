import AttendanceCorrection from "../models/AttendanceCorrection.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import ApprovalDelegation from "../models/ApprovalDelegation.js";
import { AppError } from "../middleware/errorHandler.js";
import { runInTransaction } from "../utils/dbTransactions.js";

// Helper: Parse HH:mm (AM/PM or 24hr) into a Date object on the target day
export const parseTimeToDate = (baseDate, timeStr) => {
  const d = new Date(baseDate);
  if (!timeStr) return d;

  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return d;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();

  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  d.setHours(hours, minutes, 0, 0);
  return d;
};

// Review Attendance Correction Request with ACID Transaction
export const reviewCorrectionWithTransaction = async (correctionId, action, remarks, sessionUser) => {
  const correction = await AttendanceCorrection.findById(correctionId);
  if (!correction) {
    throw new AppError("Correction request not found.", 404, "NOT_FOUND");
  }

  // Authorization check
  let isAuthorized = false;
  let reviewerTitle = "Admin";

  if (sessionUser.role === "ADMIN") {
    isAuthorized = true;
  } else {
    const currentEmp = await Employee.findOne({ userId: sessionUser.userId }).lean();
    if (currentEmp) {
      const delegation = await ApprovalDelegation.findOne({
        employeeId: correction.employeeId,
        attendanceApproverId: currentEmp._id,
      });
      if (delegation) {
        isAuthorized = true;
        reviewerTitle = `${currentEmp.firstName} ${currentEmp.lastName || ""}`.trim();
      }
    }
  }

  if (!isAuthorized) {
    throw new AppError(
      "You are not authorized to review attendance corrections for this employee.",
      403,
      "UNAUTHORIZED_APPROVER"
    );
  }

  if (correction.status !== "PENDING") {
    throw new AppError(`Request is already ${correction.status.toLowerCase()}.`, 400, "ALREADY_PROCESSED");
  }

  return runInTransaction(async (session) => {
    const sessionOpt = session ? { session } : {};

    if (action === "APPROVE") {
      correction.status = "APPROVED";
      correction.adminRemarks = remarks || `Approved by ${reviewerTitle} - Marked Present`;
      correction.reviewedBy = sessionUser.userId;
      correction.reviewedAt = new Date();
      await correction.save(sessionOpt);

      const targetDate = new Date(correction.date);
      targetDate.setHours(0, 0, 0, 0);

      const checkIn = parseTimeToDate(targetDate, correction.inTime);
      const checkOut = parseTimeToDate(targetDate, correction.outTime);
      const diffMs = checkOut.getTime() - checkIn.getTime();
      const workingHours = parseFloat(Math.max(0, diffMs / (1000 * 60 * 60)).toFixed(2));
      const dayType = workingHours >= 6 ? "Full Day" : "Half Day";
      const approvalVerdict = remarks
        ? `Attendance Regularized & Approved by ${reviewerTitle}: ${remarks}`
        : `Attendance Regularized & Approved by ${reviewerTitle}`;

      let attendance = await Attendance.findOne({
        employeeId: correction.employeeId,
        date: targetDate,
      }, null, sessionOpt);

      const wasOriginallyLate = Boolean(attendance?.wasLate || attendance?.isLateBuffer);

      if (attendance) {
        attendance.status = "PRESENT";
        attendance.currentStatus = "OUT";
        attendance.checkIn = checkIn;
        attendance.checkOut = checkOut;
        attendance.workingHours = workingHours;
        attendance.dayType = dayType;
        attendance.requiresCorrection = false;
        if (wasOriginallyLate) {
          attendance.isLateBuffer = true;
          attendance.wasLate = true;
        }
        attendance.verdict = approvalVerdict + (wasOriginallyLate ? " (Late Arrival Recorded)" : "");

        if (!attendance.punches || attendance.punches.length === 0) {
          attendance.punches = [
            { type: "IN", time: checkIn },
            { type: "OUT", time: checkOut },
          ];
        } else {
          const lastP = attendance.punches[attendance.punches.length - 1];
          if (lastP.type === "IN") {
            attendance.punches.push({ type: "OUT", time: checkOut });
          }
        }
        await attendance.save(sessionOpt);
      } else {
        await Attendance.create(
          [
            {
              employeeId: correction.employeeId,
              date: targetDate,
              checkIn,
              checkOut,
              currentStatus: "OUT",
              status: "PRESENT",
              workingHours,
              dayType,
              requiresCorrection: false,
              verdict: approvalVerdict,
              punches: [
                { type: "IN", time: checkIn },
                { type: "OUT", time: checkOut },
              ],
            },
          ],
          sessionOpt
        );
      }
    } else {
      correction.status = "REJECTED";
      correction.adminRemarks = remarks || `Rejected by ${reviewerTitle}`;
      correction.reviewedBy = sessionUser.userId;
      correction.reviewedAt = new Date();
      await correction.save(sessionOpt);
    }

    return correction;
  });
};
