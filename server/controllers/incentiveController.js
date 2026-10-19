import Incentive from "../models/Incentive.js";
import Employee from "../models/Employee.js";
import { logActivity } from "../utils/activityLogger.js";
import { calculateIncentiveMetrics, aggregateIncentiveStats } from "../services/incentiveService.js";

// GET /api/incentives
// Fetch all incentive entries with optional search and filters
export const getIncentives = async (req, res) => {
  try {
    const { search, month, product, employeeId } = req.query;

    const filter = {};

    if (employeeId) {
      filter.employeeId = employeeId;
    }

    if (month && month !== "ALL") {
      filter.month = month;
    }

    if (product && product !== "ALL") {
      filter.product = product;
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { employeeName: { $regex: q, $options: "i" } },
        { product: { $regex: q, $options: "i" } },
        { month: { $regex: q, $options: "i" } },
        { remarks: { $regex: q, $options: "i" } },
      ];
    }

    const rawIncentives = await Incentive.find(filter)
      .sort({ disbursementDate: 1, createdAt: 1 })
      .populate("employeeId", "firstName lastName employeeCode department")
      .lean();

    // Map backwards-compatible fields
    const incentives = rawIncentives.map((item) => {
      const transPerMonth = item.transactionPerMonth !== undefined && item.transactionPerMonth !== null
        ? Number(item.transactionPerMonth)
        : Number(item.totalIncome || 0);
      const projYearly = item.projectedIncomeYearly !== undefined && item.projectedIncomeYearly !== null
        ? Number(item.projectedIncomeYearly)
        : transPerMonth * 12;
      const actualYearly = item.actualIncomeYearly !== undefined && item.actualIncomeYearly !== null
        ? Number(item.actualIncomeYearly)
        : projYearly;
      const commPct = item.commissionPercentage !== undefined && item.commissionPercentage !== null
        ? Number(item.commissionPercentage)
        : 0;

      return {
        ...item,
        transactionPerMonth: transPerMonth,
        totalIncome: transPerMonth,
        projectedIncomeYearly: projYearly,
        actualIncomeYearly: actualYearly,
        commissionPercentage: commPct,
      };
    });

    res.json({
      success: true,
      count: incentives.length,
      data: incentives,
    });
  } catch (error) {
    console.error("getIncentives error:", error);
    res.status(500).json({ error: "Failed to fetch incentive records." });
  }
};

// GET /api/incentives/stats
// Aggregated statistics for KPI cards
export const getIncentiveStats = async (req, res) => {
  try {
    const incentives = await Incentive.find({}).lean();
    const stats = aggregateIncentiveStats(incentives);

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("getIncentiveStats error:", error);
    return res.status(500).json({ error: "Failed to calculate incentive stats." });
  }
};

// POST /api/incentives
// Create new incentive record
export const createIncentive = async (req, res) => {
  try {
    const {
      employeeId,
      employeeName,
      month,
      product,
      transactionPerMonth,
      totalIncome,
      projectedIncomeYearly,
      actualIncomeYearly,
      commissionPercentage,
      incentiveAmount,
      disbursementDate,
      remarks,
    } = req.body;

    if (!employeeName || !employeeName.trim()) {
      return res.status(400).json({ error: "Employee Name is required." });
    }

    if (!month || !month.trim()) {
      return res.status(400).json({ error: "Month is required." });
    }

    // Resolve transaction per month
    const rawTrans = transactionPerMonth !== undefined ? transactionPerMonth : totalIncome;
    if (rawTrans === undefined || isNaN(Number(rawTrans)) || Number(rawTrans) < 0) {
      return res.status(400).json({ error: "Valid Transaction per Month is required." });
    }
    const metrics = calculateIncentiveMetrics({
      transactionPerMonth: rawTrans,
      totalIncome: rawTrans,
      projectedIncomeYearly,
      actualIncomeYearly,
      commissionPercentage,
      incentiveAmount,
    });

    if (!disbursementDate) {
      return res.status(400).json({ error: "Disbursement Date is required." });
    }

    // Try linking employeeId if not provided directly
    let linkedEmpId = employeeId || null;
    if (employeeId) {
      const emp = await Employee.findById(employeeId);
      if (emp?.isDeleted) {
        return res.status(400).json({ error: "Cannot assign incentive to a deactivated employee." });
      }
    }
    if (!linkedEmpId && employeeName && employeeName.trim()) {
      const trimmedName = employeeName.trim();
      const parts = trimmedName.split(/\s+/);
      const firstNamePart = parts[0];
      const lastNamePart = parts.length > 1 ? parts.slice(1).join(" ") : "";

      const query = {
        $or: [
          { firstName: { $regex: new RegExp(`^${trimmedName}$`, "i") } },
          { lastName: { $regex: new RegExp(`^${trimmedName}$`, "i") } },
        ],
      };

      if (firstNamePart) {
        query.$or.push({ firstName: { $regex: new RegExp(`^${firstNamePart}$`, "i") } });
      }
      if (lastNamePart) {
        query.$or.push({ lastName: { $regex: new RegExp(`^${lastNamePart}$`, "i") } });
      }

      const matchedEmp = await Employee.findOne(query);
      if (matchedEmp) {
        linkedEmpId = matchedEmp._id;
      }
    }

    const newIncentive = await Incentive.create({
      employeeId: linkedEmpId,
      employeeName: employeeName.trim().toUpperCase(),
      month: month.trim(),
      product: (product || "Mutual Funds").trim(),
      transactionPerMonth: metrics.transactionPerMonth,
      totalIncome: metrics.totalIncome,
      projectedIncomeYearly: metrics.projectedIncomeYearly,
      actualIncomeYearly: metrics.actualIncomeYearly,
      commissionPercentage: metrics.commissionPercentage,
      incentiveAmount: metrics.incentiveAmount,
      disbursementDate: new Date(disbursementDate),
      remarks: (remarks || "").trim(),
      createdBy: req.session?.userId || null,
    });

    logActivity({
      req,
      userId: req.session?.userId,
      userEmail: req.session?.email,
      userRole: req.session?.role || "ADMIN",
      category: "INCENTIVES",
      action: "INCENTIVE_CREATED",
      description: `Admin created incentive entry for ${newIncentive.employeeName} (${newIncentive.product} - ${newIncentive.month}: ₹${newIncentive.incentiveAmount})`,
      metadata: {
        incentiveId: newIncentive._id,
        employeeName: newIncentive.employeeName,
        product: newIncentive.product,
        month: newIncentive.month,
        transactionPerMonth: newIncentive.transactionPerMonth,
        projectedIncomeYearly: newIncentive.projectedIncomeYearly,
        actualIncomeYearly: newIncentive.actualIncomeYearly,
        commissionPercentage: newIncentive.commissionPercentage,
        amount: newIncentive.incentiveAmount,
      },
    });

    res.status(201).json({
      success: true,
      message: "Incentive record created successfully.",
      data: newIncentive,
    });
  } catch (error) {
    console.error("createIncentive error:", error);
    res.status(500).json({ error: "Failed to create incentive record." });
  }
};

// PUT /api/incentives/:id
// Update an existing incentive record
export const updateIncentive = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employeeId,
      employeeName,
      month,
      product,
      transactionPerMonth,
      totalIncome,
      projectedIncomeYearly,
      actualIncomeYearly,
      commissionPercentage,
      incentiveAmount,
      disbursementDate,
      remarks,
    } = req.body;

    const existing = await Incentive.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Incentive record not found." });
    }

    if (employeeName) existing.employeeName = employeeName.trim().toUpperCase();
    if (employeeId !== undefined) existing.employeeId = employeeId;
    if (month) existing.month = month.trim();
    if (product) existing.product = product.trim();

    if (transactionPerMonth !== undefined && !isNaN(Number(transactionPerMonth))) {
      const val = parseFloat(Number(transactionPerMonth).toFixed(2));
      existing.transactionPerMonth = val;
      existing.totalIncome = val;
    } else if (totalIncome !== undefined && !isNaN(Number(totalIncome))) {
      const val = parseFloat(Number(totalIncome).toFixed(2));
      existing.transactionPerMonth = val;
      existing.totalIncome = val;
    }

    if (projectedIncomeYearly !== undefined && !isNaN(Number(projectedIncomeYearly))) {
      existing.projectedIncomeYearly = parseFloat(Number(projectedIncomeYearly).toFixed(2));
    }
    if (actualIncomeYearly !== undefined && !isNaN(Number(actualIncomeYearly))) {
      existing.actualIncomeYearly = parseFloat(Number(actualIncomeYearly).toFixed(2));
    }
    if (commissionPercentage !== undefined && !isNaN(Number(commissionPercentage))) {
      existing.commissionPercentage = parseFloat(Number(commissionPercentage).toFixed(2));
    }
    if (incentiveAmount !== undefined && !isNaN(Number(incentiveAmount))) {
      existing.incentiveAmount = parseFloat(Number(incentiveAmount).toFixed(2));
    }
    if (disbursementDate) existing.disbursementDate = new Date(disbursementDate);
    if (remarks !== undefined) existing.remarks = remarks.trim();

    await existing.save();

    logActivity({
      req,
      userId: req.session?.userId,
      userEmail: req.session?.email,
      userRole: req.session?.role || "ADMIN",
      category: "INCENTIVES",
      action: "INCENTIVE_UPDATED",
      description: `Admin updated incentive record for ${existing.employeeName} (${existing.product} - ${existing.month})`,
      metadata: {
        incentiveId: existing._id,
        employeeName: existing.employeeName,
        product: existing.product,
        amount: existing.incentiveAmount,
      },
    });

    res.json({
      success: true,
      message: "Incentive record updated successfully.",
      data: existing,
    });
  } catch (error) {
    console.error("updateIncentive error:", error);
    res.status(500).json({ error: "Failed to update incentive record." });
  }
};

// DELETE /api/incentives/:id
// Delete an incentive record
export const deleteIncentive = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Incentive.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Incentive record not found." });
    }

    logActivity({
      req,
      userId: req.session?.userId,
      userEmail: req.session?.email,
      userRole: req.session?.role || "ADMIN",
      category: "INCENTIVES",
      action: "INCENTIVE_DELETED",
      description: `Admin deleted incentive record for ${deleted.employeeName} (${deleted.month})`,
      metadata: { incentiveId: deleted._id, employeeName: deleted.employeeName },
    });

    res.json({
      success: true,
      message: "Incentive record deleted successfully.",
      data: deleted,
    });
  } catch (error) {
    console.error("deleteIncentive error:", error);
    res.status(500).json({ error: "Failed to delete incentive record." });
  }
};

// GET /api/incentives/employee-monthly-incentive
// Fetch total incentive for a specific employee and month/year for Payslip auto-population
export const getEmployeeMonthlyIncentive = async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;

    if (!employeeId) {
      return res.status(400).json({ error: "Employee ID is required." });
    }

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) {
      return res.status(404).json({ error: "Employee not found." });
    }

    const MONTH_NAMES = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    let targetMonthIndex = -1;
    const numMonth = Number(month);
    if (!isNaN(numMonth) && numMonth >= 1 && numMonth <= 12) {
      targetMonthIndex = numMonth - 1;
    } else if (typeof month === "string" && month.trim()) {
      targetMonthIndex = MONTH_NAMES.findIndex(
        (m) => m.toLowerCase() === month.trim().toLowerCase()
      );
      if (targetMonthIndex === -1) {
        targetMonthIndex = MONTH_NAMES.findIndex(
          (m) => m.toLowerCase().startsWith(month.trim().toLowerCase())
        );
      }
    }

    const targetMonthName = targetMonthIndex !== -1 ? MONTH_NAMES[targetMonthIndex] : "";
    const targetMonthShort = targetMonthName ? targetMonthName.slice(0, 3) : "";

    const targetYear = year ? Number(year) : new Date().getFullYear();
    const targetYear2Digits = String(targetYear).slice(-2);

    // Query for incentive entries linked to this employee
    const query = {
      $or: [
        { employeeId: employee._id },
        {
          $and: [
            {
              $or: [
                { employeeName: { $regex: new RegExp(`^${employee.firstName.trim()}`, "i") } },
                { employeeName: { $regex: new RegExp(`^${employee.firstName.trim()} ${employee.lastName ? employee.lastName.trim() : ""}`, "i") } }
              ]
            },
            { employeeId: null }
          ]
        }
      ]
    };

    const records = await Incentive.find(query).lean();

    // Filter records matching the target month & year
    const matchingRecords = records.filter((rec) => {
      if (!targetMonthName) return true;

      const recMonth = (rec.month || "").toUpperCase();

      const hasMonth =
        recMonth.includes(targetMonthName.toUpperCase()) ||
        (targetMonthShort && recMonth.includes(targetMonthShort.toUpperCase()));

      if (!hasMonth) return false;

      // Check year in month string e.g. "APRIL, 26" or "APRIL 2026"
      const yearMatches = recMonth.match(/\b(20\d{2}|\d{2})\b/);
      if (yearMatches) {
        const foundYearStr = yearMatches[1];
        if (foundYearStr.length === 4) {
          return Number(foundYearStr) === targetYear;
        } else if (foundYearStr.length === 2) {
          return foundYearStr === targetYear2Digits;
        }
      }

      // If no year in month string, check disbursementDate
      if (rec.disbursementDate) {
        const d = new Date(rec.disbursementDate);
        if (!isNaN(d.getTime())) {
          return d.getFullYear() === targetYear;
        }
      }

      return true;
    });

    const totalIncentive = matchingRecords.reduce(
      (sum, r) => sum + (Number(r.incentiveAmount) || 0),
      0
    );

    res.json({
      success: true,
      employeeId: employee._id,
      employeeName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
      month: targetMonthName || month,
      year: targetYear,
      totalIncentive: parseFloat(totalIncentive.toFixed(2)),
      count: matchingRecords.length,
      records: matchingRecords.map((r) => ({
        _id: r._id,
        product: r.product,
        month: r.month,
        transactionPerMonth: r.transactionPerMonth ?? r.totalIncome,
        projectedIncomeYearly: r.projectedIncomeYearly,
        actualIncomeYearly: r.actualIncomeYearly,
        commissionPercentage: r.commissionPercentage,
        incentiveAmount: r.incentiveAmount,
        disbursementDate: r.disbursementDate,
      })),
    });
  } catch (error) {
    console.error("getEmployeeMonthlyIncentive error:", error);
    res.status(500).json({ error: "Failed to fetch employee monthly incentive." });
  }
};
