import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import Holiday from "../models/Holiday.js";
import Attendance from "../models/Attendance.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payslip from "../models/Payslip.js";
import KpaEvaluation from "../models/KpaEvaluation.js";
import AdminDeduction from "../models/AdminDeduction.js";
import { getFinancialYearDates, getHolidaysForFinancialYear, getPassedMarketHolidaysCount } from "../constants/marketHolidays.js";
import { LEAVE_QUOTAS, calculateLeaveDays } from "../services/leaveService.js";

// Helper to format average check-in time
const formatAvgTime = (records) => {
    const validCheckIns = records.filter(r => r.checkIn).map(r => new Date(r.checkIn));
    if (validCheckIns.length === 0) return "09:30 AM";
    const totalMinutes = validCheckIns.reduce((sum, d) => sum + (d.getHours() * 60 + d.getMinutes()), 0);
    const avgMinutes = Math.round(totalMinutes / validCheckIns.length);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${String(displayHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
};

// Helper to determine status tier
const getTier = (score) => {
    if (score >= 95) return { label: "Exemplary", code: "EXEMPLARY", color: "emerald" };
    if (score >= 85) return { label: "Consistent & On-Track", code: "ON_TRACK", color: "indigo" };
    if (score >= 70) return { label: "Needs Calibration", code: "CALIBRATION", color: "amber" };
    return { label: "Critical SLA Risk", code: "CRITICAL", color: "rose" };
};

// GET dashboard for employee and admin
// GET /api/dashboard
export const getDashboard = async (req, res) => {
    try {
        const session = req.session;
        if (!session) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        const fy = getFinancialYearDates(today);

        if (session.role === "ADMIN") {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const employeesList = await Employee.find({ isDeleted: { $ne: true } }).select("_id firstName lastName department position").lean();
            const activeEmployeeIds = employeesList.map((e) => e._id);

            const [
                totalEmployeesCount,
                todayAttendanceCount,
                pendingLeavesCount,
                allMonthAttendance,
                allEvaluations,
                allDeductions
            ] = await Promise.all([
                employeesList.length,
                Attendance.countDocuments({
                    employeeId: { $in: activeEmployeeIds },
                    date: { $gte: todayStart, $lte: todayEnd }
                }),
                LeaveApplication.countDocuments({ status: "PENDING" }),
                Attendance.find({
                    employeeId: { $in: activeEmployeeIds },
                    date: { $gte: monthStart, $lte: monthEnd }
                }).lean(),
                KpaEvaluation.find().lean(),
                AdminDeduction.find({ status: "ACTIVE" }).lean()
            ]);

            // Calculate Employee-Based Punctuality Metrics
            const employeePunctualityList = employeesList.map(emp => {
                const empPunches = allMonthAttendance.filter(r => r.employeeId?.toString() === emp._id.toString());
                const empLate = empPunches.filter(r => r.status === "LATE" || r.isLateBuffer || r.wasLate).length;
                const empOnTime = empPunches.filter(r => r.status === "PRESENT" && !r.isLateBuffer && !r.wasLate).length;
                const empHalfDay = empPunches.filter(r => r.dayType === "Half Day").length;

                const empEval = allEvaluations.find(ev => ev.employeeId?.toString() === emp._id.toString());
                const empDeductions = allDeductions.filter(d => d.employeeId?.toString() === emp._id.toString());
                const deductionSum = empDeductions.reduce((s, d) => s + (d.deductionScore || 0), 0);

                // 60% Attendance punch score
                const punchScore = empPunches.length > 0
                    ? Math.min(100, Math.max(0, ((empOnTime * 1.0 + empLate * 0.5 + empHalfDay * 0.5) / empPunches.length) * 100))
                    : 95;

                // 40% KPA SLA score
                let kpaScore = 90;
                if (empEval) {
                    const tatRating = empEval.ratings?.find(r => 
                        r.metricId?.toLowerCase().includes("tat") || 
                        r.title?.toLowerCase().includes("tat") ||
                        r.title?.toLowerCase().includes("turnaround") ||
                        r.title?.toLowerCase().includes("speed")
                    );
                    const rawTat = tatRating ? tatRating.score : (empEval.rawWeightedScore || 4.2);
                    const netTat = Math.max(0, rawTat - deductionSum);
                    kpaScore = Math.min(100, Math.max(0, (netTat / 5.0) * 100));
                } else if (deductionSum > 0) {
                    kpaScore = Math.max(0, ((4.0 - deductionSum) / 5.0) * 100);
                }

                const compositeScore = Number((0.60 * punchScore + 0.40 * kpaScore).toFixed(1));
                const onTimeRate = empPunches.length > 0
                    ? Number(((empOnTime / empPunches.length) * 100).toFixed(1))
                    : 100;

                return {
                    id: emp._id.toString(),
                    name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
                    firstName: emp.firstName,
                    department: emp.department,
                    position: emp.position,
                    score: compositeScore,
                    onTimeRate,
                    onTimeDays: empOnTime,
                    lateDays: empLate,
                    totalPunches: empPunches.length,
                    avgCheckInTime: formatAvgTime(empPunches),
                    deductions: deductionSum,
                    tier: getTier(compositeScore)
                };
            });

            // Overall Org Average Score
            const overallScore = employeePunctualityList.length > 0
                ? Number((employeePunctualityList.reduce((s, e) => s + e.score, 0) / employeePunctualityList.length).toFixed(1))
                : 95.0;

            const totalPunches = allMonthAttendance.length;
            const totalLatePunches = allMonthAttendance.filter(r => r.status === "LATE").length;

            const totalDepartmentsCount = await Department.countDocuments();

            const passedHolidaysCount = await getPassedMarketHolidaysCount(fy);

            return res.json({
                role: "ADMIN",
                totalEmployees: totalEmployeesCount,
                totalDepartments: totalDepartmentsCount || 4,
                todayAttendance: todayAttendanceCount,
                pendingLeaves: pendingLeavesCount,
                financialYear: {
                    label: fy.label,
                    fullLabel: fy.fullLabel,
                    startYear: fy.startYear,
                    endYear: fy.endYear,
                    totalHolidays: (await Holiday.countDocuments()) || getHolidaysForFinancialYear(fy.startYear).length,
                    passedHolidays: passedHolidaysCount
                },
                punctualityMeter: {
                    overallScore,
                    totalPunches,
                    totalLatePunches,
                    avgCheckInTime: formatAvgTime(allMonthAttendance),
                    tier: getTier(overallScore),
                    employees: employeePunctualityList
                }
            });
        } else {
            // EMPLOYEE DASHBOARD
            const employee = await Employee.findOne({ userId: session.userId }).lean();
            if (!employee) {
                return res.json({
                    role: "EMPLOYEE",
                    employee: { firstName: session.email?.split("@")[0] || "Employee" },
                    currentMonthAttendance: 0,
                    pendingLeaves: 0,
                    latestPayslip: null,
                    punctualityMeter: {
                        score: 95.0,
                        onTimeRate: 100,
                        onTimeDays: 0,
                        lateDays: 0,
                        totalPunches: 0,
                        avgCheckInTime: "09:15 AM",
                        kpaTatScore: 4.5,
                        deductionsApplied: 0,
                        tier: getTier(95.0)
                    }
                });
            }

            const [
                monthAttendance,
                fyAttendance,
                pendingLeaves,
                fyApprovedLeaves,
                latestPayslip,
                latestEvaluation,
                activeDeductions
            ] = await Promise.all([
                Attendance.find({
                    employeeId: employee._id,
                    date: { $gte: monthStart, $lte: monthEnd }
                }).lean(),
                Attendance.find({
                    employeeId: employee._id,
                    date: { $gte: fy.startDate, $lte: fy.endDate }
                }).lean(),
                LeaveApplication.countDocuments({
                    employeeId: employee._id,
                    status: "PENDING",
                }),
                LeaveApplication.find({
                    employeeId: employee._id,
                    status: "APPROVED",
                    startDate: { $lte: fy.endDate },
                    endDate: { $gte: fy.startDate }
                }).lean(),
                Payslip.findOne({ employeeId: employee._id }).sort({ createdAt: -1 }).lean(),
                KpaEvaluation.findOne({ employeeId: employee._id }).sort({ createdAt: -1 }).lean(),
                AdminDeduction.find({ employeeId: employee._id, status: "ACTIVE" }).lean()
            ]);

            // Calculate FY Leave Quota & Remaining Leaves
            const passedHolidaysCount = await getPassedMarketHolidaysCount(fy);

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

            const totalConsumedLeaves = sickConsumed + casualConsumed + annualConsumed;
            const totalLeaveQuota = LEAVE_QUOTAS.SICK + LEAVE_QUOTAS.CASUAL + LEAVE_QUOTAS.ANNUAL; // 35
            const remainingLeaves = Math.max(0, totalLeaveQuota - totalConsumedLeaves);

            const leaveSummary = {
                totalQuota: totalLeaveQuota,
                consumed: totalConsumedLeaves,
                remaining: remainingLeaves,
                allLeavesConsumed: remainingLeaves <= 0,
                financialYear: fy.label,
                breakdown: {
                    casual: { consumed: casualConsumed, total: LEAVE_QUOTAS.CASUAL, remaining: Math.max(0, LEAVE_QUOTAS.CASUAL - casualConsumed) },
                    annual: { consumed: annualConsumed, total: LEAVE_QUOTAS.ANNUAL, remaining: Math.max(0, LEAVE_QUOTAS.ANNUAL - annualConsumed) },
                    sick: { consumed: sickConsumed, total: LEAVE_QUOTAS.SICK, remaining: Math.max(0, LEAVE_QUOTAS.SICK - sickConsumed) },
                }
            };

            const totalPunches = monthAttendance.length;
            const lateDays = monthAttendance.filter(r => r.status === "LATE" || r.isLateBuffer || r.wasLate).length;
            const onTimeDays = monthAttendance.filter(r => r.status === "PRESENT" && !r.isLateBuffer && !r.wasLate).length;
            const halfDays = monthAttendance.filter(r => r.dayType === "Half Day").length;

            const punchScore = totalPunches > 0
                ? Math.min(100, Math.max(0, ((onTimeDays * 1.0 + lateDays * 0.5 + halfDays * 0.5) / totalPunches) * 100))
                : 96;

            const onTimeRate = totalPunches > 0
                ? Number(((onTimeDays / totalPunches) * 100).toFixed(1))
                : 100;

            // KPA TAT rating
            let kpaTatScore = 4.5;
            if (latestEvaluation && Array.isArray(latestEvaluation.ratings) && latestEvaluation.ratings.length > 0) {
                const tatRating = latestEvaluation.ratings.find(r => 
                    r.metricId?.toLowerCase().includes("tat") || 
                    r.title?.toLowerCase().includes("tat") ||
                    r.title?.toLowerCase().includes("turnaround") ||
                    r.title?.toLowerCase().includes("speed")
                );
                if (tatRating) {
                    kpaTatScore = tatRating.score;
                } else if (latestEvaluation.rawWeightedScore) {
                    kpaTatScore = latestEvaluation.rawWeightedScore;
                }
            }

            const totalDeductions = activeDeductions.reduce((sum, d) => sum + (d.deductionScore || 0), 0);
            const netKpaScore = Math.max(0, kpaTatScore - totalDeductions);
            const kpaScorePct = Math.min(100, Math.max(0, (netKpaScore / 5.0) * 100));

            const finalPunctualityScore = Number((0.60 * punchScore + 0.40 * kpaScorePct).toFixed(1));

            const fyPresentDays = fyAttendance.filter(r => r.status === "PRESENT" || r.status === "LATE").length;
            const monthPresentDays = monthAttendance.filter(r => r.status === "PRESENT" || r.status === "LATE").length;
            const monthName = today.toLocaleString("en-US", { month: "long" });
            const monthLabel = `${monthName} ${today.getFullYear()}`;

            return res.json({
                role: "EMPLOYEE",
                employee: { ...employee, id: employee._id.toString() },
                currentMonthAttendance: monthPresentDays,
                monthAttendance: {
                    month: today.getMonth() + 1,
                    year: today.getFullYear(),
                    monthName,
                    label: monthLabel,
                    presentDays: monthPresentDays
                },
                pendingLeaves,
                remainingLeaves,
                leaveSummary,
                latestPayslip: latestPayslip ? { ...latestPayslip, id: latestPayslip._id.toString() } : null,
                financialYear: {
                    label: fy.label,
                    fullLabel: fy.fullLabel,
                    presentDays: monthPresentDays, // month basis for days present
                    fyPresentDays: fyPresentDays,
                    totalHolidays: (await Holiday.countDocuments()) || getHolidaysForFinancialYear(fy.startYear).length
                },
                punctualityMeter: {
                    score: finalPunctualityScore,
                    onTimeRate,
                    onTimeDays,
                    lateDays,
                    totalPunches,
                    avgCheckInTime: formatAvgTime(monthAttendance),
                    kpaTatScore,
                    deductionsApplied: totalDeductions,
                    tier: getTier(finalPunctualityScore)
                }
            });
        }
    } catch (error) {
        console.error("Dashboard error: ", error);
        return res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
};