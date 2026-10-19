import AttendanceCorrection from "../models/AttendanceCorrection.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import ApprovalDelegation from "../models/ApprovalDelegation.js";
import { getISTDateString, getISTMidnightDate } from "./attendanceController.js";
import { reviewCorrectionWithTransaction } from "../services/attendanceCorrectionService.js";

// Monthly attendance correction limit per employee
export const MONTHLY_CORRECTION_LIMIT = 10;

// Helper: Parse time string (e.g., "09:30 AM", "18:30", "09:30") into a Date object on a given date
const parseTimeToDate = (baseDate, timeStr) => {
  const d = new Date(baseDate);
  const clean = (timeStr || "").trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[3]?.toUpperCase();
    if (meridian === "PM" && hours < 12) hours += 12;
    if (meridian === "AM" && hours === 12) hours = 0;
    d.setHours(hours, minutes, 0, 0);
    return d;
  }
  d.setHours(9, 30, 0, 0);
  return d;
};

// POST /api/attendance-corrections
// Employee submits attendance correction request
export const createCorrectionRequest = async (req, res) => {
  try {
    const session = req.session;
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const employee = await Employee.findOne({ userId: session.userId });
    if (!employee) {
      return res.status(404).json({ error: "Employee record not found" });
    }
    if (employee.isDeleted) {
      return res.status(403).json({ error: "Account deactivated. Cannot request attendance correction." });
    }

    const date = req.body.date;
    const inTime = req.body.inTime || req.body.requestedCheckIn;
    const outTime = req.body.outTime || req.body.requestedCheckOut;
    const reason = req.body.reason;
    if (!date || !inTime || !outTime || !reason) {
      return res.status(400).json({ error: "Date, In-Time, Out-Time, and Reason are all mandatory." });
    }

    // Determine target date and today in IST
    let targetDateStr = typeof date === "string" ? date.split("T")[0] : getISTDateString(new Date(date));
    if (targetDateStr && targetDateStr.includes("/")) {
      const parts = targetDateStr.split("/");
      if (parts.length === 3 && parts[2].length === 4) {
        targetDateStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }
    const now = new Date();
    const todayISTMidnight = getISTMidnightDate(now);
    const targetDate = new Date(`${targetDateStr}T00:00:00.000+05:30`);

    // Strictly enforce: Attendance correction can only be applied from the next day onwards (not on the same day)
    if (targetDate >= todayISTMidnight) {
      const parts = targetDateStr.split("-");
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : targetDateStr;
      return res.status(400).json({
        error: `Attendance correction for ${formattedDate} can only be applied from the next day onwards. You cannot apply for today's ongoing shift on the same day.`,
        code: "SAME_OR_FUTURE_DAY_NOT_ALLOWED"
      });
    }

    // Check if an existing PENDING request already exists for this date
    const existingPending = await AttendanceCorrection.findOne({
      employeeId: employee._id,
      date: targetDate,
      status: "PENDING",
    });
    if (existingPending) {
      return res.status(400).json({
        error: "A correction request for this date is already pending Admin approval.",
      });
    }

    // Check monthly limit (Max 10 attendance corrections per calendar month)
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthlyCount = await AttendanceCorrection.countDocuments({
      employeeId: employee._id,
      date: { $gte: startOfMonth, $lte: endOfMonth },
      status: { $ne: "REJECTED" },
    });

    if (monthlyCount >= MONTHLY_CORRECTION_LIMIT) {
      const monthName = targetDate.toLocaleString("en-US", { month: "long" });
      return res.status(400).json({
        error: `Monthly correction limit reached. You can only apply for up to ${MONTHLY_CORRECTION_LIMIT} attendance corrections in ${monthName} (${monthlyCount}/${MONTHLY_CORRECTION_LIMIT} already used).`,
      });
    }

    const correction = await AttendanceCorrection.create({
      employeeId: employee._id,
      date: targetDate,
      inTime: inTime.trim(),
      outTime: outTime.trim(),
      reason: reason.trim(),
      status: "PENDING",
    });

    return res.status(201).json({
      success: true,
      message: "Attendance correction request submitted for Admin review.",
      data: correction,
    });
  } catch (error) {
    console.error("Create correction error:", error);
    return res.status(500).json({ error: "Failed to submit attendance correction request." });
  }
};

// GET /api/attendance-corrections
// Fetch correction requests (Admin sees all, Employee sees own)
export const getCorrectionRequests = async (req, res) => {
  try {
    const session = req.session;
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isAdmin = session.role === "ADMIN";
    const statusFilter = req.query.status;

    if (isAdmin) {
      const query = {};
      if (statusFilter && ["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)) {
        query.status = statusFilter;
      }

      const requests = await AttendanceCorrection.find(query)
        .populate("employeeId", "firstName lastName department position")
        .sort({ createdAt: -1 })
        .lean();

      // Look up current attendance record for each request date to show existing status
      const formatted = await Promise.all(
        requests.map(async (reqItem) => {
          const emp = reqItem.employeeId;
          const currentAttendance = await Attendance.findOne({
            employeeId: emp?._id,
            date: reqItem.date,
          }).lean();

          return {
            id: reqItem._id.toString(),
            date: reqItem.date,
            inTime: reqItem.inTime,
            outTime: reqItem.outTime,
            reason: reqItem.reason,
            status: reqItem.status,
            adminRemarks: reqItem.adminRemarks ? reqItem.adminRemarks.replace(/Super Admin/gi, "Admin") : "",
            createdAt: reqItem.createdAt,
            reviewedAt: reqItem.reviewedAt,
            employee: emp
              ? {
                id: emp._id.toString(),
                name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
                department: emp.department,
                position: emp.position,
              }
              : null,
            currentAttendance: currentAttendance
              ? {
                status: currentAttendance.status,
                checkIn: currentAttendance.checkIn,
                checkOut: currentAttendance.checkOut,
                workingHours: currentAttendance.workingHours,
                dayType: currentAttendance.dayType,
              }
              : null,
          };
        })
      );

      return res.json({
        success: true,
        data: formatted,
        counts: {
          pending: await AttendanceCorrection.countDocuments({ status: "PENDING" }),
          approved: await AttendanceCorrection.countDocuments({ status: "APPROVED" }),
          rejected: await AttendanceCorrection.countDocuments({ status: "REJECTED" }),
        },
      });
    } else {
      // Employee view
      const employee = await Employee.findOne({ userId: session.userId });
      if (!employee) {
        return res.status(404).json({ error: "Employee record not found" });
      }

      const requests = await AttendanceCorrection.find({ employeeId: employee._id })
        .sort({ createdAt: -1 })
        .lean();

      // Check if this employee is designated attendance approver for any team members
      const delegatedAssignments = await ApprovalDelegation.find({ attendanceApproverId: employee._id })
        .select("employeeId")
        .lean();

      let delegatedReviews = [];
      let delegatedCounts = { all: 0, pending: 0, approved: 0, rejected: 0 };

      if (delegatedAssignments.length > 0) {
        const targetIds = delegatedAssignments.map(a => a.employeeId);

        delegatedCounts = {
          all: await AttendanceCorrection.countDocuments({ employeeId: { $in: targetIds } }),
          pending: await AttendanceCorrection.countDocuments({ employeeId: { $in: targetIds }, status: "PENDING" }),
          approved: await AttendanceCorrection.countDocuments({ employeeId: { $in: targetIds }, status: "APPROVED" }),
          rejected: await AttendanceCorrection.countDocuments({ employeeId: { $in: targetIds }, status: "REJECTED" }),
        };

        const teamQuery = { employeeId: { $in: targetIds } };
        if (statusFilter && ["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)) {
          teamQuery.status = statusFilter;
        }

        const teamRequests = await AttendanceCorrection.find(teamQuery)
          .populate("employeeId", "_id employeeCode firstName lastName department position")
          .sort({ createdAt: -1 })
          .lean();

        delegatedReviews = await Promise.all(
          teamRequests.map(async (r) => {
            const emp = r.employeeId;
            const currentAttendance = await Attendance.findOne({
              employeeId: emp?._id,
              date: r.date,
            }).lean();

            return {
              id: r._id.toString(),
              date: r.date,
              inTime: r.inTime,
              outTime: r.outTime,
              reason: r.reason,
              status: r.status,
              adminRemarks: r.adminRemarks || "",
              createdAt: r.createdAt,
              reviewedAt: r.reviewedAt,
              employee: emp ? {
                id: emp._id.toString(),
                name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
                employeeCode: emp.employeeCode || "",
                department: emp.department,
                position: emp.position,
              } : null,
              currentAttendance: currentAttendance ? {
                status: currentAttendance.status,
                checkIn: currentAttendance.checkIn,
                checkOut: currentAttendance.checkOut,
                workingHours: currentAttendance.workingHours,
                dayType: currentAttendance.dayType,
              } : null,
            };
          })
        );
      }

      // Calculate current calendar month's correction quota
      const now = new Date();
      const currentStartOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const currentEndOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const currentMonthCorrectionsCount = await AttendanceCorrection.countDocuments({
        employeeId: employee._id,
        date: { $gte: currentStartOfMonth, $lte: currentEndOfMonth },
        status: { $ne: "REJECTED" },
      });

      const monthlyQuota = {
        used: currentMonthCorrectionsCount,
        max: MONTHLY_CORRECTION_LIMIT,
        remaining: Math.max(0, MONTHLY_CORRECTION_LIMIT - currentMonthCorrectionsCount),
        monthName: now.toLocaleString("en-US", { month: "long" }),
      };

      return res.json({
        success: true,
        data: requests.map((r) => ({
          id: r._id.toString(),
          date: r.date,
          inTime: r.inTime,
          outTime: r.outTime,
          reason: r.reason,
          status: r.status,
          adminRemarks: r.adminRemarks ? r.adminRemarks.replace(/Super Admin/gi, "Admin") : "",
          createdAt: r.createdAt,
          reviewedAt: r.reviewedAt,
        })),
        monthlyQuota,
        isAttendanceApprover: delegatedAssignments.length > 0,
        delegatedReviews,
        delegatedCounts,
      });
    }
  } catch (error) {
    console.error("Get corrections error:", error);
    return res.status(500).json({ error: "Failed to fetch correction requests." });
  }
};

// PATCH /api/attendance-corrections/:id/review
// Admin or delegated approver approves or rejects attendance correction
export const reviewCorrectionRequest = async (req, res, next) => {
  try {
    const session = req.session;
    const { id } = req.params;
    const action = req.body.action || (req.body.status === "APPROVED" ? "APPROVE" : req.body.status === "REJECTED" ? "REJECT" : null);
    const remarks = req.body.remarks !== undefined ? req.body.remarks : (req.body.reviewNote || "");

    if (!action || !["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ error: "Action must be APPROVE or REJECT." });
    }

    const result = await reviewCorrectionWithTransaction(id, action, remarks, session);

    return res.json({
      success: true,
      message: action === "APPROVE"
        ? "Attendance correction approved. Employee has been marked PRESENT for this day."
        : "Attendance correction request has been rejected. Recorded as Leave Without Pay (LWP).",
      data: { correction: result },
    });
  } catch (error) {
    if (next) return next(error);
    return res.status(error.statusCode || 500).json({ error: error.message || "Failed to process correction review." });
  }
};
