import ActivityLog from "../models/ActivityLog.js";
import User from "../models/User.js";
import Employee from "../models/Employee.js";

/**
 * Reusable helper to record system and user activity logs
 */
export const logActivity = async ({
  req,
  userId,
  employeeId,
  userName,
  userEmail,
  userRole,
  category,
  action,
  description,
  metadata = {},
  status = "SUCCESS",
  ipAddress,
  userAgent,
}) => {
  try {
    // 1. Resolve client IP and User Agent
    const ip =
      ipAddress ||
      (req
        ? req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          req.ip ||
          ""
        : "");
    const ua = userAgent || (req ? req.headers["user-agent"] || "" : "");

    // 2. Resolve User details
    let resolvedUserId = userId || req?.session?.userId || null;
    let resolvedEmail = userEmail || req?.session?.email || "";
    let resolvedRole = userRole || req?.session?.role || "EMPLOYEE";
    let resolvedName = userName || "";
    let resolvedEmpId = employeeId || null;

    const isEmailLike = (str) => typeof str === "string" && str.includes("@");
    if (isEmailLike(resolvedName)) {
      resolvedName = "";
    }

    // 1. Resolve via Employee ID
    if (!resolvedName && resolvedEmpId) {
      try {
        const emp = await Employee.findById(resolvedEmpId)
          .select("firstName lastName")
          .lean();
        if (emp) {
          resolvedName = `${emp.firstName} ${emp.lastName || ""}`.trim();
        }
      } catch (e) {
        // Ignore lookup error
      }
    }

    // 2. Resolve via User ID in Employee collection
    if (!resolvedName && resolvedUserId) {
      try {
        const emp = await Employee.findOne({ userId: resolvedUserId })
          .select("_id firstName lastName")
          .lean();
        if (emp) {
          resolvedEmpId = emp._id;
          resolvedName = `${emp.firstName} ${emp.lastName || ""}`.trim();
        }
      } catch (e) {
        // Ignore lookup error
      }
    }

    // 3. Resolve via Email in Employee collection
    if (!resolvedName && resolvedEmail) {
      try {
        const emp = await Employee.findOne({
          $or: [
            { email: { $regex: new RegExp(`^${resolvedEmail.trim()}$`, "i") } },
            { personalEmail: { $regex: new RegExp(`^${resolvedEmail.trim()}$`, "i") } },
          ],
        })
          .select("_id firstName lastName")
          .lean();
        if (emp) {
          resolvedEmpId = emp._id;
          resolvedName = `${emp.firstName} ${emp.lastName || ""}`.trim();
        }
      } catch (e) {
        // Ignore lookup error
      }
    }

    // 4. Resolve via User collection (e.g. Admin users)
    if (!resolvedName && resolvedUserId) {
      try {
        const user = await User.findById(resolvedUserId)
          .select("name email role")
          .lean();
        if (user) {
          if (user.name && !isEmailLike(user.name)) {
            resolvedName = user.name;
          }
          if (!resolvedRole) resolvedRole = user.role;
        }
      } catch (e) {
        // Ignore lookup error
      }
    }

    // 5. Fallback: NEVER use email, map strictly to clean employee/admin name
    if (!resolvedName) {
      resolvedName = resolvedRole === "ADMIN" ? "ADMIN" : "EMPLOYEE";
    }

    // Sanitize description so no raw email appears in activity log descriptions
    let sanitizedDescription = description || "";
    if (resolvedEmail && typeof sanitizedDescription === "string" && sanitizedDescription.toLowerCase().includes(resolvedEmail.toLowerCase())) {
      const emailRegex = new RegExp(resolvedEmail, "gi");
      sanitizedDescription = sanitizedDescription.replace(emailRegex, resolvedName);
    }

    const logEntry = await ActivityLog.create({
      userId: resolvedUserId,
      employeeId: resolvedEmpId,
      userName: resolvedName.trim().toUpperCase(),
      userEmail: "",
      userRole: resolvedRole,
      category,
      action: action.trim().toUpperCase(),
      description: sanitizedDescription,
      metadata,
      ipAddress: typeof ip === "string" ? ip.split(",")[0].trim() : "",
      userAgent: ua,
      status,
    });

    return logEntry;
  } catch (error) {
    console.error("activityLogger error:", error);
    return null;
  }
};
