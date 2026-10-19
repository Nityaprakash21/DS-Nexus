import Employee from "../models/Employee.js";
import ApprovalDelegation from "../models/ApprovalDelegation.js";

/**
 * Middleware that allows request if the user is an ADMIN,
 * or if they are an EMPLOYEE whose ApprovalDelegation includes the specified custom permission toggle.
 */
export const requirePermissionOrAdmin = (permissionKey) => async (req, res, next) => {
  const role = req?.session?.role || req?.user?.role;
  if (role === "ADMIN") {
    return next();
  }

  try {
    const userId = req?.session?.userId || req?.user?._id || req?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const employee = await Employee.findOne({ userId, isDeleted: false }).lean();
    if (!employee) {
      return res.status(403).json({ error: "Employee profile not found" });
    }

    const delegation = await ApprovalDelegation.findOne({ employeeId: employee._id }).lean();
    if (delegation?.customPermissions?.[permissionKey]) {
      req.employee = employee;
      return next();
    }

    return res.status(403).json({
      error: `Access denied: Requires administrator privilege or delegated '${permissionKey}' authority.`,
    });
  } catch (error) {
    console.error("Permission check error:", error);
    return res.status(500).json({ error: "Internal permission verification failure" });
  }
};
