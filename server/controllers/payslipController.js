import Employee from "../models/Employee.js";
import Payslip from "../models/Payslip.js";
import Incentive from "../models/Incentive.js";
import Attendance from "../models/Attendance.js";
import { logActivity } from "../utils/activityLogger.js";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// Create payslip
// POST /api/payslips
export const createPayslip = async (req, res) => {
    try {
        const {
            employeeId,
            month,
            year,
            basicSalary,
            incentive,
            allowances,
            bonus,
            customEarnings,
            lwp,
            tax,
            adjustments,
            customDeductions,
            isLwpModified,
            overrideDeductions,
            isIncentiveModified,
            overrideEarnings
        } = req.body;

        if (!employeeId || !month || !year) {
            return res.status(400).json({ error: "Employee, month, and year are required" });
        }

        let monthNum = Number(month);
        let mName = "";
        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            const foundIndex = MONTH_NAMES.findIndex(m => m.toLowerCase() === String(month).toLowerCase());
            if (foundIndex !== -1) {
                monthNum = foundIndex + 1;
                mName = MONTH_NAMES[foundIndex];
            } else {
                monthNum = new Date().getMonth() + 1;
                mName = MONTH_NAMES[monthNum - 1];
            }
        } else {
            mName = MONTH_NAMES[monthNum - 1];
        }

        // Earnings Calculation
        const basicVal = Math.max(0, Number(basicSalary) || 0);
        const hasExplicitIncentive = incentive !== undefined && incentive !== null && incentive !== "";
        const isIncentiveOverridden = isIncentiveModified === true || (overrideEarnings === true && isIncentiveModified !== false);
        let incentiveVal = hasExplicitIncentive ? Math.max(0, Number(incentive) || 0) : 0;

        // If Super Admin did NOT manually manipulate/override incentive, auto-fetch from Incentive module if 0
        if (!isIncentiveOverridden && incentiveVal === 0 && employeeId) {
            try {
                const targetMonthName = MONTH_NAMES[monthNum - 1];
                const targetShort = targetMonthName ? targetMonthName.slice(0, 3) : "";
                const targetYear2Digits = String(year).slice(-2);

                const empObj = await Employee.findById(employeeId).lean();
                const query = {
                    $or: [{ employeeId: employeeId }]
                };
                if (empObj?.firstName) {
                    query.$or.push({
                        $and: [
                            { employeeName: { $regex: new RegExp(`^${empObj.firstName.trim()}`, "i") } },
                            { employeeId: null }
                        ]
                    });
                }

                const incRecords = await Incentive.find(query).lean();
                const matched = incRecords.filter(r => {
                    const rMonth = (r.month || "").toUpperCase();
                    const hasMonth = rMonth.includes(targetMonthName.toUpperCase()) || (targetShort && rMonth.includes(targetShort.toUpperCase()));
                    if (!hasMonth) return false;
                    const ym = rMonth.match(/\b(20\d{2}|\d{2})\b/);
                    if (ym) {
                        return ym[1].length === 4 ? Number(ym[1]) === Number(year) : ym[1] === targetYear2Digits;
                    }
                    if (r.disbursementDate) {
                        return new Date(r.disbursementDate).getFullYear() === Number(year);
                    }
                    return true;
                });

                const autoSum = matched.reduce((sum, r) => sum + (Number(r.incentiveAmount) || 0), 0);
                if (autoSum > 0) {
                    incentiveVal = parseFloat(autoSum.toFixed(2));
                }
            } catch (err) {
                console.error("Auto-fetch incentive in createPayslip error:", err);
            }
        }

        const allowancesVal = Math.max(0, Number(allowances) || 0);
        const bonusVal = Math.max(0, Number(bonus) || 0);

        let parsedCustomEarnings = [];
        if (Array.isArray(customEarnings)) {
            parsedCustomEarnings = customEarnings
                .map(item => ({
                    name: String(item.name || "").trim(),
                    amount: Math.max(0, Number(item.amount) || 0)
                }))
                .filter(item => item.name && item.amount > 0);
        } else if (typeof customEarnings === "string" && customEarnings.trim()) {
            try {
                parsedCustomEarnings = JSON.parse(customEarnings);
            } catch (e) {}
        }

        const customEarningsTotal = parsedCustomEarnings.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        const totalEarnings = basicVal + incentiveVal + allowancesVal + bonusVal + customEarningsTotal;

        // Deductions Calculation:
        // If Super Admin manually manipulated/overrode deductions, take their exact values (even 0) as final!
        const hasExplicitLwp = lwp !== undefined && lwp !== null && lwp !== "";
        const isLwpOverridden = isLwpModified === true || (overrideDeductions === true && isLwpModified !== false);
        let lwpVal = hasExplicitLwp ? Math.max(0, Number(lwp) || 0) : 0;

        // Auto-calculate LWP from Attendance records ONLY IF Super Admin did NOT manually manipulate/override LWP
        if (!isLwpOverridden && employeeId && basicVal > 0) {
            // Only auto-compute if LWP was not explicitly provided or is 0 without override
            if (!hasExplicitLwp || lwpVal === 0) {
                try {
                    const targetYear = Number(year);
                    const targetMonth = monthNum;
                    const startDate = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
                    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
                    const totalDaysInMonth = new Date(targetYear, targetMonth, 0).getDate();

                    const absentRecords = await Attendance.find({
                        employeeId,
                        date: { $gte: startDate, $lte: endDate },
                        status: "ABSENT"
                    }).lean();

                    const absentDaysCount = absentRecords.length;
                    const validPresentDays = Math.max(0, totalDaysInMonth - absentDaysCount);

                    if (absentDaysCount > 0) {
                        if (validPresentDays > 0) {
                            const perDay = basicVal / validPresentDays;
                            lwpVal = parseFloat((perDay * absentDaysCount).toFixed(2));
                        } else {
                            lwpVal = basicVal;
                        }
                    }
                } catch (err) {
                    console.error("Auto-compute LWP in createPayslip error:", err);
                }
            }
        }

        const taxVal = Math.max(0, Number(tax) || 0);
        const adjustmentsVal = Math.max(0, Number(adjustments) || 0);

        let parsedCustomDeductions = [];
        if (Array.isArray(customDeductions)) {
            parsedCustomDeductions = customDeductions
                .map(item => ({
                    name: String(item.name || "").trim(),
                    amount: Math.max(0, Number(item.amount) || 0)
                }))
                .filter(item => item.name && item.amount > 0);
        } else if (typeof customDeductions === "string" && customDeductions.trim()) {
            try {
                parsedCustomDeductions = JSON.parse(customDeductions);
            } catch (e) {}
        }

        const customDeductionsTotal = parsedCustomDeductions.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        const totalDeductions = lwpVal + taxVal + adjustmentsVal + customDeductionsTotal;

        // Net Pay = Total Earnings - Total Deductions
        const netSalary = Math.max(0, totalEarnings - totalDeductions);

        const payslip = await Payslip.create({
            employeeId,
            month: monthNum,
            monthName: mName,
            year: Number(year),
            basicSalary: basicVal,
            allowances: (incentiveVal + allowancesVal + bonusVal + customEarningsTotal),
            deductions: totalDeductions,
            netSalary,
            earnings: {
                basicSalary: basicVal,
                incentive: incentiveVal,
                allowances: allowancesVal,
                bonus: bonusVal,
                custom: parsedCustomEarnings,
                total: totalEarnings
            },
            deductionsDetail: {
                lwp: lwpVal,
                tax: taxVal,
                adjustments: adjustmentsVal,
                custom: parsedCustomDeductions,
                total: totalDeductions
            },
            createdBy: req.session?.userId || req.user?.id || null
        });

        // Activity log
        const emp = await Employee.findById(employeeId);
        const empName = emp ? `${emp.firstName} ${emp.lastName || ""}`.trim() : "Employee";
        logActivity({
            req,
            userId: req.session?.userId,
            employeeId,
            userName: req.session?.email || "Admin",
            userRole: "ADMIN",
            category: "PAYSLIPS",
            action: "PAYSLIP_GENERATED",
            description: `Admin generated payslip for ${empName} (${mName} ${year}: Net Pay ₹${netSalary.toLocaleString("en-IN")})`,
            metadata: {
                payslipId: payslip._id,
                totalEarnings,
                totalDeductions,
                netSalary
            }
        });

        res.status(201).json({ success: true, data: payslip });
    } catch (error) {
        console.error("Create payslip error:", error);
        res.status(500).json({ error: error.message || "Failed to generate payslip" });
    }
};

// GET payslips
// GET /api/payslips
export const getPayslips = async (req, res) => {
    try {
        const session = req.session;
        const isAdmin = session.role === "ADMIN";
        if (isAdmin) {
            const payslips = await Payslip.find().populate("employeeId").sort({ createdAt: -1 });
            const data = payslips.map((p) => {
                const obj = p.toObject();
                return {
                    ...obj,
                    id: obj._id.toString(),
                    employee: obj.employeeId,
                    employeeId: obj.employeeId?._id?.toString(),
                }
            })
            return res.json({ data });
        } else {
            const employee = await Employee.findOne({ userId: session.userId });
            if (!employee) return res.status(404).json({ error: "Not found" });
            const payslips = await Payslip.find({ employeeId: employee._id }).sort({ createdAt: -1 });
            return res.json({ data: payslips });
        }
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
}

// GET payslip by ID
// GET /api/payslips/:id
export const getPayslipById = async (req, res) => {
    try {
        const payslip = await Payslip.findById(req.params.id).populate("employeeId").lean();
        if (!payslip) return res.status(404).json({ error: "Not Found" });
        const result = {
            ...payslip,
            id: payslip._id.toString(),
            employee: payslip.employeeId,
        }
        return res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
}

// DELETE payslip (Super Admin Only)
// DELETE /api/payslips/:id
export const deletePayslip = async (req, res) => {
    try {
        const { id } = req.params;
        const payslip = await Payslip.findById(id).populate("employeeId");
        if (!payslip) {
            return res.status(404).json({ error: "Payslip not found" });
        }

        const empName = payslip.employeeId ? `${payslip.employeeId.firstName || ""} ${payslip.employeeId.lastName || ""}`.trim() : "Employee";
        const monthName = payslip.monthName || MONTH_NAMES[(payslip.month || 1) - 1] || "";
        const year = payslip.year || "";
        const netSalary = payslip.netSalary || 0;

        await Payslip.findByIdAndDelete(id);

        // Activity log
        logActivity({
            req,
            userId: req.session?.userId,
            employeeId: payslip.employeeId?._id,
            userName: req.session?.email || "Admin",
            userRole: "ADMIN",
            category: "PAYSLIPS",
            action: "PAYSLIP_DELETED",
            description: `Super Admin deleted payslip for ${empName} (${monthName} ${year}: Net Pay ₹${netSalary.toLocaleString("en-IN")})`,
            metadata: {
                payslipId: id,
                employeeName: empName,
                month: monthName,
                year,
                netSalary
            }
        });

        return res.json({ success: true, message: "Payslip deleted successfully" });
    } catch (error) {
        console.error("Delete payslip error:", error);
        return res.status(500).json({ error: error.message || "Failed to delete payslip" });
    }
};

