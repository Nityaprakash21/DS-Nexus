import Employee from "../models/Employee.js";
import ApprovalDelegation from "../models/ApprovalDelegation.js";

// Canonical Sidebar Modules & Capabilities Definition
export const SIDEBAR_MODULES = [
  {
    id: "dashboard",
    name: "Dashboard",
    path: "/dashboard",
    description: "Operational metrics, attendance stats, leave balances, and quick actions.",
    delegableAction: "Role-specific Overview (Admin or Employee)",
    defaultAuthority: "System Role (Admin / Employee)",
    icon: "LayoutGridIcon"
  },
  {
    id: "employees",
    name: "Employees",
    path: "/employees",
    description: "Employee onboarding, personnel records, basic salary, and profile management.",
    delegableAction: "Team Directory & Profile Viewing",
    defaultAuthority: "Admin Only",
    icon: "UserIcon"
  },
  {
    id: "attendance",
    name: "Attendance",
    path: "/attendance",
    description: "Daily clock-in/out tracking, attendance calendars, and regularization requests.",
    delegableAction: "Attendance Correction Approval Authority",
    defaultAuthority: "Admin (or Delegated Approver)",
    icon: "CalendarIcon"
  },
  {
    id: "leave",
    name: "Leave",
    path: "/leave",
    description: "Financial Year leave quota tracking, balance monitoring, and leave requests.",
    delegableAction: "Leave Application Approval Authority",
    defaultAuthority: "Admin (or Delegated Approver)",
    icon: "FileTextIcon"
  },
  {
    id: "payslips",
    name: "Payslips",
    path: "/payslips",
    description: "Monthly salary slip generation, allowances, deductions, and downloadable payslips.",
    delegableAction: "Team Payslip Oversight",
    defaultAuthority: "Admin Only",
    icon: "IndianRupee"
  },
  {
    id: "kpa",
    name: "KPA & Appraisal",
    path: "/kpa",
    description: "Quarterly key performance area metrics, SLA turnaround, and appraisal ratings.",
    delegableAction: "Performance Evaluation / Appraiser Authority",
    defaultAuthority: "Admin (or Delegated Evaluator)",
    icon: "Award"
  },
  {
    id: "feedback",
    name: "Feedback",
    path: "/feedback",
    description: "Workplace suggestions, employee ideas, and leadership verdict marking.",
    delegableAction: "Feedback Review & Status Marking",
    defaultAuthority: "Admin Only",
    icon: "MessageSquarePlus"
  },
  {
    id: "authorization",
    name: "Authorization",
    path: "/authorization",
    description: "Role delegation matrix and approval authority assignment for all modules.",
    delegableAction: "System Authorization Control",
    defaultAuthority: "Admin Only",
    icon: "ShieldCheck"
  }
];

// GET /api/authorizations
// Admin fetches the complete delegation matrix, employee list, and modules
export const getAuthorizations = async (req, res) => {
  try {
    const employees = await Employee.find({ isDeleted: { $ne: true } })
      .select("_id employeeCode firstName lastName email department position")
      .sort({ employeeCode: 1, createdAt: 1 })
      .lean();

    const formattedEmployees = employees.map((emp) => ({
      id: emp._id.toString(),
      employeeCode: emp.employeeCode || "",
      name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
      email: emp.email,
      department: emp.department || "General",
      position: emp.position || "Staff",
    }));

    const delegations = await ApprovalDelegation.find()
      .populate("leaveApproverId", "_id employeeCode firstName lastName")
      .populate("attendanceApproverId", "_id employeeCode firstName lastName")
      .populate("kpaEvaluatorId", "_id employeeCode firstName lastName")
      .lean();

    const delegationMap = {};
    delegations.forEach((d) => {
      const empId = d.employeeId.toString();
      delegationMap[empId] = {
        leaveApproverId: d.leaveApproverId ? d.leaveApproverId._id.toString() : null,
        leaveApproverName: d.leaveApproverId
          ? `${d.leaveApproverId.firstName} ${d.leaveApproverId.lastName || ""}`.trim()
          : "Admin (Self)",
        leaveApproverCode: d.leaveApproverId?.employeeCode || null,

        attendanceApproverId: d.attendanceApproverId ? d.attendanceApproverId._id.toString() : null,
        attendanceApproverName: d.attendanceApproverId
          ? `${d.attendanceApproverId.firstName} ${d.attendanceApproverId.lastName || ""}`.trim()
          : "Admin (Self)",
        attendanceApproverCode: d.attendanceApproverId?.employeeCode || null,

        kpaEvaluatorId: d.kpaEvaluatorId ? d.kpaEvaluatorId._id.toString() : null,
        kpaEvaluatorName: d.kpaEvaluatorId
          ? `${d.kpaEvaluatorId.firstName} ${d.kpaEvaluatorId.lastName || ""}`.trim()
          : "Admin (Self)",
        kpaEvaluatorCode: d.kpaEvaluatorId?.employeeCode || null,

        customPermissions: d.customPermissions || {
          canViewTeamAttendance: false,
          canManageTeamPayslips: false,
          canReviewFeedback: false,
        },
      };
    });

    return res.json({
      success: true,
      employees: formattedEmployees,
      delegations: delegationMap,
      modules: SIDEBAR_MODULES,
    });
  } catch (error) {
    console.error("Failed to fetch authorizations:", error);
    return res.status(500).json({ error: "Failed to fetch authorization matrix" });
  }
};

// PUT /api/authorizations
// Admin updates delegation mappings for employees
export const updateAuthorizations = async (req, res) => {
  try {
    const { delegations } = req.body;
    if (!Array.isArray(delegations)) {
      return res.status(400).json({ error: "Delegations array is required" });
    }

    const sessionUserId = req.session.userId;
    const ops = delegations.map((item) => {
      const {
        employeeId,
        leaveApproverId,
        attendanceApproverId,
        kpaEvaluatorId,
        customPermissions,
      } = item;

      return ApprovalDelegation.findOneAndUpdate(
        { employeeId },
        {
          leaveApproverId: leaveApproverId || null,
          attendanceApproverId: attendanceApproverId || null,
          kpaEvaluatorId: kpaEvaluatorId || null,
          customPermissions: customPermissions || {},
          updatedBy: sessionUserId,
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
    });

    await Promise.all(ops);

    return res.json({
      success: true,
      message: "Authorization delegation matrix updated successfully",
    });
  } catch (error) {
    console.error("Failed to update authorizations:", error);
    return res.status(500).json({ error: "Failed to save authorization changes" });
  }
};

// GET /api/authorizations/my-delegations
// Returns approval responsibilities for the currently authenticated employee
export const getMyDelegations = async (req, res) => {
  try {
    const session = req.session;
    if (session.role === "ADMIN") {
      return res.json({
        isAdmin: true,
        canApproveLeavesFor: "ALL",
        canApproveAttendanceFor: "ALL",
        canEvaluateKpaFor: "ALL",
        customPermissions: {
          canViewTeamAttendance: true,
          canManageTeamPayslips: true,
          canReviewFeedback: true,
        },
      });
    }

    const employee = await Employee.findOne({ userId: session.userId }).lean();
    if (!employee) {
      return res.json({
        isAdmin: false,
        canApproveLeavesFor: [],
        canApproveAttendanceFor: [],
        canEvaluateKpaFor: [],
        customPermissions: {
          canViewTeamAttendance: false,
          canManageTeamPayslips: false,
          canReviewFeedback: false,
        },
      });
    }

    const [leaveDelegations, attendanceDelegations, kpaDelegations, myDelegation] = await Promise.all([
      ApprovalDelegation.find({ leaveApproverId: employee._id })
        .populate("employeeId", "_id employeeCode firstName lastName department position")
        .lean(),
      ApprovalDelegation.find({ attendanceApproverId: employee._id })
        .populate("employeeId", "_id employeeCode firstName lastName department position")
        .lean(),
      ApprovalDelegation.find({ kpaEvaluatorId: employee._id })
        .populate("employeeId", "_id employeeCode firstName lastName department position")
        .lean(),
      ApprovalDelegation.findOne({ employeeId: employee._id }).lean(),
    ]);

    const formatTarget = (d) => {
      const emp = d.employeeId;
      if (!emp) return null;
      return {
        id: emp._id.toString(),
        employeeCode: emp.employeeCode || "",
        name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
        department: emp.department,
        position: emp.position,
      };
    };

    return res.json({
      isAdmin: false,
      canApproveLeavesFor: leaveDelegations.map(formatTarget).filter(Boolean),
      canApproveAttendanceFor: attendanceDelegations.map(formatTarget).filter(Boolean),
      canEvaluateKpaFor: kpaDelegations.map(formatTarget).filter(Boolean),
      customPermissions: {
        canViewTeamAttendance: Boolean(myDelegation?.customPermissions?.canViewTeamAttendance),
        canManageTeamPayslips: Boolean(myDelegation?.customPermissions?.canManageTeamPayslips),
        canReviewFeedback: Boolean(myDelegation?.customPermissions?.canReviewFeedback),
      },
    });
  } catch (error) {
    console.error("Failed to fetch my delegations:", error);
    return res.status(500).json({ error: "Failed to fetch delegations" });
  }
};
