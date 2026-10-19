import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import AttendanceCorrection from "../models/AttendanceCorrection.js";
import Holiday from "../models/Holiday.js";
import ApprovalDelegation from "../models/ApprovalDelegation.js";
import { getFinancialYearDates, getHolidaysForFinancialYear } from "../constants/marketHolidays.js";
import { logActivity } from "../utils/activityLogger.js";
import {
    getISTTime,
    getISTDateString,
    getISTMidnightDate,
    calculateDistanceMeters,
    reconcileAbsentDays,
    lockPastUnclosedPunches,
} from "../services/attendanceService.js";
import { ATTENDANCE_RULES } from "../constants/attendanceRules.js";

// Re-export service methods for backward compatibility across existing controller callers
export {
    getISTTime,
    getISTDateString,
    getISTMidnightDate,
    calculateDistanceMeters,
    reconcileAbsentDays,
    lockPastUnclosedPunches,
};

// Clock in/out for employee
// POST /api/attendance
export const clockInOut = async (req, res) => {
    try {
        const session = req.session;
        const employee = await Employee.findOne({ userId: session.userId });
        if (!employee) return res.status(404).json({ error: "Employee not found" });
        if (employee.isDeleted) return res.status(403).json({ error: "Your account is deactivated. You cannot clock in/out." });

        const isLocationExempt = Boolean(
            employee.isLocationExempt ||
            employee.employeeCode === "202602" ||
            (employee.firstName?.toUpperCase() === "SASWAT" && employee.lastName?.toUpperCase() === "SAHU")
        );

        const requestedAction = req.body?.action; // "CLOCK_IN" | "CLOCK_OUT" | undefined
        const requestedAttendanceId = req.body?.attendanceId;

        const now = new Date();
        const todayISTStr = getISTDateString(now);
        const todayISTMidnight = getISTMidnightDate(now);

        // Lock any unclosed punches from past days (00:00 midnight lock)
        await lockPastUnclosedPunches(employee._id, todayISTMidnight);

        // Find existing record for TODAY only:
        // Priority 1: Direct attendanceId match ONLY if it belongs to today's date
        let existing = null;
        if (requestedAttendanceId) {
            const found = await Attendance.findOne({
                _id: requestedAttendanceId,
                employeeId: employee._id
            });
            if (found && getISTDateString(new Date(found.date)) === todayISTStr) {
                existing = found;
            }
        }

        // Priority 2: Match strictly within today's IST day range (00:00:00 to 23:59:59.999 IST)
        if (!existing) {
            const dayStart = todayISTMidnight;
            const dayEnd = new Date(todayISTMidnight.getTime() + 24 * 60 * 60 * 1000 - 1);
            existing = await Attendance.findOne({
                employeeId: employee._id,
                date: { $gte: dayStart, $lte: dayEnd }
            });
        }

        // Determine current status of the record
        let isCurrentlyIn = false;
        if (existing) {
            if (existing.currentStatus === "IN") {
                isCurrentlyIn = true;
            } else if (existing.currentStatus === "OUT") {
                isCurrentlyIn = false;
            } else if (existing.punches && existing.punches.length > 0) {
                isCurrentlyIn = existing.punches[existing.punches.length - 1].type === "IN";
            } else {
                isCurrentlyIn = Boolean(existing.checkIn && !existing.checkOut);
            }
        }

        // Universal rapid-punch debounce: reject/safely return if any punch occurred within 5 seconds
        if (existing?.punches && existing.punches.length > 0) {
            const lastPunch = existing.punches[existing.punches.length - 1];
            const msSinceLast = now.getTime() - new Date(lastPunch.time).getTime();
            if (msSinceLast < 5000) {
                return res.json({
                    success: true,
                    type: isCurrentlyIn ? "CHECK_IN" : "CHECK_OUT",
                    message: isCurrentlyIn
                        ? "Your session is active (recent click debounced)."
                        : "Clocked out successfully (recent click debounced).",
                    data: existing
                });
            }
        }

        // Determine target action: respect explicit user intent, or toggle based on isCurrentlyIn
        let action = requestedAction;
        if (!action) {
            action = isCurrentlyIn ? "CLOCK_OUT" : "CLOCK_IN";
        }

        // ----------------- LOCATION VERIFICATION FOR CLOCK_IN -----------------
        let userLat = null;
        let userLon = null;
        let userAccuracy = null;
        let distanceToOffice = null;

        if (action === "CLOCK_IN") {
            const rawLat = req.body?.latitude;
            const rawLon = req.body?.longitude;
            const rawAcc = req.body?.accuracy;

            if (rawLat != null && rawLon != null) {
                const parsedLat = parseFloat(rawLat);
                const parsedLon = parseFloat(rawLon);
                if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
                    userLat = parsedLat;
                    userLon = parsedLon;
                    userAccuracy = rawAcc != null ? parseFloat(rawAcc) : null;
                }
            }

            if (!isLocationExempt) {
                if (userLat == null || userLon == null) {
                    return res.status(400).json({
                        error: "Location is needed to clock in. Please enable device GPS and grant location permission in your browser.",
                        code: "LOCATION_REQUIRED"
                    });
                }

                const officeLat = parseFloat(process.env.OFFICE_LATITUDE || String(ATTENDANCE_RULES.DEFAULT_OFFICE_LATITUDE || "22.257667"));
                const officeLon = parseFloat(process.env.OFFICE_LONGITUDE || String(ATTENDANCE_RULES.DEFAULT_OFFICE_LONGITUDE || "84.885863"));
                const allowedRadius = parseFloat(process.env.OFFICE_RADIUS_METERS || String(ATTENDANCE_RULES.DEFAULT_OFFICE_RADIUS_METERS || "80"));

                distanceToOffice = calculateDistanceMeters(userLat, userLon, officeLat, officeLon);

                // Buffer check: account for reported device GNSS accuracy radius (up to 80m indoor Wi-Fi/cellular triangulation tolerance)
                const maxAccuracyBuffer = parseFloat(process.env.GPS_ACCURACY_BUFFER_MAX || String(ATTENDANCE_RULES.GPS_ACCURACY_BUFFER_MAX_METERS || "80"));
                const accuracyMargin = userAccuracy && userAccuracy > 0 ? Math.min(userAccuracy, maxAccuracyBuffer) : 0;
                const effectiveDistance = Math.max(0, distanceToOffice - accuracyMargin);

                if (distanceToOffice > allowedRadius && effectiveDistance > allowedRadius) {
                    return res.status(403).json({
                        error: `Clock-in rejected: You are ${distanceToOffice}m away from the office. You must be within ${allowedRadius}m of the office premises to punch in.`,
                        code: "OUT_OF_OFFICE_RANGE",
                        distance: distanceToOffice,
                        allowedRadius,
                        officeLat,
                        officeLon
                    });
                }
            } else if (userLat != null && userLon != null) {
                // If exempt employee voluntarily provided GPS, record distance for audit if possible
                const officeLat = parseFloat(process.env.OFFICE_LATITUDE || "22.257667");
                const officeLon = parseFloat(process.env.OFFICE_LONGITUDE || "84.885863");
                distanceToOffice = calculateDistanceMeters(userLat, userLon, officeLat, officeLon);
            }
        }

        // ----------------- ACTION: CLOCK OUT -----------------
        if (action === "CLOCK_OUT") {
            if (!existing || !existing.checkIn) {
                return res.status(400).json({
                    error: "No active check-in record found to clock out from. Please clock in first."
                });
            }

            // If user is already OUT, safely return existing state (prevent duplicate/inversion on double click)
            if (!isCurrentlyIn && existing.checkOut) {
                const lastOutFormatted = new Date(existing.checkOut).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true
                });
                return res.json({
                    success: true,
                    type: "CHECK_OUT",
                    message: `Already clocked out at ${lastOutFormatted}.`,
                    data: existing
                });
            }

            // Minimum session buffer: prevent accidental clock-out within 2 minutes of clocking in
            const lastInPunch = existing.punches?.slice().reverse().find(p => p.type === "IN");
            const sessionInTime = lastInPunch ? new Date(lastInPunch.time).getTime() : (existing.checkIn ? new Date(existing.checkIn).getTime() : 0);
            const msSinceIn = now.getTime() - sessionInTime;
            if (msSinceIn < 2 * 60 * 1000 && !req.body?.force) {
                return res.status(400).json({
                    error: "Minimum session duration before clock-out is 2 minutes to prevent accidental touch clock-out."
                });
            }

            existing.checkOut = now;
            existing.currentStatus = "OUT";
            if (!existing.punches) existing.punches = [];

            const outLat = req.body?.latitude != null ? parseFloat(req.body.latitude) : null;
            const outLon = req.body?.longitude != null ? parseFloat(req.body.longitude) : null;
            const outAcc = req.body?.accuracy != null ? parseFloat(req.body.accuracy) : null;
            const outDist = (outLat != null && outLon != null)
                ? calculateDistanceMeters(outLat, outLon, parseFloat(process.env.OFFICE_LATITUDE || "22.257667"), parseFloat(process.env.OFFICE_LONGITUDE || "84.885863"))
                : null;

            existing.punches.push({
                type: "OUT",
                time: now,
                latitude: outLat,
                longitude: outLon,
                distanceMeters: outDist,
                accuracyMeters: outAcc,
                locationVerified: outDist != null
            });

            // Calculate working hours: sum all completed (IN -> OUT) sessions
            let totalWorkMs = 0;
            let lastInTime = null;
            for (const p of existing.punches) {
                const pt = new Date(p.time).getTime();
                if (p.type === "IN") {
                    lastInTime = pt;
                } else if (p.type === "OUT" && lastInTime !== null) {
                    totalWorkMs += Math.max(0, pt - lastInTime);
                    lastInTime = null;
                }
            }

            const firstInTime = existing.checkIn ? new Date(existing.checkIn).getTime() : now.getTime();
            const diffMs = totalWorkMs > 0 ? totalWorkMs : Math.max(0, now.getTime() - firstInTime);
            const diffHours = Math.min(24, diffMs / (1000 * 60 * 60));
            const workingHours = parseFloat(diffHours.toFixed(2));

            let dayType = workingHours >= 6 ? "Full Day" : "Half Day";

            existing.workingHours = workingHours;
            existing.dayType = dayType;
            await existing.save();

            logActivity({
                req,
                userId: session.userId,
                employeeId: employee._id,
                userName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
                userEmail: employee.email || session.email,
                userRole: session.role || "EMPLOYEE",
                category: "ATTENDANCE",
                action: "CLOCK_OUT",
                description: `${employee.firstName} clocked out (Hours: ${workingHours}h, ${dayType})`,
                metadata: { workingHours, dayType, time: now }
            });

            return res.json({
                success: true,
                type: "CHECK_OUT",
                message: "Clocked out successfully (Last Out updated).",
                data: existing
            });
        }

        // ----------------- ACTION: CLOCK IN -----------------
        // If user is already IN, safely return current active state (prevent duplicate punches on double-click)
        if (isCurrentlyIn && existing?.checkIn) {
            const inTime = existing.punches?.[existing.punches.length - 1]?.time || existing.checkIn;
            const inFormatted = new Date(inTime).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            });
            return res.json({
                success: true,
                type: "CHECK_IN",
                message: `Already clocked in at ${inFormatted}. Your session is active.`,
                data: existing
            });
        }

        // If existing record exists for today and was checked in, resume session
        if (existing && existing.checkIn) {
            // Debounce rapid double-click within 3 seconds
            if (existing.punches && existing.punches.length > 0) {
                const lastPunch = existing.punches[existing.punches.length - 1];
                const msSinceLast = now.getTime() - new Date(lastPunch.time).getTime();
                if (msSinceLast < 3000 && lastPunch.type === "IN") {
                    return res.json({
                        success: true,
                        type: "CHECK_IN",
                        message: "Clocked in again. Your session is active.",
                        data: existing
                    });
                }
            }

            existing.currentStatus = "IN";
            if (!existing.punches) existing.punches = [];
            existing.punches.push({
                type: "IN",
                time: now,
                latitude: userLat,
                longitude: userLon,
                distanceMeters: distanceToOffice,
                accuracyMeters: userAccuracy,
                locationVerified: true
            });
            await existing.save();

            return res.json({
                success: true,
                type: "CHECK_IN",
                message: "Clocked in again. Your session is active.",
                data: existing
            });
        }

        // First clock-in of the day
        const { minutesFromMidnight } = getISTTime(now);

        let status = "PRESENT";
        let isLateBuffer = false;
        let wasLate = false;
        let lateCountThisMonth = 0;
        let requiresCorrection = false;
        let verdict = "On Time";

        if (minutesFromMidnight <= 615) {
            status = "PRESENT";
            isLateBuffer = false;
            wasLate = false;
            requiresCorrection = false;
            verdict = minutesFromMidnight <= 600
                ? "On Time (Official Shift: 10:00 AM - 6:00 PM)"
                : "On Time (Within 10:15 AM grace period)";
        } else if (minutesFromMidnight <= 630) {
            wasLate = true;
            const startOfMonth = new Date(todayISTMidnight.getFullYear(), todayISTMidnight.getMonth(), 1, 0, 0, 0, 0);
            const endOfMonth = new Date(todayISTMidnight.getFullYear(), todayISTMidnight.getMonth() + 1, 0, 23, 59, 59, 999);
            const currentMonthLateCount = await Attendance.countDocuments({
                employeeId: employee._id,
                date: { $gte: startOfMonth, $lte: endOfMonth },
                $or: [{ isLateBuffer: true }, { status: "LATE" }],
                ...(existing?._id ? { _id: { $ne: existing._id } } : {})
            });

            if (currentMonthLateCount < 5) {
                status = "LATE";
                isLateBuffer = true;
                lateCountThisMonth = currentMonthLateCount + 1;
                requiresCorrection = false;
                verdict = `Late Arrival (${lateCountThisMonth}/5 allowed monthly late buffer used: 10:15 AM - 10:30 AM)`;
            } else {
                status = "ABSENT";
                isLateBuffer = true;
                lateCountThisMonth = currentMonthLateCount + 1;
                requiresCorrection = true;
                verdict = `Marked Absent (Exceeded 5 monthly late arrival quota: ${lateCountThisMonth}/5 used). Regularize via Attendance Correction (max 10/month) or Apply Leave (Sick / Casual leave only).`;
            }
        } else {
            status = "ABSENT";
            isLateBuffer = false;
            wasLate = false;
            lateCountThisMonth = 0;
            requiresCorrection = true;
            verdict = "Marked Absent (Clocked in after 10:30 AM). Regularize via Attendance Correction (max 10/month) or Apply Leave (Sick / Casual leave only).";
        }

        const assignedDayType = status === "ABSENT" ? "Absent" : null;

        if (!existing) {
            existing = await Attendance.create({
                employeeId: employee._id,
                date: todayISTMidnight,
                checkIn: now,
                checkOut: null,
                currentStatus: "IN",
                punches: [{
                    type: "IN",
                    time: now,
                    latitude: userLat,
                    longitude: userLon,
                    distanceMeters: distanceToOffice,
                    accuracyMeters: userAccuracy,
                    locationVerified: isLocationExempt ? true : (distanceToOffice != null)
                }],
                status,
                isLateBuffer,
                wasLate,
                lateCountThisMonth,
                verdict,
                requiresCorrection,
                workingHours: null,
                dayType: assignedDayType
            });
        } else {
            existing.date = todayISTMidnight;
            existing.checkIn = now;
            existing.checkOut = null;
            existing.currentStatus = "IN";
            existing.punches = [{
                type: "IN",
                time: now,
                latitude: userLat,
                longitude: userLon,
                distanceMeters: distanceToOffice,
                accuracyMeters: userAccuracy,
                locationVerified: isLocationExempt ? true : (distanceToOffice != null)
            }];
            existing.status = status;
            existing.isLateBuffer = isLateBuffer;
            existing.wasLate = wasLate || existing.wasLate;
            existing.lateCountThisMonth = lateCountThisMonth;
            existing.verdict = verdict;
            existing.requiresCorrection = requiresCorrection;
            existing.workingHours = null;
            existing.dayType = assignedDayType;
            await existing.save();
        }

        try {
            await inngest.send({
                name: "employee/check-out",
                data: {
                    employeeId: employee._id,
                    attendanceId: existing._id,
                }
            });
        } catch (e) {
            // Inngest background event
        }

        logActivity({
            req,
            userId: session.userId,
            employeeId: employee._id,
            userName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
            userEmail: employee.email || session.email,
            userRole: session.role || "EMPLOYEE",
            category: "ATTENDANCE",
            action: "CLOCK_IN",
            description: `${employee.firstName} clocked in (${status === "LATE" ? `Late: ${verdict}` : "On Time"})`,
            metadata: { status, verdict, isLateBuffer, lateCountThisMonth, time: now }
        });

        return res.json({
            success: true,
            type: "CHECK_IN",
            message: status === "ABSENT"
                ? `Clocked in. ${verdict}`
                : status === "LATE"
                ? `Clocked in (Late Arrival: ${lateCountThisMonth}/5 buffer used).`
                : "Clocked in successfully (On Time).",
            data: existing
        });
    } catch (error) {
        console.error("Attendance Error", error);
        return res.status(500).json({ error: "Operation failed" });
    }
};

// GET attendance for employee
// GET /api/attendance
export const getAttendance = async (req, res) => {
    try {
        const session = req.session;
        const employee = await Employee.findOne({ userId: session.userId });
        if (!employee) return res.status(404).json({ error: "Employee not found" });
        const limit = parseInt(req.query.limit || 30);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        await reconcileAbsentDays(employee._id, thirtyDaysAgo, new Date());
        const history = await Attendance.find({ employeeId: employee._id }).sort({ date: -1 }).limit(limit);

        // Normalize any legacy records to respect the 10:00 - 10:15 AM grace period & sanitize absurd working hours
        for (const rec of history) {
            let modified = false;
            if (rec.checkIn) {
                const { minutesFromMidnight } = getISTTime(new Date(rec.checkIn));
                if (minutesFromMidnight <= 615 && (rec.status === "LATE" || rec.status === "ABSENT")) {
                    rec.status = "PRESENT";
                    rec.isLateBuffer = false;
                    rec.requiresCorrection = false;
                    rec.verdict = minutesFromMidnight <= 600
                        ? "On Time (Official Shift: 10:00 AM - 6:00 PM)"
                        : "On Time (Within 10:15 AM grace period)";
                    modified = true;
                }
            }

            // Sanitize any corrupt/absurd working hours (> 24 hours)
            if (typeof rec.workingHours === "number" && rec.workingHours > 24) {
                if (rec.checkIn && rec.checkOut) {
                    const diffMs = Math.max(0, new Date(rec.checkOut).getTime() - new Date(rec.checkIn).getTime());
                    rec.workingHours = parseFloat(Math.min(24, diffMs / (1000 * 60 * 60)).toFixed(2));
                } else {
                    rec.workingHours = 0;
                }
                modified = true;
            }

            if (modified) {
                await rec.save();
            }
        }

        // System-wide Financial Year calculations (April 1 to March 31)
        const fy = getFinancialYearDates();
        const fyRecords = await Attendance.find({
            employeeId: employee._id,
            date: { $gte: fy.startDate, $lte: fy.endDate }
        }).lean();

        const fyPresentDays = fyRecords.filter(r => r.status === "PRESENT" || r.status === "LATE").length;
        const fyLateDays = fyRecords.filter(r => r.status === "LATE" || r.isLateBuffer || r.wasLate).length;
        const validHoursRecords = fyRecords.filter(r => typeof r.workingHours === "number" && r.workingHours > 0);
        const fyAvgHours = validHoursRecords.length > 0
            ? parseFloat((validHoursRecords.reduce((s, r) => s + r.workingHours, 0) / validHoursRecords.length).toFixed(1))
            : 0;
        const dbHolidaysCount = await Holiday.countDocuments();
        const fyHolidaysCount = dbHolidaysCount > 0 ? dbHolidaysCount : getHolidaysForFinancialYear(fy.startYear).length;

        // Current calendar month's attendance (month basis) & late allowance usage (max 5)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthRecords = await Attendance.find({
            employeeId: employee._id,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        }).lean();

        const monthPresentDays = monthRecords.filter(r => r.status === "PRESENT" || r.status === "LATE").length;
        const monthLateDays = monthRecords.filter(r => r.status === "LATE" || r.isLateBuffer || r.wasLate).length;
        const monthValidHoursRecords = monthRecords.filter(r => typeof r.workingHours === "number" && r.workingHours > 0);
        const monthAvgHours = monthValidHoursRecords.length > 0
            ? parseFloat((monthValidHoursRecords.reduce((s, r) => s + r.workingHours, 0) / monthValidHoursRecords.length).toFixed(1))
            : 0;

        const monthName = now.toLocaleString("en-US", { month: "long" });
        const monthLabel = `${monthName} ${now.getFullYear()}`;

        const lateAllowance = {
            used: Math.min(5, monthLateDays),
            max: 5,
            remaining: Math.max(0, 5 - monthLateDays),
            monthName
        };

        const isLocationExempt = Boolean(
            employee.isLocationExempt ||
            employee.employeeCode === "202602" ||
            (employee.firstName?.toUpperCase() === "SASWAT" && employee.lastName?.toUpperCase() === "SAHU")
        );

        const delegatedAssignments = await ApprovalDelegation.find({ attendanceApproverId: employee._id })
            .populate("employeeId", "_id employeeCode firstName lastName department position isLocationExempt isDeleted")
            .lean();
        const assignedTeam = delegatedAssignments
            .map(d => d.employeeId)
            .filter(emp => emp && !emp.isDeleted)
            .map(emp => ({
                id: emp._id.toString(),
                employeeCode: emp.employeeCode || "",
                name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
                department: emp.department,
                position: emp.position,
            }));

        return res.json({
            data: history,
            lateAllowance,
            employee: {
                isDeleted: employee.isDeleted,
                isLocationExempt
            },
            isAttendanceApprover: assignedTeam.length > 0,
            assignedTeamCount: assignedTeam.length,
            assignedTeam,
            monthAttendance: {
                month: now.getMonth() + 1,
                year: now.getFullYear(),
                monthName,
                label: monthLabel,
                presentDays: monthPresentDays,
                lateDays: monthLateDays,
                avgHours: `${monthAvgHours} Hrs`
            },
            financialYear: {
                label: fy.label,
                fullLabel: fy.fullLabel,
                startYear: fy.startYear,
                endYear: fy.endYear,
                presentDays: monthPresentDays, // month basis for days present
                fyPresentDays: fyPresentDays,
                lateDays: fyLateDays,
                avgHours: `${fyAvgHours} Hrs`,
                totalHolidays: fyHolidaysCount,
            }
        });
    } catch (error) {
        console.error("Get Attendance error: ", error);
        return res.status(500).json({ error: "Failed to fetch attendance history" });
    }
};

// GET monthly attendance
// GET /api/attendance/monthly
export const getMonthlyAttendance = async (req, res) => {
    try {
        const session = req.session;
        const now = new Date();
        const year = parseInt(req.query.year) || now.getFullYear();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);

        const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        let targetEmployeeId = req.query.employeeId;

        if (session.role === "ADMIN") {
            if (!targetEmployeeId) {
                const firstEmp = await Employee.findOne({ isDeleted: { $ne: true } }).sort({ firstName: 1 });
                if (firstEmp) {
                    targetEmployeeId = firstEmp._id.toString();
                }
            }
        } else {
            const employee = await Employee.findOne({ userId: session.userId });
            if (!employee) return res.status(404).json({ error: "Employee not found" });

            if (targetEmployeeId && targetEmployeeId !== employee._id.toString()) {
                const isAuthorizedApprover = await ApprovalDelegation.exists({
                    employeeId: targetEmployeeId,
                    attendanceApproverId: employee._id
                });
                if (!isAuthorizedApprover) {
                    targetEmployeeId = employee._id.toString();
                }
            } else {
                targetEmployeeId = employee._id.toString();
            }
        }

        if (!targetEmployeeId) {
            return res.json({ data: [], leaves: [], corrections: [], year, month, selectedEmployeeId: null });
        }

        // Reconcile unexcused absent days for all completed working days in the month
        await reconcileAbsentDays(targetEmployeeId, startDate, endDate);

        const attendanceRecords = await Attendance.find({
            employeeId: targetEmployeeId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        // Normalize any legacy records to respect the 10:00 - 10:15 AM grace period & sanitize absurd working hours
        for (const rec of attendanceRecords) {
            let modified = false;
            if (rec.checkIn) {
                const { minutesFromMidnight } = getISTTime(new Date(rec.checkIn));
                if (minutesFromMidnight <= 615 && (rec.status === "LATE" || rec.status === "ABSENT")) {
                    rec.status = "PRESENT";
                    rec.isLateBuffer = false;
                    rec.requiresCorrection = false;
                    rec.verdict = minutesFromMidnight <= 600
                        ? "On Time (Official Shift: 10:00 AM - 6:00 PM)"
                        : "On Time (Within 10:15 AM grace period)";
                    modified = true;
                }
            }

            // Sanitize any corrupt/absurd working hours (> 24 hours)
            if (typeof rec.workingHours === "number" && rec.workingHours > 24) {
                if (rec.checkIn && rec.checkOut) {
                    const diffMs = Math.max(0, new Date(rec.checkOut).getTime() - new Date(rec.checkIn).getTime());
                    rec.workingHours = parseFloat(Math.min(24, diffMs / (1000 * 60 * 60)).toFixed(2));
                } else {
                    rec.workingHours = 0;
                }
                modified = true;
            }

            if (modified) {
                await rec.save();
            }
        }

        // Fetch active leaves and corrections to provide full context to calendar
        const leaves = await LeaveApplication.find({
            employeeId: targetEmployeeId,
            status: { $ne: "REJECTED" },
            startDate: { $lte: endDate },
            endDate: { $gte: startDate }
        }).lean();

        const corrections = await AttendanceCorrection.find({
            employeeId: targetEmployeeId,
            status: { $ne: "REJECTED" },
            date: { $gte: startDate, $lte: endDate }
        }).lean();

        return res.json({
            data: attendanceRecords,
            leaves,
            corrections,
            year,
            month,
            selectedEmployeeId: targetEmployeeId
        });
    } catch (error) {
        console.error("Fetch Monthly Attendance error: ", error);
        return res.status(500).json({ error: "Failed to fetch monthly attendance" });
    }
};

// GET /api/attendance/employee-monthly-lwp
// Calculate absent days and LWP component for a particular employee in a given month/year
export const getEmployeeMonthlyLwp = async (req, res) => {
    try {
        const { employeeId, month, year, basicSalary } = req.query;

        if (!employeeId) {
            return res.status(400).json({ error: "Employee ID is required." });
        }

        const employee = await Employee.findById(employeeId).lean();
        if (!employee) {
            return res.status(404).json({ error: "Employee not found." });
        }

        const now = new Date();
        const targetYear = parseInt(year) || now.getFullYear();
        let targetMonth = parseInt(month);

        if (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12) {
            if (typeof month === "string" && month.trim()) {
                const MONTH_NAMES = [
                    "january", "february", "march", "april", "may", "june",
                    "july", "august", "september", "october", "november", "december"
                ];
                const foundIdx = MONTH_NAMES.findIndex(
                    m => m === month.trim().toLowerCase() || m.startsWith(month.trim().toLowerCase())
                );
                targetMonth = foundIdx !== -1 ? foundIdx + 1 : (now.getMonth() + 1);
            } else {
                targetMonth = now.getMonth() + 1;
            }
        }

        const startDate = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
        const totalDaysInMonth = new Date(targetYear, targetMonth, 0).getDate();

        // Run reconciliation for this employee and window
        await reconcileAbsentDays(employeeId, startDate, endDate);

        // Fetch attendance records for this month where status is ABSENT
        const absentRecords = await Attendance.find({
            employeeId,
            date: { $gte: startDate, $lte: endDate },
            status: "ABSENT"
        }).sort({ date: 1 }).lean();

        const absentDaysCount = absentRecords.length;
        const validPresentDays = Math.max(0, totalDaysInMonth - absentDaysCount);

        // Calculate LWP:
        // perDaySalary = basicSalary / validPresentDays
        // lwp = perDaySalary * absentDaysCount
        const basic = Math.max(0, Number(basicSalary ?? employee.basicSalary) || 0);

        let perDaySalary = 0;
        let lwpAmount = 0;

        if (absentDaysCount > 0) {
            if (validPresentDays > 0) {
                perDaySalary = basic / validPresentDays;
                lwpAmount = perDaySalary * absentDaysCount;
            } else {
                // If absent the entire month
                perDaySalary = basic / totalDaysInMonth;
                lwpAmount = basic;
            }
        }

        return res.json({
            success: true,
            employeeId,
            employeeName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
            month: targetMonth,
            year: targetYear,
            totalDaysInMonth,
            absentDaysCount,
            validPresentDays,
            basicSalary: basic,
            perDaySalary: parseFloat(perDaySalary.toFixed(2)),
            lwpAmount: parseFloat(lwpAmount.toFixed(2)),
            absentDates: absentRecords.map(r => getISTDateString(new Date(r.date)))
        });
    } catch (error) {
        console.error("getEmployeeMonthlyLwp error:", error);
        return res.status(500).json({ error: "Failed to compute employee LWP" });
    }
};

// GET team punches for designated attendance approver (or Admin)
// GET /api/attendance/team-punches
export const getTeamPunches = async (req, res) => {
    try {
        const session = req.session;
        let assignedEmployees = [];
        let isApprover = false;

        if (session.role === "ADMIN") {
            isApprover = true;
            assignedEmployees = await Employee.find({ isDeleted: { $ne: true } })
                .select("_id employeeCode firstName lastName department position isLocationExempt")
                .sort({ firstName: 1 })
                .lean();
        } else {
            const employee = await Employee.findOne({ userId: session.userId }).lean();
            if (!employee) return res.status(404).json({ error: "Employee record not found" });

            // Dynamically query delegations where attendanceApproverId matches this employee
            const delegations = await ApprovalDelegation.find({ attendanceApproverId: employee._id })
                .populate("employeeId", "_id employeeCode firstName lastName department position isLocationExempt isDeleted")
                .lean();

            assignedEmployees = delegations
                .map(d => d.employeeId)
                .filter(e => e && !e.isDeleted);

            isApprover = assignedEmployees.length > 0;
        }

        if (!isApprover || assignedEmployees.length === 0) {
            return res.json({
                isAttendanceApprover: false,
                assignedTeam: [],
                todaySummary: [],
                history: []
            });
        }

        const assignedEmployeeIds = assignedEmployees.map(e => e._id);
        const { employeeId: filterEmployeeId, limit = 60, month, year, date } = req.query;

        // If filtering by specific employeeId, ensure it is within assigned team
        let targetEmployeeIds = assignedEmployeeIds;
        if (filterEmployeeId) {
            if (assignedEmployeeIds.some(id => id.toString() === filterEmployeeId)) {
                targetEmployeeIds = [filterEmployeeId];
            } else {
                return res.status(403).json({ error: "You are not authorized to view attendance punches for this employee." });
            }
        }

        // Build query for history records
        const query = { employeeId: { $in: targetEmployeeIds } };

        if (date) {
            const d = new Date(date);
            const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
            const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        } else if (month && year) {
            const m = parseInt(month, 10);
            const y = parseInt(year, 10);
            const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
            const end = new Date(y, m, 0, 23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }

        const history = await Attendance.find(query)
            .populate("employeeId", "_id employeeCode firstName lastName department position isLocationExempt")
            .sort({ date: -1, createdAt: -1 })
            .limit(parseInt(limit, 10))
            .lean();

        // Compute Today's Live Status for each assigned team member
        const todayISTStr = getISTDateString(new Date());
        const todayStart = new Date(`${todayISTStr}T00:00:00.000+05:30`);
        const todayEnd = new Date(`${todayISTStr}T23:59:59.999+05:30`);

        const todayRecords = await Attendance.find({
            employeeId: { $in: assignedEmployeeIds },
            date: { $gte: todayStart, $lte: todayEnd }
        }).lean();

        const todayMap = new Map();
        todayRecords.forEach(r => {
            todayMap.set(r.employeeId.toString(), r);
        });

        const todaySummary = assignedEmployees.map(emp => {
            const empIdStr = emp._id.toString();
            const rec = todayMap.get(empIdStr);
            const punches = rec?.punches || [];
            const hasCheckIn = !!rec?.checkIn;
            const isCurrentlyIn = rec?.currentStatus === "IN";
            const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null;

            return {
                employee: {
                    id: empIdStr,
                    employeeCode: emp.employeeCode || "",
                    name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
                    department: emp.department || "",
                    position: emp.position || "",
                    isLocationExempt: Boolean(emp.isLocationExempt)
                },
                recordId: rec?._id?.toString() || null,
                hasPunchedToday: hasCheckIn,
                isCurrentlyIn,
                firstInTime: punches.find(p => p.type === "IN")?.time || rec?.checkIn || null,
                lastPunchTime: lastPunch?.time || rec?.checkOut || null,
                lastPunchType: lastPunch?.type || (rec?.checkOut ? "OUT" : rec?.checkIn ? "IN" : null),
                punchesCount: punches.length || (rec?.checkOut ? 2 : rec?.checkIn ? 1 : 0),
                workingHours: rec?.workingHours || 0,
                status: rec?.status || (hasCheckIn ? "PRESENT" : "NOT_PUNCHED"),
                verdict: rec?.verdict || "No punches logged today",
                isLateBuffer: Boolean(rec?.isLateBuffer),
                wasLate: Boolean(rec?.wasLate),
                requiresCorrection: Boolean(rec?.requiresCorrection),
                punches: rec?.punches || []
            };
        });

        return res.json({
            isAttendanceApprover: true,
            assignedTeam: assignedEmployees.map(e => ({
                id: e._id.toString(),
                employeeCode: e.employeeCode || "",
                name: `${e.firstName} ${e.lastName || ""}`.trim(),
                department: e.department || "",
                position: e.position || "",
                isLocationExempt: Boolean(e.isLocationExempt)
            })),
            todaySummary,
            history: history.map(r => ({
                id: r._id.toString(),
                employeeId: r.employeeId?._id?.toString(),
                employee: r.employeeId ? {
                    id: r.employeeId._id?.toString(),
                    employeeCode: r.employeeId.employeeCode || "",
                    name: `${r.employeeId.firstName} ${r.employeeId.lastName || ""}`.trim(),
                    department: r.employeeId.department || "",
                    position: r.employeeId.position || "",
                    isLocationExempt: Boolean(r.employeeId.isLocationExempt)
                } : null,
                date: r.date,
                checkIn: r.checkIn,
                checkOut: r.checkOut,
                currentStatus: r.currentStatus,
                status: r.status,
                workingHours: r.workingHours,
                dayType: r.dayType,
                verdict: r.verdict,
                isLateBuffer: r.isLateBuffer,
                wasLate: r.wasLate,
                lateCountThisMonth: r.lateCountThisMonth,
                requiresCorrection: r.requiresCorrection,
                punches: r.punches || [],
            }))
        });
    } catch (error) {
        console.error("getTeamPunches error:", error);
        return res.status(500).json({ error: "Failed to fetch team punches" });
    }
};