import { useEffect, useState, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Save,
  Users,
  UserCheck,
  Shield,
  Layers,
  Loader2,
  RotateCcw,
  AlertCircle,
  Lock,
  SlidersHorizontal,
  Calendar,
  FileText,
  Award
} from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";
import Loading from "../components/Loading";
import { useDepartments } from "../hooks/useDepartments";
import { useAuth } from "../../context/AuthContext";
import { Navigate } from "react-router-dom";

interface EmployeeItem {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  department: string;
  position: string;
}

interface DelegationItem {
  leaveApproverId: string | null;
  leaveApproverName?: string;
  leaveApproverCode?: string | null;

  attendanceApproverId: string | null;
  attendanceApproverName?: string;
  attendanceApproverCode?: string | null;

  kpaEvaluatorId: string | null;
  kpaEvaluatorName?: string;
  kpaEvaluatorCode?: string | null;

  customPermissions?: {
    canViewTeamAttendance: boolean;
    canManageTeamPayslips: boolean;
    canReviewFeedback: boolean;
  };
}

interface SidebarModule {
  id: string;
  name: string;
  path: string;
  description: string;
  delegableAction: string;
  defaultAuthority: string;
  icon: string;
}

const Authorization = () => {
  const { user } = useAuth();

  if (user?.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  const { departmentNames } = useDepartments();
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [delegations, setDelegations] = useState<Record<string, DelegationItem>>({});
  const [modules, setModules] = useState<SidebarModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "DELEGATED" | "ADMIN_ONLY">("ALL");
  const [hasChanges, setHasChanges] = useState(false);

  const fetchAuthorizations = async () => {
    try {
      setLoading(true);
      const res = await api.get("/authorizations");
      if (res.data?.success) {
        setEmployees(res.data.employees || []);
        setDelegations(res.data.delegations || {});
        setModules(res.data.modules || []);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to load authorization data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthorizations();
  }, []);

  const handleApproverChange = (
    targetEmpId: string,
    field: "leaveApproverId" | "attendanceApproverId" | "kpaEvaluatorId",
    value: string
  ) => {
    const approverId = value === "ADMIN" ? null : value;
    setDelegations((prev) => {
      const current = prev[targetEmpId] || {
        leaveApproverId: null,
        attendanceApproverId: null,
        kpaEvaluatorId: null,
      };
      return {
        ...prev,
        [targetEmpId]: {
          ...current,
          [field]: approverId,
        },
      };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = Object.entries(delegations).map(([empId, d]) => ({
        employeeId: empId,
        leaveApproverId: d.leaveApproverId,
        attendanceApproverId: d.attendanceApproverId,
        kpaEvaluatorId: d.kpaEvaluatorId,
        customPermissions: d.customPermissions || {},
      }));

      const res = await api.put("/authorizations", { delegations: payload });
      if (res.data?.success) {
        toast.success("Authorization matrix saved successfully!");
        setHasChanges(false);
        fetchAuthorizations();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to save authorization changes");
    } finally {
      setSaving(false);
    }
  };

  const handleResetAllToAdmin = () => {
    if (!confirm("Are you sure you want to reset all employee approval authorities back to Super Admin?")) {
      return;
    }
    const resetMap: Record<string, DelegationItem> = {};
    employees.forEach((emp) => {
      resetMap[emp.id] = {
        leaveApproverId: null,
        attendanceApproverId: null,
        kpaEvaluatorId: null,
        customPermissions: {
          canViewTeamAttendance: false,
          canManageTeamPayslips: false,
          canReviewFeedback: false,
        },
      };
    });
    setDelegations(resetMap);
    setHasChanges(true);
    toast.success("Reset all authorities to Super Admin. Click 'Save Matrix' to persist.");
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch = `${emp.employeeCode} ${emp.name} ${emp.position} ${emp.department}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesDept = selectedDept ? emp.department === selectedDept : true;

      const current = delegations[emp.id];
      const isDelegated =
        Boolean(current?.leaveApproverId) ||
        Boolean(current?.attendanceApproverId) ||
        Boolean(current?.kpaEvaluatorId);

      let matchesFilterType = true;
      if (filterType === "DELEGATED") matchesFilterType = isDelegated;
      if (filterType === "ADMIN_ONLY") matchesFilterType = !isDelegated;

      return matchesSearch && matchesDept && matchesFilterType;
    });
  }, [employees, delegations, search, selectedDept, filterType]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalDelegatedLeave = 0;
    let totalDelegatedAttendance = 0;
    let totalDelegatedKpa = 0;
    const activeDelegatedEmployees = new Set<string>();

    Object.entries(delegations).forEach(([empId, d]) => {
      if (d.leaveApproverId) {
        totalDelegatedLeave++;
        activeDelegatedEmployees.add(empId);
      }
      if (d.attendanceApproverId) {
        totalDelegatedAttendance++;
        activeDelegatedEmployees.add(empId);
      }
      if (d.kpaEvaluatorId) {
        totalDelegatedKpa++;
        activeDelegatedEmployees.add(empId);
      }
    });

    const totalDelegationsCount = totalDelegatedLeave + totalDelegatedAttendance + totalDelegatedKpa;
    const totalPotentialSlots = (employees.length || 1) * 3;
    const adminHandledCount = Math.max(0, totalPotentialSlots - totalDelegationsCount);

    const leaveDelegatedPct = Math.round((totalDelegatedLeave / (employees.length || 1)) * 100);
    const attendanceDelegatedPct = Math.round((totalDelegatedAttendance / (employees.length || 1)) * 100);
    const kpaDelegatedPct = Math.round((totalDelegatedKpa / (employees.length || 1)) * 100);

    return {
      totalEmployees: employees.length,
      totalDelegationsCount,
      adminHandledCount,
      activeDelegatedEmployeesCount: activeDelegatedEmployees.size,
      totalDelegatedLeave,
      totalDelegatedAttendance,
      totalDelegatedKpa,
      leaveDelegatedPct,
      attendanceDelegatedPct,
      kpaDelegatedPct,
    };
  }, [employees, delegations]);

  // Active delegations list for side panel
  const activeDelegationPairs = useMemo(() => {
    const list: {
      targetEmp: EmployeeItem;
      leaveApprover?: EmployeeItem;
      attendanceApprover?: EmployeeItem;
      kpaEvaluator?: EmployeeItem;
    }[] = [];

    employees.forEach((emp) => {
      const d = delegations[emp.id];
      if (!d) return;
      const leaveApprover = d.leaveApproverId ? employees.find((e) => e.id === d.leaveApproverId) : undefined;
      const attendanceApprover = d.attendanceApproverId ? employees.find((e) => e.id === d.attendanceApproverId) : undefined;
      const kpaEvaluator = d.kpaEvaluatorId ? employees.find((e) => e.id === d.kpaEvaluatorId) : undefined;

      if (leaveApprover || attendanceApprover || kpaEvaluator) {
        list.push({ targetEmp: emp, leaveApprover, attendanceApprover, kpaEvaluator });
      }
    });

    return list;
  }, [employees, delegations]);

  if (loading) return <Loading />;

  return (
    <div className="animate-fade-in space-y-6 w-full pb-12">
      {/* Executive Page Header */}
      <div className="card p-5 sm:p-6 bg-gradient-to-r from-white via-indigo-50/20 to-purple-50/20 border-slate-200/90 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Role Authorization & Governance
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                <Lock className="w-3 h-3 text-indigo-600" /> Super Admin Exclusive
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
              Configure granular module approval authorities for your personnel. Designated managers receive restricted, isolated access to review and approve assigned team members without cross-departmental exposure.
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {hasChanges && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300/80 px-3 py-1.5 rounded-xl animate-pulse flex items-center gap-1.5 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-amber-600" /> Unsaved Changes Staged
              </span>
            )}
            <button
              type="button"
              onClick={handleResetAllToAdmin}
              className="btn-secondary text-xs sm:text-sm py-2.5 px-3.5 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Reset all authorities to Super Admin"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" /> Reset to Admin
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`btn-primary text-xs sm:text-sm py-2.5 px-5 flex items-center gap-2 cursor-pointer shadow-sm ${
                !hasChanges ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Matrix
            </button>
          </div>
        </div>
      </div>

      {/* KPI Overview Grid - 4 Full-Width Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="card p-4 sm:p-5 flex items-center justify-between relative overflow-hidden group border-slate-200/90 shadow-2xs hover:border-indigo-200 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 rounded-r-full" />
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Personnel</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">{stats.totalEmployees}</span>
              <span className="text-xs font-medium text-slate-400">active members</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">100% onboarded in system</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 group-hover:scale-105 transition-transform">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="card p-4 sm:p-5 flex items-center justify-between relative overflow-hidden group border-slate-200/90 shadow-2xs hover:border-emerald-200 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 rounded-r-full" />
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delegated Roles</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-emerald-600 font-mono tracking-tight">{stats.totalDelegationsCount}</span>
              <span className="text-xs font-medium text-emerald-600/80">slots assigned</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              {stats.activeDelegatedEmployeesCount} employee{stats.activeDelegatedEmployeesCount === 1 ? "" : "s"} have custom approvers
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 group-hover:scale-105 transition-transform">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="card p-4 sm:p-5 flex items-center justify-between relative overflow-hidden group border-slate-200/90 shadow-2xs hover:border-purple-200 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500 rounded-r-full" />
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin Direct Slots</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-purple-600 font-mono tracking-tight">{stats.adminHandledCount}</span>
              <span className="text-xs font-medium text-purple-600/80">under Admin</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">Super Admin root governance</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100 group-hover:scale-105 transition-transform">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        <div className="card p-4 sm:p-5 flex items-center justify-between relative overflow-hidden group border-slate-200/90 shadow-2xs hover:border-sky-200 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-sky-500 rounded-r-full" />
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Governance Modules</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-sky-600 font-mono tracking-tight">{modules.length}</span>
              <span className="text-xs font-medium text-sky-600/80">sidebar menus</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">Strict permission segregation</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100 group-hover:scale-105 transition-transform">
            <Layers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Multi-Panel Workspace (eliminates negative space) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Primary Left Panel: Delegation Matrix & Controls (8 Cols on XL) */}
        <div className="xl:col-span-8 space-y-6">
          <div className="card overflow-hidden border-slate-200/90 shadow-xs">
            {/* Table Header & Controls Bar */}
            <div className="p-5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-slate-900">Personnel Approval Matrix</h2>
                  <span className="text-xs font-mono font-bold bg-white text-indigo-700 px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                    {filteredEmployees.length} of {employees.length} Personnel
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select which employee or Admin holds approval authority for each team member.
                </p>
              </div>

              {/* Filter Type Pills */}
              <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setFilterType("ALL")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    filterType === "ALL"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({employees.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("DELEGATED")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    filterType === "DELEGATED"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Delegated ({stats.activeDelegatedEmployeesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("ADMIN_ONLY")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    filterType === "ADMIN_ONLY"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Admin Direct ({employees.length - stats.activeDelegatedEmployeesCount})
                </button>
              </div>
            </div>

            {/* Quick Search & Department Filters */}
            <div className="p-4 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search personnel by code, name, or position..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10! bg-slate-50/60 border border-slate-200 rounded-xl text-xs sm:text-sm py-2 px-3 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full sm:w-44 bg-slate-50/60 border border-slate-200 rounded-xl text-xs sm:text-sm py-2 px-3 text-slate-700 focus:bg-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">All Departments</option>
                  {departmentNames.map((d: string) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-[28%]">Personnel / Target</th>
                    <th className="py-3.5 px-4 w-[24%]">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-sky-600" />
                        <span>Leave Approver</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 w-[24%]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Attendance Approver</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 w-[24%]">
                      <div className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-purple-600" />
                        <span>KPA Appraiser</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-slate-400 font-medium">
                        No employees found matching the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const current = delegations[emp.id] || {
                        leaveApproverId: null,
                        attendanceApproverId: null,
                        kpaEvaluatorId: null,
                      };

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Personnel Profile Column */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-slate-100 border border-indigo-200/70 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                {emp.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {emp.employeeCode && (
                                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.2 rounded">
                                      #{emp.employeeCode}
                                    </span>
                                  )}
                                  <span className="font-bold text-slate-900 truncate">
                                    {emp.name}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                  {emp.position} • <span className="text-slate-400">{emp.department}</span>
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Leave Approver Selector */}
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <select
                                value={current.leaveApproverId || "ADMIN"}
                                onChange={(e) =>
                                  handleApproverChange(emp.id, "leaveApproverId", e.target.value)
                                }
                                className={`w-full text-xs font-medium rounded-lg px-2.5 py-2 border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                                  current.leaveApproverId
                                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-800 font-bold"
                                    : "bg-white border-slate-200 text-slate-700"
                                }`}
                              >
                                <option value="ADMIN">★ Super Admin (Default)</option>
                                <optgroup label="Delegate to Specific Employee">
                                  {employees
                                    .filter((other) => other.id !== emp.id)
                                    .map((other) => (
                                      <option key={other.id} value={other.id}>
                                        {other.employeeCode ? `[#${other.employeeCode}] ` : ""}
                                        {other.name} ({other.department})
                                      </option>
                                    ))}
                                </optgroup>
                              </select>
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <span className={`w-1.5 h-1.5 rounded-full ${current.leaveApproverId ? "bg-emerald-500" : "bg-indigo-500"}`} />
                                {current.leaveApproverId ? "Delegated" : "Direct oversight"}
                              </div>
                            </div>
                          </td>

                          {/* Attendance Approver Selector */}
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <select
                                value={current.attendanceApproverId || "ADMIN"}
                                onChange={(e) =>
                                  handleApproverChange(emp.id, "attendanceApproverId", e.target.value)
                                }
                                className={`w-full text-xs font-medium rounded-lg px-2.5 py-2 border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                                  current.attendanceApproverId
                                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-800 font-bold"
                                    : "bg-white border-slate-200 text-slate-700"
                                }`}
                              >
                                <option value="ADMIN">★ Super Admin (Default)</option>
                                <optgroup label="Delegate to Specific Employee">
                                  {employees
                                    .filter((other) => other.id !== emp.id)
                                    .map((other) => (
                                      <option key={other.id} value={other.id}>
                                        {other.employeeCode ? `[#${other.employeeCode}] ` : ""}
                                        {other.name} ({other.department})
                                      </option>
                                    ))}
                                </optgroup>
                              </select>
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <span className={`w-1.5 h-1.5 rounded-full ${current.attendanceApproverId ? "bg-emerald-500" : "bg-indigo-500"}`} />
                                {current.attendanceApproverId ? "Delegated" : "Direct oversight"}
                              </div>
                            </div>
                          </td>

                          {/* KPA Evaluator Selector */}
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <select
                                value={current.kpaEvaluatorId || "ADMIN"}
                                onChange={(e) =>
                                  handleApproverChange(emp.id, "kpaEvaluatorId", e.target.value)
                                }
                                className={`w-full text-xs font-medium rounded-lg px-2.5 py-2 border transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                                  current.kpaEvaluatorId
                                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-800 font-bold"
                                    : "bg-white border-slate-200 text-slate-700"
                                }`}
                              >
                                <option value="ADMIN">★ Super Admin (Default)</option>
                                <optgroup label="Delegate to Specific Employee">
                                  {employees
                                    .filter((other) => other.id !== emp.id)
                                    .map((other) => (
                                      <option key={other.id} value={other.id}>
                                        {other.employeeCode ? `[#${other.employeeCode}] ` : ""}
                                        {other.name} ({other.department})
                                      </option>
                                    ))}
                                </optgroup>
                              </select>
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <span className={`w-1.5 h-1.5 rounded-full ${current.kpaEvaluatorId ? "bg-emerald-500" : "bg-indigo-500"}`} />
                                {current.kpaEvaluatorId ? "Delegated" : "Direct oversight"}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="p-4 grid grid-cols-1 gap-4 md:hidden">
              {filteredEmployees.length === 0 ? (
                <p className="p-8 text-center text-slate-400 font-medium">No personnel found.</p>
              ) : (
                filteredEmployees.map((emp) => {
                  const current = delegations[emp.id] || {
                    leaveApproverId: null,
                    attendanceApproverId: null,
                    kpaEvaluatorId: null,
                  };
                  return (
                    <div key={emp.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {emp.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {emp.employeeCode && (
                              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                                #{emp.employeeCode}
                              </span>
                            )}
                            <h3 className="font-bold text-slate-900 text-sm truncate">{emp.name}</h3>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{emp.position} • {emp.department}</p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-200/80 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Leave Approver</label>
                          <select
                            value={current.leaveApproverId || "ADMIN"}
                            onChange={(e) => handleApproverChange(emp.id, "leaveApproverId", e.target.value)}
                            className="w-full text-xs font-medium rounded-lg p-2 border bg-white border-slate-200 text-slate-800"
                          >
                            <option value="ADMIN">★ Super Admin (Default)</option>
                            <optgroup label="Delegate to Employee">
                              {employees
                                .filter((other) => other.id !== emp.id)
                                .map((other) => (
                                  <option key={other.id} value={other.id}>
                                    {other.employeeCode ? `[#${other.employeeCode}] ` : ""}
                                    {other.name} ({other.department})
                                  </option>
                                ))}
                            </optgroup>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Attendance Approver</label>
                          <select
                            value={current.attendanceApproverId || "ADMIN"}
                            onChange={(e) => handleApproverChange(emp.id, "attendanceApproverId", e.target.value)}
                            className="w-full text-xs font-medium rounded-lg p-2 border bg-white border-slate-200 text-slate-800"
                          >
                            <option value="ADMIN">★ Super Admin (Default)</option>
                            <optgroup label="Delegate to Employee">
                              {employees
                                .filter((other) => other.id !== emp.id)
                                .map((other) => (
                                  <option key={other.id} value={other.id}>
                                    {other.employeeCode ? `[#${other.employeeCode}] ` : ""}
                                    {other.name} ({other.department})
                                  </option>
                                ))}
                            </optgroup>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">KPA Appraiser</label>
                          <select
                            value={current.kpaEvaluatorId || "ADMIN"}
                            onChange={(e) => handleApproverChange(emp.id, "kpaEvaluatorId", e.target.value)}
                            className="w-full text-xs font-medium rounded-lg p-2 border bg-white border-slate-200 text-slate-800"
                          >
                            <option value="ADMIN">★ Super Admin (Default)</option>
                            <optgroup label="Delegate to Employee">
                              {employees
                                .filter((other) => other.id !== emp.id)
                                .map((other) => (
                                  <option key={other.id} value={other.id}>
                                    {other.employeeCode ? `[#${other.employeeCode}] ` : ""}
                                    {other.name} ({other.department})
                                  </option>
                                ))}
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* Secondary Right Panel: Governance Insights, Live Delegations & Rules (4 Cols on XL) */}
        <div className="xl:col-span-4 space-y-6">
          {/* Card 1: Active Delegation Map */}
          <div className="card p-5 border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Active Delegation Roster
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                {activeDelegationPairs.length} Custom
              </span>
            </div>

            {activeDelegationPairs.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Shield className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">100% Super Admin Governance</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  All employee leave applications, attendance corrections, and KPA evaluations are routed directly to the Super Admin.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeDelegationPairs.map((pair) => (
                  <div
                    key={pair.targetEmp.id}
                    className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{pair.targetEmp.name}</span>
                      <span className="font-mono text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                        #{pair.targetEmp.employeeCode}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                      {pair.leaveApprover && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Leave Approver:</span>
                          <span className="font-semibold text-emerald-700">
                            {pair.leaveApprover.name} (#{pair.leaveApprover.employeeCode})
                          </span>
                        </div>
                      )}
                      {pair.attendanceApprover && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Attendance Approver:</span>
                          <span className="font-semibold text-emerald-700">
                            {pair.attendanceApprover.name} (#{pair.attendanceApprover.employeeCode})
                          </span>
                        </div>
                      )}
                      {pair.kpaEvaluator && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">KPA Appraiser:</span>
                          <span className="font-semibold text-emerald-700">
                            {pair.kpaEvaluator.name} (#{pair.kpaEvaluator.employeeCode})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Authority Coverage Gauges */}
          <div className="card p-5 border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                Authority Distribution
              </h3>
              <span className="text-xs text-slate-400">Coverage</span>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Leave Quota Approvals */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-700">Leave Approvals</span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {stats.totalDelegatedLeave} Delegated • {stats.totalEmployees - stats.totalDelegatedLeave} Admin
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${stats.leaveDelegatedPct}%` }}
                    title={`Delegated: ${stats.leaveDelegatedPct}%`}
                  />
                  <div
                    className="bg-indigo-500 h-full transition-all duration-500"
                    style={{ width: `${100 - stats.leaveDelegatedPct}%` }}
                    title={`Admin: ${100 - stats.leaveDelegatedPct}%`}
                  />
                </div>
              </div>

              {/* Attendance Regularization */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-700">Attendance Regularization</span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {stats.totalDelegatedAttendance} Delegated • {stats.totalEmployees - stats.totalDelegatedAttendance} Admin
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${stats.attendanceDelegatedPct}%` }}
                    title={`Delegated: ${stats.attendanceDelegatedPct}%`}
                  />
                  <div
                    className="bg-indigo-500 h-full transition-all duration-500"
                    style={{ width: `${100 - stats.attendanceDelegatedPct}%` }}
                    title={`Admin: ${100 - stats.attendanceDelegatedPct}%`}
                  />
                </div>
              </div>

              {/* KPA Performance Evaluations */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-700">KPA & Performance Appraisals</span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {stats.totalDelegatedKpa} Delegated • {stats.totalEmployees - stats.totalDelegatedKpa} Admin
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${stats.kpaDelegatedPct}%` }}
                    title={`Delegated: ${stats.kpaDelegatedPct}%`}
                  />
                  <div
                    className="bg-indigo-500 h-full transition-all duration-500"
                    style={{ width: `${100 - stats.kpaDelegatedPct}%` }}
                    title={`Admin: ${100 - stats.kpaDelegatedPct}%`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Delegated Manager
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Super Admin Direct
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Authorization;
