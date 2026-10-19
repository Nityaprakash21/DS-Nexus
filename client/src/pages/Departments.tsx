import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Plus,
  Trash2,
  Users,
  Search,
  CheckCircle2,
  Layers,
  ShieldAlert,
  X,
  ExternalLink,
  Sparkles,
  Loader2,
  Tag,
  Edit3,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { useDepartments } from "../hooks/useDepartments";
import type { DepartmentItem } from "../hooks/useDepartments";
import { useAuth } from "../../context/AuthContext";

const COLOR_OPTIONS = [
  { name: "Indigo", value: "indigo", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500", badgeBg: "bg-indigo-500/10" },
  { name: "Blue", value: "blue", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500", badgeBg: "bg-blue-500/10" },
  { name: "Emerald", value: "emerald", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", badgeBg: "bg-emerald-500/10" },
  { name: "Amber", value: "amber", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500", badgeBg: "bg-amber-500/10" },
  { name: "Rose", value: "rose", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500", badgeBg: "bg-rose-500/10" },
  { name: "Purple", value: "purple", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500", badgeBg: "bg-purple-500/10" },
  { name: "Cyan", value: "cyan", bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", dot: "bg-cyan-500", badgeBg: "bg-cyan-500/10" },
  { name: "Slate", value: "slate", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300", dot: "bg-slate-500", badgeBg: "bg-slate-500/10" },
];

const getColorConfig = (colorName?: string) => {
  return COLOR_OPTIONS.find((c) => c.value === colorName) || COLOR_OPTIONS[0];
};

const Departments: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { departments, loading, addDepartment, updateDepartment, deleteDepartment } = useDepartments();

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<DepartmentItem | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    departmentId: "",
    name: "",
    description: "",
    color: "indigo",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Metrics
  const totalDepartments = departments.length;
  const totalAssignedStaff = departments.reduce((acc, d) => acc + (d.employeeCount || 0), 0);
  const systemDefaultsCount = departments.filter((d) => d.isDefault).length;
  const customDeptsCount = totalDepartments - systemDefaultsCount;

  // Filtered list
  const filteredDepartments = departments.filter((dept) => {
    const q = searchTerm.toLowerCase().trim();
    return (
      dept.name.toLowerCase().includes(q) ||
      (dept.departmentId && dept.departmentId.toLowerCase().includes(q)) ||
      (dept.description && dept.description.toLowerCase().includes(q))
    );
  });

  const handleOpenAddModal = () => {
    setFormData({
      departmentId: "",
      name: "",
      description: "",
      color: "indigo",
    });
    setEditingDept(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (dept: DepartmentItem) => {
    setEditingDept(dept);
    setFormData({
      departmentId: dept.departmentId || "",
      name: dept.name,
      description: dept.description || "",
      color: dept.color || "indigo",
    });
    setIsAddModalOpen(true);
  };

  const handleSubmitDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.departmentId.trim()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        departmentId: formData.departmentId.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        color: formData.color,
      };

      if (editingDept && updateDepartment) {
        await updateDepartment(editingDept._id, payload);
      } else {
        await addDepartment(payload);
      }

      setIsAddModalOpen(false);
      setEditingDept(null);
      setFormData({ departmentId: "", name: "", description: "", color: "indigo" });
    } catch {
      // Handled by hook toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deptToDelete) return;
    try {
      setIsDeleting(true);
      await deleteDepartment(deptToDelete._id, deptToDelete.name);
      setDeptToDelete(null);
    } catch {
      // Handled by hook toast
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Top Header & Global Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="page-title">Department</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
              <Building2 className="w-3.5 h-3.5" />
              Organization Hierarchy
            </span>
          </div>
          <p className="page-subtitle">
            Configure enterprise units, assign custom Department IDs, structure organizational branches, and maintain company rosters.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAddModal}
            className="btn-primary inline-flex items-center justify-center gap-2 text-xs sm:text-sm py-2.5 px-4 shadow-sm cursor-pointer self-start sm:self-auto hover:shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Department</span>
          </button>
        )}
      </div>

      {/* 4 Metric Cards Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Departments</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{totalDepartments}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Active organizational units</span>
        </div>

        <div className="card p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Employees</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{totalAssignedStaff}</p>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">Workforce across all units</span>
        </div>

        <div className="card p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Core Units</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{systemDefaultsCount}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Default pre-configured units</span>
        </div>

        <div className="card p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom Created</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{customDeptsCount}</p>
          <span className="text-[11px] text-purple-600 font-medium mt-1 block">Admin-defined company units</span>
        </div>
      </div>

      {/* Main Content Layout: Two-Column Operational Split to Eliminate Negative Space */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Primary Column: Departments Directory (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Controls Bar: Search, Count & View Toggle */}
          <div className="card p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200/80 shadow-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by ID, name, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800"
              />
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80 shrink-0">
                {filteredDepartments.length} {filteredDepartments.length === 1 ? "Department" : "Departments"}
              </span>
            </div>
          </div>

          {/* Directory Content */}
          {loading ? (
            <div className="card p-16 flex flex-col items-center justify-center gap-3 bg-white border border-slate-200/80">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-medium text-slate-500">Loading department directory...</p>
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="card p-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No departments match your query</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? `No department found for "${searchTerm}". Try clearing your search.`
                  : "No departments created yet. Click 'Add New Department' above."}
              </p>
            </div>
          ) : (
            /* DETAILED TABLE VIEW */
            <div className="card overflow-hidden bg-white border border-slate-200/80 shadow-xs rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[620px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 whitespace-nowrap">Dept ID</th>
                      <th className="py-3 px-4 whitespace-nowrap">Department Name</th>
                      <th className="py-3 px-4 whitespace-nowrap">Roles & Positions</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap">Staff Count</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredDepartments.map((dept) => {
                      const colorCfg = getColorConfig(dept.color);
                      const employeeCount = dept.employeeCount || 0;
                      const hasAssignedEmployees = employeeCount > 0;
                      const positions = dept.positions || [];

                      return (
                        <tr key={dept._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 text-[11px]">
                              {dept.departmentId || "DEP-N/A"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${colorCfg.dot}`} />
                              <div>
                                <span className="font-extrabold text-slate-900 block">{dept.name}</span>
                                <span className="text-[11px] text-slate-500 line-clamp-1">{dept.description}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {positions.length > 0 ? (
                                positions.slice(0, 2).map((p, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                                    {p}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">None</span>
                              )}
                              {positions.length > 2 && (
                                <span className="px-1 py-0.5 text-slate-400 text-[10px]">+{positions.length - 2}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                hasAssignedEmployees
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-50 text-slate-500 border border-slate-200"
                              }`}
                            >
                              <Users className="w-3 h-3" />
                              {employeeCount}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {isAdmin && (
                                <button
                                  onClick={() => handleOpenEditModal(dept)}
                                  className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                  title="Edit department"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <Link
                                to={`/employees?department=${encodeURIComponent(dept.name)}`}
                                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                title="View employees"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                              {isAdmin && (
                                <button
                                  onClick={() => setDeptToDelete(dept)}
                                  disabled={hasAssignedEmployees}
                                  className={`p-1 rounded-md ${
                                    hasAssignedEmployees
                                      ? "text-slate-300 cursor-not-allowed"
                                      : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  }`}
                                  title={hasAssignedEmployees ? "Cannot delete with active staff" : "Delete department"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Organization Intelligence & Insights Sidebar (4 Cols - Completely covers negative space!) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card 1: Workforce Distribution across Departments */}
          <div className="card p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Workforce Share</h3>
                  <p className="text-[11px] text-slate-500">Distribution across active units</p>
                </div>
              </div>
              <span className="text-xs font-black text-slate-800">{totalAssignedStaff} total</span>
            </div>

            <div className="space-y-3">
              {departments.map((d) => {
                const count = d.employeeCount || 0;
                const pct = totalAssignedStaff > 0 ? Math.round((count / totalAssignedStaff) * 100) : 0;
                const colorCfg = getColorConfig(d.color);

                return (
                  <div key={d._id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span className={`w-2 h-2 rounded-full ${colorCfg.dot}`} />
                        <span className="truncate max-w-[130px]">{d.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">({d.departmentId})</span>
                      </div>
                      <span className="text-slate-600 font-semibold text-[11px]">
                        {count} ({pct}%)
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colorCfg.dot} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Connected Modules Shortcuts */}
          <div className="card p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
              Connected Modules
            </span>

            <Link
              to="/employees"
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-200"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-indigo-600 transition-colors">
                    Employee Directory
                  </span>
                  <span className="text-[10px] text-slate-400">Assign members to departments</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <Link
              to="/authorization"
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-200"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-emerald-600 transition-colors">
                    Authorization Hub
                  </span>
                  <span className="text-[10px] text-slate-400">Delegate manager approvals per unit</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT DEPARTMENT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingDept ? "Edit Department" : "Add New Department"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingDept ? "Update department metadata and code" : "Create a new organizational branch with custom ID"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingDept(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDepartment} className="mt-5 space-y-4">
              {/* Department ID Field (Admin Specified) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Department ID / Code <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. DEP-01, SALES-01, HR-01"
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value.toUpperCase() })}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-900 uppercase"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Unique enterprise code given by Admin. Automatically formatted in uppercase.
                </span>
              </div>

              {/* Department Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Department Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Human Resources, Research & Development..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium text-slate-900"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of department responsibilities..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-700 resize-none"
                />
              </div>

              {/* Theme Color Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Badge Theme Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_OPTIONS.map((c) => {
                    const isSelected = formData.color === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c.value })}
                        className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? `${c.bg} ${c.text} ${c.border} ring-2 ring-indigo-500/30`
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`} />
                        <span className="truncate text-[11px]">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Live Tag Preview
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-900 text-white font-bold">
                    {formData.departmentId.trim().toUpperCase() || "DEP-ID"}
                  </span>
                  {(() => {
                    const previewColor = getColorConfig(formData.color);
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${previewColor.bg} ${previewColor.text} border ${previewColor.border}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${previewColor.dot}`} />
                        {formData.name.trim() || "Department Name"}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingDept(null);
                  }}
                  className="btn-secondary text-xs sm:text-sm py-2.5 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.name.trim() || !formData.departmentId.trim()}
                  className="btn-primary text-xs sm:text-sm py-2.5 px-5 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingDept ? "Update Department" : "Save Department"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Department</h3>
                <p className="text-xs text-slate-500">Confirm removal of organizational unit</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete the department{" "}
              <strong className="text-slate-900 font-bold">"{deptToDelete.name}"</strong> (ID:{" "}
              <code className="font-mono font-bold text-slate-800">{deptToDelete.departmentId}</code>)?
              Once deleted, it will no longer appear in employee creation dropdowns or attendance filters.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeptToDelete(null)}
                disabled={isDeleting}
                className="btn-secondary text-xs sm:text-sm py-2.5 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="btn-danger text-xs sm:text-sm py-2.5 px-5 flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-md shadow-rose-600/20"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Departments;
