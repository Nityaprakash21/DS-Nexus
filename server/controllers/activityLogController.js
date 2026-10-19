import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";

// GET /api/activity-logs
// Fetch paginated, filtered audit logs
export const getActivityLogs = async (req, res) => {
  try {
    const {
      userId,
      category,
      action,
      status,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 25,
    } = req.query;

    const filter = {};

    // Filter by specific employee name or ID
    if (userId && userId !== "ALL") {
      const trimmed = userId.trim();
      const orConditions = [
        { userName: new RegExp(`^${trimmed}$`, "i") },
      ];
      if (mongoose.Types.ObjectId.isValid(trimmed)) {
        orConditions.push({ userId: trimmed });
        orConditions.push({ employeeId: trimmed });
      }
      filter.$or = orConditions;
    }

    // Filter by category / module
    if (category && category !== "ALL") {
      filter.category = category;
    }

    // Filter by action
    if (action && action !== "ALL") {
      filter.action = action;
    }

    // Filter by status
    if (status && status !== "ALL") {
      filter.status = status;
    }

    // Filter by Date Range (inclusive)
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Search query across employee name, action, description, IP
    if (search && search.trim()) {
      const q = search.trim();
      const searchOr = [
        { userName: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { action: { $regex: q, $options: "i" } },
        { ipAddress: { $regex: q, $options: "i" } },
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const total = await ActivityLog.countDocuments(filter);

    let query = ActivityLog.find(filter).sort({ createdAt: -1 });

    const pageNum = parseInt(page, 10) || 1;
    const isExport = limit === "all" || limit === "0";
    const limitNum = isExport ? 5000 : parseInt(limit, 10) || 50;

    if (!isExport) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    } else {
      query = query.limit(limitNum);
    }

    const logs = await query.lean();

    const sanitizedLogs = logs.map((log) => ({
      ...log,
      userEmail: "", // Ensure no email is mapped or sent to client
    }));

    res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      data: sanitizedLogs,
    });
  } catch (error) {
    console.error("getActivityLogs error:", error);
    res.status(500).json({ error: "Failed to fetch activity logs." });
  }
};

// GET /api/activity-logs/users
// Distinct employee list for the employee dropdown selector
export const getActivityUsers = async (req, res) => {
  try {
    // 1. Get all employees
    const employees = await Employee.find({ isDeleted: { $ne: true } })
      .select("firstName lastName")
      .lean();

    // 2. Map into clean employee list
    const nameMap = new Map();

    // Add active employees
    employees.forEach((emp) => {
      const name = `${emp.firstName} ${emp.lastName || ""}`.trim().toUpperCase();
      if (name && !name.includes("@")) {
        nameMap.set(name, {
          id: name,
          name,
        });
      }
    });

    // 3. Add admin staff names if present
    const users = await User.find({ role: "ADMIN" }).select("name").lean();
    users.forEach((u) => {
      if (u.name) {
        const name = u.name.trim().toUpperCase();
        if (name && !name.includes("@") && !nameMap.has(name)) {
          nameMap.set(name, {
            id: name,
            name,
          });
        }
      }
    });

    // 4. Also include any distinct employee names that appear in ActivityLog
    const logUserNames = await ActivityLog.distinct("userName");
    logUserNames.forEach((uName) => {
      if (!uName || typeof uName !== "string") return;
      const cleanName = uName.trim().toUpperCase();
      // Skip if it contains email address symbol or system prefix
      if (cleanName.includes("@")) return;
      if (!nameMap.has(cleanName)) {
        nameMap.set(cleanName, {
          id: cleanName,
          name: cleanName,
        });
      }
    });

    const userList = Array.from(nameMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    res.json({
      success: true,
      data: userList,
    });
  } catch (error) {
    console.error("getActivityUsers error:", error);
    res.status(500).json({ error: "Failed to fetch employee list for logs." });
  }
};

// GET /api/activity-logs/stats
// High-level statistics for KPI cards
export const getActivityStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const [todayCount, totalCount, todayUsers, failedCount] = await Promise.all([
      ActivityLog.countDocuments({ createdAt: { $gte: todayStart } }),
      ActivityLog.countDocuments({}),
      ActivityLog.distinct("userName", { createdAt: { $gte: todayStart } }),
      ActivityLog.countDocuments({ status: { $in: ["FAILED", "WARNING"] } }),
    ]);

    res.json({
      success: true,
      data: {
        todayCount,
        totalCount,
        activeUsersToday: todayUsers.length,
        failedCount,
      },
    });
  } catch (error) {
    console.error("getActivityStats error:", error);
    res.status(500).json({ error: "Failed to calculate activity stats." });
  }
};

// DELETE /api/activity-logs/clear
// Admin maintenance: clear logs older than specified days
export const clearOldActivityLogs = async (req, res) => {
  try {
    const { olderThanDays = 90 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Number(olderThanDays));

    const result = await ActivityLog.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} activity logs older than ${olderThanDays} days.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("clearOldActivityLogs error:", error);
    res.status(500).json({ error: "Failed to clear old activity logs." });
  }
};
