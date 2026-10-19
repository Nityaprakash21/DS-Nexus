import { inngest } from "../ingest/index.js";
import Employee from "../models/Employee.js"
import LeaveApplication from "../models/LeaveApplication.js"
import Attendance from "../models/Attendance.js";
import ApprovalDelegation from "../models/ApprovalDelegation.js";
import { getFinancialYearDates, getPassedMarketHolidaysCount } from "../constants/marketHolidays.js";
import { logActivity } from "../utils/activityLogger.js";
import {
    LEAVE_QUOTAS,
    calculateLeaveDays,
    reviewLeaveWithTransaction,
} from "../services/leaveService.js";
import { reconcileAbsentDays } from "../services/attendanceService.js";

export { LEAVE_QUOTAS, calculateLeaveDays };

// Create Leave
// POST /api/leaves
export const createLeave = async (req, res) => {
    try {
        const session = req.session;
        const employee = await Employee.findOne({ userId: session.userId })
        if (!employee) return res.status(404).json({ error: "Employee not found" });
        if (employee.isDeleted) {
            return res.status(403).json({ error: "Your account is deactivated. You cannot apply for leave." })
        }
        const { type, startDate, endDate, reason, isRegularization } = req.body;
        if (!type || !startDate || !endDate || !reason) {
            return res.status(400).json({ error: "Missing fields" });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isPastOrToday = new Date(startDate) <= today || new Date(endDate) <= today;
        const isAbsentRegularization = Boolean(isRegularization || isPastOrToday);

        if (type === "ANNUAL") {
            return res.status(400).json({
                error: "Annual leave cannot be applied by employees. Only Sick and Casual leaves are available to apply."
            });
        }

        if (type !== "SICK" && type !== "CASUAL") {
            return res.status(400).json({ error: "Invalid leave type. Allowed: SICK, CASUAL" });
        }

        if (isAbsentRegularization) {
            // Absent day regularization is strictly restricted to SICK and CASUAL leaves only
            if (type !== "SICK" && type !== "CASUAL") {
                return res.status(400).json({
                    error: "Only Sick Leave (cap: 5) or Casual Leave (cap: 10) can be applied for absent day regularization. Annual Leave is strictly prohibited."
                });
            }
        } else {
            if (new Date(startDate) <= today || new Date(endDate) <= today) {
                return res.status(400).json({ error: "Leave dates must be in the future" });
            }
        }
        if (new Date(endDate) < new Date(startDate)) {
            return res.status(400).json({ error: "End Date cannot be before start date" });
        }

        const maxQuota = LEAVE_QUOTAS[type];
        if (!maxQuota) {
            return res.status(400).json({ error: "Invalid leave type. Allowed: SICK, CASUAL" });
        }

        const requestedDays = calculateLeaveDays(startDate, endDate);
        const fy = getFinancialYearDates(new Date(startDate));

        // Check existing approved/pending leaves for this employee in the FY across all types
        const allFyCommittedLeaves = await LeaveApplication.find({
            employeeId: employee._id,
            status: { $in: ["APPROVED", "PENDING"] },
            startDate: { $lte: fy.endDate },
            endDate: { $gte: fy.startDate }
        });

        const passedHolidays = await getPassedMarketHolidaysCount(fy);

        const sickCommitted = allFyCommittedLeaves
            .filter(l => l.type === "SICK")
            .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);
        const casualCommitted = allFyCommittedLeaves
            .filter(l => l.type === "CASUAL")
            .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);
        const annualCommitted = passedHolidays + allFyCommittedLeaves
            .filter(l => l.type === "ANNUAL")
            .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);

        const sickRemaining = Math.max(0, LEAVE_QUOTAS.SICK - sickCommitted);
        const casualRemaining = Math.max(0, LEAVE_QUOTAS.CASUAL - casualCommitted);
        const applicableRemaining = sickRemaining + casualRemaining;

        // Block applying if all valid leaves of the FY have already been consumed
        if (applicableRemaining <= 0) {
            return res.status(400).json({
                error: `All Sick and Casual leaves have been consumed already for ${fy.label}. You cannot apply for any more leaves in this financial year.`
            });
        }

        // Check specific quota for the requested leave type
        const typeCommitted = type === "SICK" ? sickCommitted : type === "CASUAL" ? casualCommitted : annualCommitted;
        if (typeCommitted + requestedDays > maxQuota) {
            const availableRemaining = Math.max(0, maxQuota - typeCommitted);
            return res.status(400).json({
                error: `Cannot apply for ${requestedDays} day(s) of ${type.toLowerCase()} leave. You only have ${availableRemaining} day(s) remaining out of your ${maxQuota} days annual quota for ${fy.label}.`
            });
        }

        const leave = await LeaveApplication.create({
            employeeId: employee._id,
            type,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            status: "PENDING",
        });

        if (isAbsentRegularization) {
            const startD = new Date(startDate);
            startD.setHours(0, 0, 0, 0);
            const endD = new Date(endDate);
            endD.setHours(23, 59, 59, 999);

            await Attendance.updateMany(
                {
                    employeeId: employee._id,
                    date: { $gte: startD, $lte: endD },
                    status: "ABSENT"
                },
                {
                    $set: {
                        requiresCorrection: false,
                        verdict: `Leave Application Pending (${type === "SICK" ? "Sick" : "Casual"} Leave) - Awaiting Manager/Admin Approval`
                    }
                }
            );
        }

        try {
            await inngest.send({
                name: "leave/reminder",
                data: { leaveApplicationId: leave._id }
            });
        } catch (e) {
            // Background event
        }

        logActivity({
            req,
            userId: session.userId,
            employeeId: employee._id,
            userName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
            userEmail: employee.email || session.email,
            userRole: "EMPLOYEE",
            category: "LEAVE",
            action: "LEAVE_APPLIED",
            description: `${employee.firstName} applied for ${type} leave (${requestedDays} days: ${startDate} to ${endDate})`,
            metadata: { type, startDate, endDate, requestedDays, reason }
        });

        return res.json({ success: true, data: leave });
    } catch (error) {
        return res.status(500).json({ error: "Failed to apply for leave" });
    }
}

// GET leaves
// Get /api/leaves
export const getLeaves = async (req, res) => {
    try {
        const session = req.session;
        const isAdmin = session.role === "ADMIN";
        const fy = getFinancialYearDates();
        const passedHolidaysCount = await getPassedMarketHolidaysCount(fy);

        if (isAdmin) {
            const status = req.query.status;
            const where = status ? { status } : {};
            const leaves = await LeaveApplication.find(where).populate("employeeId").sort({ createdAt: -1 });
            const data = leaves.map((l) => {
                const obj = l.toObject();
                return {
                    ...obj,
                    id: obj._id.toString(),
                    days: calculateLeaveDays(obj.startDate, obj.endDate),
                    employee: obj.employeeId,
                    employeeId: obj.employeeId?._id?.toString(),
                }
            });

            const annualConsumed = Math.min(LEAVE_QUOTAS.ANNUAL, passedHolidaysCount);
            const annualRemaining = Math.max(0, LEAVE_QUOTAS.ANNUAL - annualConsumed);
            const totalQuota = LEAVE_QUOTAS.SICK + LEAVE_QUOTAS.CASUAL + LEAVE_QUOTAS.ANNUAL;
            const totalConsumed = annualConsumed;
            const totalRemaining = LEAVE_QUOTAS.SICK + LEAVE_QUOTAS.CASUAL + annualRemaining;

            const leaveQuotas = {
                financialYear: fy.label,
                fullLabel: fy.fullLabel,
                totalQuota,
                totalConsumed,
                totalPending: 0,
                totalRemaining,
                allLeavesConsumed: false,
                SICK: {
                    consumed: 0,
                    pending: 0,
                    total: LEAVE_QUOTAS.SICK,
                    remaining: LEAVE_QUOTAS.SICK
                },
                CASUAL: {
                    consumed: 0,
                    pending: 0,
                    total: LEAVE_QUOTAS.CASUAL,
                    remaining: LEAVE_QUOTAS.CASUAL
                },
                ANNUAL: {
                    consumed: annualConsumed,
                    pending: 0,
                    total: LEAVE_QUOTAS.ANNUAL,
                    remaining: annualRemaining
                }
            };

            return res.json({ data, financialYear: fy.label, leaveQuotas });
        } else {
            const employee = await Employee.findOne({ userId: session.userId }).lean();
            if (!employee) return res.status(404).json({ error: "Not found" });
            const leaves = await LeaveApplication.find({ employeeId: employee._id }).sort({ createdAt: -1 });

            // Calculate consumed days in current FY from approved leaves
            const fyApprovedLeaves = leaves.filter(l => {
                if (l.status !== "APPROVED") return false;
                const start = new Date(l.startDate);
                const end = new Date(l.endDate);
                return start <= fy.endDate && end >= fy.startDate;
            });

            // Calculate pending days in current FY
            const fyPendingLeaves = leaves.filter(l => {
                if (l.status !== "PENDING") return false;
                const start = new Date(l.startDate);
                const end = new Date(l.endDate);
                return start <= fy.endDate && end >= fy.startDate;
            });

            const sickConsumed = fyApprovedLeaves
                .filter(l => l.type === "SICK")
                .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);

            const casualConsumed = fyApprovedLeaves
                .filter(l => l.type === "CASUAL")
                .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);

            const approvedAnnualDays = fyApprovedLeaves
                .filter(l => l.type === "ANNUAL")
                .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);

            const annualConsumed = Math.min(LEAVE_QUOTAS.ANNUAL, passedHolidaysCount + approvedAnnualDays);

            const sickPending = fyPendingLeaves
                .filter(l => l.type === "SICK")
                .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);

            const casualPending = fyPendingLeaves
                .filter(l => l.type === "CASUAL")
                .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);

            const annualPending = fyPendingLeaves
                .filter(l => l.type === "ANNUAL")
                .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);

            const sickRemaining = Math.max(0, LEAVE_QUOTAS.SICK - sickConsumed - sickPending);
            const casualRemaining = Math.max(0, LEAVE_QUOTAS.CASUAL - casualConsumed - casualPending);
            const annualRemaining = Math.max(0, LEAVE_QUOTAS.ANNUAL - annualConsumed - annualPending);

            const totalQuota = LEAVE_QUOTAS.SICK + LEAVE_QUOTAS.CASUAL + LEAVE_QUOTAS.ANNUAL;
            const totalConsumed = sickConsumed + casualConsumed + annualConsumed;
            const totalPending = sickPending + casualPending + annualPending;
            const totalRemaining = sickRemaining + casualRemaining + annualRemaining;
            const applicableRemaining = sickRemaining + casualRemaining;
            const allLeavesConsumed = applicableRemaining <= 0;

            const leaveQuotas = {
                financialYear: fy.label,
                fullLabel: fy.fullLabel,
                totalQuota,
                totalConsumed,
                totalPending,
                totalRemaining,
                applicableRemaining,
                allLeavesConsumed,
                SICK: {
                    consumed: sickConsumed,
                    pending: sickPending,
                    total: LEAVE_QUOTAS.SICK,
                    remaining: sickRemaining
                },
                CASUAL: {
                    consumed: casualConsumed,
                    pending: casualPending,
                    total: LEAVE_QUOTAS.CASUAL,
                    remaining: casualRemaining
                },
                ANNUAL: {
                    consumed: annualConsumed,
                    pending: annualPending,
                    total: LEAVE_QUOTAS.ANNUAL,
                    remaining: annualRemaining
                }
            };

            const data = leaves.map((l) => {
                const obj = l.toObject ? l.toObject() : l;
                return {
                    ...obj,
                    days: calculateLeaveDays(obj.startDate, obj.endDate),
                };
            });

            // Check if this employee is the designated leave approver for any team members
            const delegatedAssignments = await ApprovalDelegation.find({ leaveApproverId: employee._id })
                .select("employeeId")
                .lean();

            let delegatedLeaves = [];
            if (delegatedAssignments.length > 0) {
                const targetIds = delegatedAssignments.map(a => a.employeeId);
                const teamLeaves = await LeaveApplication.find({ employeeId: { $in: targetIds } })
                    .populate("employeeId", "_id employeeCode firstName lastName department position")
                    .sort({ createdAt: -1 })
                    .lean();

                delegatedLeaves = teamLeaves.map((l) => ({
                    ...l,
                    id: l._id.toString(),
                    days: calculateLeaveDays(l.startDate, l.endDate),
                    employee: l.employeeId,
                }));
            }

            return res.json({
                data,
                leaveQuotas,
                employee: { ...employee, id: employee._id.toString() },
                isLeaveApprover: delegatedAssignments.length > 0,
                assignedTeamCount: delegatedAssignments.length,
                delegatedLeaves,
            });
        }
    } catch (error) {
        return res.status(500).json({ error: "Failed to fetch leaves" });
    }
}

// Update leave status
// PATCH /api/leaves/:id
export const updateLeaveStatus = async (req, res, next) => {
    try {
        const session = req.session;
        const { status, rejectionReason } = req.body;
        if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) {
            return res.status(400).json({ error: "Invalid Status" });
        }

        const leave = await reviewLeaveWithTransaction(req.params.id, status, session, rejectionReason);

        logActivity({
            req,
            userId: session.userId,
            userRole: session.role,
            category: "LEAVE",
            action: `LEAVE_${status}`,
            description: `${session.role === "ADMIN" ? "Admin" : "Designated Approver"} marked leave application as ${status}`,
            metadata: { leaveId: leave._id, status, employeeId: leave.employeeId }
        });

        return res.json({ success: true, data: leave });
    } catch (error) {
        if (next) return next(error);
        return res.status(error.statusCode || 500).json({ error: error.message || "Failed to update leave status" });
    }
};

// Update / Rectify Leave Application (e.g. if employee applied by mistake in wrong leave)
// PUT /api/leave/:id
export const updateLeave = async (req, res, next) => {
    try {
        const session = req.session;
        const { id } = req.params;
        const leave = await LeaveApplication.findById(id);
        if (!leave) {
            return res.status(404).json({ error: "Leave application not found" });
        }

        // Authorization check: Only Admin or the employee who owns the leave application can edit
        let employee = null;
        if (session.role !== "ADMIN") {
            employee = await Employee.findOne({ userId: session.userId });
            if (!employee || !leave.employeeId.equals(employee._id)) {
                return res.status(403).json({ error: "You can only edit your own leave applications." });
            }
            if (employee.isDeleted) {
                return res.status(403).json({ error: "Your account is deactivated. You cannot modify leaves." });
            }
        } else {
            employee = await Employee.findById(leave.employeeId);
        }

        const { type, startDate, endDate, reason } = req.body;
        if (!type || !startDate || !endDate || !reason) {
            return res.status(400).json({ error: "Type, Start Date, End Date, and Reason are required." });
        }

        if (type !== "SICK" && type !== "CASUAL") {
            return res.status(400).json({ error: "Invalid leave type. Only Sick and Casual leaves can be applied or edited." });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) {
            return res.status(400).json({ error: "End Date cannot be before Start Date." });
        }

        const requestedDays = calculateLeaveDays(startDate, endDate);
        const maxQuota = LEAVE_QUOTAS[type];
        const fy = getFinancialYearDates(start);

        // Calculate consumed leaves in FY excluding the current leave record being edited
        const otherFyCommittedLeaves = await LeaveApplication.find({
            employeeId: leave.employeeId,
            _id: { $ne: leave._id },
            status: { $in: ["APPROVED", "PENDING"] },
            startDate: { $lte: fy.endDate },
            endDate: { $gte: fy.startDate }
        });

        const typeCommitted = otherFyCommittedLeaves
            .filter(l => l.type === type)
            .reduce((sum, l) => sum + calculateLeaveDays(l.startDate, l.endDate), 0);

        if (typeCommitted + requestedDays > maxQuota) {
            const availableRemaining = Math.max(0, maxQuota - typeCommitted);
            return res.status(400).json({
                error: `Cannot rectify to ${requestedDays} day(s) of ${type.toLowerCase()} leave. You only have ${availableRemaining} day(s) remaining out of your ${maxQuota} days annual quota for ${fy.label}.`
            });
        }

        const oldType = leave.type;
        const oldStart = new Date(leave.startDate);
        const oldEnd = new Date(leave.endDate);

        leave.type = type;
        leave.startDate = start;
        leave.endDate = end;
        leave.reason = reason.trim();
        await leave.save();

        // If the leave was approved, update associated attendance records to reflect the new leave type
        if (leave.status === "APPROVED") {
            const newStartD = new Date(start);
            newStartD.setHours(0, 0, 0, 0);
            const newEndD = new Date(end);
            newEndD.setHours(23, 59, 59, 999);

            const attendanceRecords = await Attendance.find({
                employeeId: leave.employeeId,
                date: { $gte: newStartD, $lte: newEndD }
            });

            for (const att of attendanceRecords) {
                const hasPunches = Boolean(att.checkIn || (att.punches && att.punches.length > 0));
                if (hasPunches) {
                    att.status = "PRESENT";
                    const isLateBuf = Boolean(att.isLateBuffer || att.wasLate);
                    att.verdict = `Regularized via Approved ${type === "SICK" ? "Sick" : "Casual"} Leave${isLateBuf ? " (Late Arrival Recorded)" : ""}`;
                    await att.save();
                }
            }

            // If dates shifted, reconcile attendance for both old and new date spans
            if (oldStart.getTime() !== start.getTime() || oldEnd.getTime() !== end.getTime()) {
                await reconcileAbsentDays(leave.employeeId, oldStart, oldEnd);
                await reconcileAbsentDays(leave.employeeId, start, end);
            }
        }

        logActivity({
            req,
            userId: session.userId,
            userRole: session.role,
            category: "LEAVE",
            action: "LEAVE_RECTIFIED",
            description: `${session.role === "ADMIN" ? "Admin" : "Employee"} rectified leave application (${oldType} -> ${type})`,
            metadata: { leaveId: leave._id, employeeId: leave.employeeId, oldType, newType: type, requestedDays }
        });

        return res.json({
            success: true,
            message: "Leave application rectified successfully!",
            data: leave
        });
    } catch (error) {
        if (next) return next(error);
        return res.status(error.statusCode || 500).json({ error: error.message || "Failed to update leave application" });
    }
};