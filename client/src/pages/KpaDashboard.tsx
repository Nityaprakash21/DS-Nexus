import React, { useState, useEffect } from "react";
import {
  Award,
  TrendingUp,
  ShieldAlert,
  Users,
  CheckCircle2,
  Calculator,
  FileSpreadsheet,
  Settings,
  Plus,
  RefreshCw,
  Search,
  Check,
  ShieldCheck,
  HelpCircle,
  IndianRupee,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getActiveCycle,
  updateActiveCycle,
  getKpaTemplates,
  getAllEvaluations,
  submitKpaEvaluation,
  createAdminDeduction,
  reverseAdminDeduction,
  approveAppraisal,
} from "../api/kpaApi";
import type { AppraisalCycle, KpaTemplate, KpaEvaluation, AdminDeduction } from "../api/kpaApi";
import api from "../api/axios";
import { useAuth } from "../../context/AuthContext";
import KpaSimulator from "../components/KpaSimulator";

interface EmployeeOption {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  position: string;
  basicSalary: number;
}

const KpaDashboard: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [activeTab, setActiveTab] = useState<"overview" | "evaluate" | "deductions" | "templates" | "simulator">("overview");
  const [loading, setLoading] = useState(true);

  // Core State
  const [cycle, setCycle] = useState<AppraisalCycle | null>(null);
  const [templates, setTemplates] = useState<KpaTemplate[]>([]);
  const [evaluations, setEvaluations] = useState<KpaEvaluation[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [recentDeductions, setRecentDeductions] = useState<AdminDeduction[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("ALL");

  // Cycle Edit Modal
  const [isEditingCycle, setIsEditingCycle] = useState(false);
  const [growthInput, setGrowthInput] = useState(15);
  const [cycleYearInput, setCycleYearInput] = useState("");

  // Evaluation Form State
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [ratingsState, setRatingsState] = useState<Record<string, { score: number; remarks: string }>>({});
  const [evaluatorFeedback, setEvaluatorFeedback] = useState("");
  const [submittingEval, setSubmittingEval] = useState(false);

  // Deduction Form State
  const [deductionEmpId, setDeductionEmpId] = useState("");
  const [deductionScore, setDeductionScore] = useState(0.3);
  const [reasonCategory, setReasonCategory] = useState("DATA_ENTRY_ERROR");
  const [reasonDetails, setReasonDetails] = useState("");
  const [submittingDeduction, setSubmittingDeduction] = useState(false);

  // Load All Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [cycleData, templatesData, evalData, empRes] = await Promise.all([
        getActiveCycle(),
        getKpaTemplates(),
        isAdmin ? getAllEvaluations().catch(() => ({ evaluations: [] })) : Promise.resolve({ evaluations: [] }),
        api.get("/employees").catch(() => ({ data: [] })),
      ]);

      if (cycleData) {
        setCycle(cycleData);
        setGrowthInput(cycleData.yoyBusinessGrowthPercentage || 15);
        setCycleYearInput(cycleData.yearLabel || "");
      }
      if (templatesData) setTemplates(templatesData);
      if (evalData && "evaluations" in evalData) setEvaluations(evalData.evaluations);
      if (empRes?.data) {
        const activeEmps = empRes.data.filter((e: any) => !e.isDeleted);
        setEmployees(activeEmps);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load KPA data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update Evaluation form when employee or template is selected
  useEffect(() => {
    if (selectedTemplateId) {
      const tmpl = templates.find((t) => t._id === selectedTemplateId);
      if (tmpl) {
        const initialRatings: Record<string, { score: number; remarks: string }> = {};
        tmpl.metrics.forEach((m) => {
          initialRatings[m.id] = { score: 4.0, remarks: "" };
        });
        setRatingsState(initialRatings);
      }
    }
  }, [selectedTemplateId, templates]);

  // Handle employee selection in evaluator
  const handleSelectEmployee = (empId: string) => {
    setSelectedEmpId(empId);
    const emp = employees.find((e) => e._id === empId);
    if (emp) {
      // Auto-suggest template based on department
      const match = templates.find((t) => t.applicableDepartments?.includes(emp.department));
      if (match) {
        setSelectedTemplateId(match._id);
      } else if (templates.length > 0) {
        setSelectedTemplateId(templates[0]._id);
      }
    }
  };

  // Submit Evaluation
  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !selectedTemplateId) {
      toast.error("Please select an employee and KPA template");
      return;
    }

    const currentTmpl = templates.find((t) => t._id === selectedTemplateId);
    if (!currentTmpl) return;

    const formattedRatings = currentTmpl.metrics.map((m) => ({
      metricId: m.id,
      title: m.title,
      weight: m.weight,
      score: ratingsState[m.id]?.score ?? 3,
      remarks: ratingsState[m.id]?.remarks || "",
    }));

    try {
      setSubmittingEval(true);
      await submitKpaEvaluation({
        employeeId: selectedEmpId,
        templateId: selectedTemplateId,
        teamKey: currentTmpl.teamKey,
        ratings: formattedRatings,
        evaluatorFeedback,
      });

      toast.success("Evaluation submitted and growth cap calculated successfully!");
      setSelectedEmpId("");
      setEvaluatorFeedback("");
      await loadData();
      setActiveTab("overview");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to submit evaluation");
    } finally {
      setSubmittingEval(false);
    }
  };

  // Submit Deduction
  const handleSubmitDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductionEmpId || !reasonDetails) {
      toast.error("Please fill all required deduction fields");
      return;
    }

    try {
      setSubmittingDeduction(true);
      const newDeduction = await createAdminDeduction({
        employeeId: deductionEmpId,
        cycleYear: cycle?.yearLabel || "FY 2025-2026",
        deductionScore: Number(deductionScore),
        reasonCategory,
        reasonDetails,
      });

      toast.success("Admin deduction recorded. All connected appraisals recalculated!");
      setRecentDeductions((prev) => [newDeduction, ...prev]);
      setDeductionEmpId("");
      setReasonDetails("");
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to record deduction");
    } finally {
      setSubmittingDeduction(false);
    }
  };

  // Reverse Deduction
  const handleReverseDeduction = async (deductionId: string) => {
    try {
      await reverseAdminDeduction(deductionId, "Reversed by admin review");
      toast.success("Deduction reversed and appraisals recalculated!");
      setRecentDeductions((prev) =>
        prev.map((d) => (d._id === deductionId ? { ...d, status: "REVERSED" } : d))
      );
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to reverse deduction");
    }
  };

  // Approve Appraisal & Update Salary
  const handleApproveAppraisal = async (evalId: string, applySalary: boolean) => {
    try {
      const res = await approveAppraisal(evalId, applySalary);
      toast.success(res.message);
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to approve appraisal");
    }
  };

  // Update Cycle Growth Cap
  const handleSaveCycle = async () => {
    if (!cycle) return;
    try {
      await updateActiveCycle(cycle._id, {
        yearLabel: cycleYearInput,
        yoyBusinessGrowthPercentage: Number(growthInput),
      });
      toast.success("Appraisal cycle & Growth Cap % updated!");
      setIsEditingCycle(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update cycle");
    }
  };

  // Distinct departments
  const uniqueDepartments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));

  // Filtered evaluations
  const filteredEvaluations = evaluations.filter((ev) => {
    const fullName = `${ev.employeeId?.firstName || ""} ${ev.employeeId?.lastName || ""}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || ev.employeeId?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = filterDepartment === "ALL" || ev.employeeId?.department === filterDepartment;
    return matchesSearch && matchesDept;
  });

  // Aggregated Stats
  const totalEvaluated = evaluations.length;
  const avgScore = totalEvaluated > 0
    ? (evaluations.reduce((sum, e) => sum + (e.netScore || 0), 0) / totalEvaluated).toFixed(2)
    : "0.00";
  const totalPayrollImpact = evaluations
    .filter((e) => e.status === "APPROVED")
    .reduce((sum, e) => sum + Math.max(0, (e.revisedBasicSalary || 0) - (e.currentBasicSalary || 0)), 0);

  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-linear-to-r from-indigo-50/90 via-white to-indigo-50/40 border border-indigo-100/80 rounded-2xl p-6 text-slate-800 shadow-xs relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs shadow-indigo-600/20">
                <Award className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">KPA & Growth-Capped Appraisal System</h1>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Connect team performance directly to your investment business growth. Ratings are scored out of 5.0, adjusted for compliance deductions, and capped by your YoY growth rate.
            </p>
          </div>

          {/* Cycle & Cap Card */}
          <div className="self-end md:self-auto flex items-center gap-3.5 bg-white border border-slate-200/80 rounded-xl p-3 px-4 shadow-xs">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {cycle?.yearLabel || "Current Cycle"}
              </p>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="text-xs text-slate-600 font-medium">YoY Growth Cap:</span>
                <span className="text-lg font-extrabold text-emerald-600">
                  {cycle?.yoyBusinessGrowthPercentage ?? 15}%
                </span>
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsEditingCycle(true)}
                className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 border border-indigo-200/80 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 shadow-2xs"
                title="Edit Growth Cap"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit Cycle Modal */}
      {isEditingCycle && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full text-slate-800 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Set Annual Business Growth Cap
            </h3>
            <p className="text-xs text-slate-500">
              The YoY growth percentage caps the maximum possible appraisal increment for top performers (Score 5/5).
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Fiscal Year Label</label>
                <input
                  type="text"
                  value={cycleYearInput}
                  onChange={(e) => setCycleYearInput(e.target.value)}
                  placeholder="e.g. FY 2025-2026"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">YoY Business Growth % (Cap)</label>
                <input
                  type="number"
                  step="0.5"
                  value={growthInput}
                  onChange={(e) => setGrowthInput(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-emerald-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsEditingCycle(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCycle}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-600/30 transition-colors"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Evaluated Staff</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalEvaluated} <span className="text-xs font-normal text-slate-500">/ {employees.length}</span></p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Growth Cap</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{cycle?.yoyBusinessGrowthPercentage ?? 15}%</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Net Score</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{avgScore} <span className="text-xs font-normal text-slate-500">/ 5.0</span></p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Approved Payroll Delta</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">₹{totalPayrollImpact.toLocaleString()}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`py-3.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === "overview"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Appraisal Summary ({evaluations.length})
        </button>

        <button
          onClick={() => setActiveTab("evaluate")}
          className={`py-3.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === "evaluate"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
        >
          <Plus className="w-4 h-4" />
          Rate & Evaluate Staff
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab("deductions")}
            className={`py-3.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === "deductions"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Admin Deductions
          </button>
        )}

        <button
          onClick={() => setActiveTab("templates")}
          className={`py-3.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === "templates"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
        >
          <ShieldCheck className="w-4 h-4" />
          KPA Framework Rubrics
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={`py-3.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === "simulator"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
        >
          <Calculator className="w-4 h-4 text-indigo-500" />
          Interactive Simulator
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: APPRAISAL OVERVIEW & GRID                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "overview" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">Evaluations & Growth-Capped Results</h2>
              <p className="text-xs text-slate-500">
                Formula: Final Appraisal % = (Net Score ÷ 5.0) × {cycle?.yoyBusinessGrowthPercentage ?? 15}% Growth Cap
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Department Filter */}
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Departments</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 w-48 sm:w-56"
                />
              </div>

              <button
                onClick={loadData}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {filteredEvaluations.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">No evaluations submitted yet for this cycle</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Switch to the "Rate & Evaluate Staff" tab to evaluate an employee across the 40/30/30 KPA metrics.
              </p>
              <button
                onClick={() => setActiveTab("evaluate")}
                className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-xs hover:bg-indigo-700 transition-colors"
              >
                Start Evaluation
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Raw Score (5.0)</th>
                    <th className="py-3 px-4 text-center">Admin Deductions</th>
                    <th className="py-3 px-4 text-center">Net Score</th>
                    <th className="py-3 px-4 text-center bg-indigo-50/50 text-indigo-700">Final Appraisal %</th>
                    <th className="py-3 px-4 text-right">Revised Basic</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    {isAdmin && <th className="py-3 px-4 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEvaluations.map((ev) => {
                    const emp = ev.employeeId;
                    const isApproved = ev.status === "APPROVED";
                    return (
                      <tr key={ev._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800">
                            {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
                          </p>
                          <p className="text-[11px] text-slate-400">{emp?.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                            {emp?.department || "Operations"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-slate-700">
                          {ev.rawWeightedScore?.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {ev.totalDeductions > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 font-bold border border-rose-100">
                              -{ev.totalDeductions.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-400">0.00</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-900">
                          {ev.netScore?.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center bg-indigo-50/30">
                          <span className="text-sm font-extrabold text-indigo-600">
                            {ev.finalAppraisalPercentage?.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <p className="font-bold text-emerald-600">₹{ev.revisedBasicSalary?.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400">from ₹{ev.currentBasicSalary?.toLocaleString()}</p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${isApproved
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                          >
                            {ev.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-center">
                            {!isApproved ? (
                              <button
                                onClick={() => handleApproveAppraisal(ev._id, true)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-semibold transition-colors shadow-xs"
                              >
                                Approve & Sync
                              </button>
                            ) : (
                              <span className="text-[11px] text-emerald-600 font-medium flex items-center justify-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Payroll Synced
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: RATE & EVALUATE STAFF FORM                             */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "evaluate" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-800">Performance Evaluation & Scoring Portal</h2>
            <p className="text-xs text-slate-500">
              Score employees on a 1.0 to 5.0 scale. The live system will automatically compute the weighted score and apply the growth cap.
            </p>
          </div>

          <form onSubmit={handleSubmitEvaluation} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Select Employee to Evaluate *</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName} ({emp.department} • {emp.position})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">KPA Template *</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose KPA Template --</option>
                  {templates.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.teamName} ({t.metrics.map((m) => `${m.weight}%`).join(" + ")})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Template Metrics Scoring Section */}
            {selectedTemplate && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 text-xs text-indigo-900">
                  <p className="font-semibold text-indigo-950">{selectedTemplate.teamName}</p>
                  <p className="text-[11px] text-indigo-700 mt-0.5">{selectedTemplate.targetDescription}</p>
                </div>

                <div className="space-y-4">
                  {selectedTemplate.metrics.map((metric, idx) => {
                    const currentVal = ratingsState[metric.id]?.score ?? 4.0;
                    const roundedScoreKey = Math.min(5, Math.max(1, Math.round(currentVal))) as 1 | 2 | 3 | 4 | 5;
                    const rubricText = metric.rubric?.[roundedScoreKey] || "";

                    return (
                      <div key={metric.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-slate-800">
                              KPA {idx + 1}: {metric.title}
                            </span>
                            <span className="ml-2 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              Weight: {metric.weight}%
                            </span>
                            <p className="text-[11px] text-slate-500 mt-0.5">{metric.description}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">Score:</span>
                            <span className="text-sm font-extrabold text-indigo-600 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                              {currentVal.toFixed(1)} / 5.0
                            </span>
                          </div>
                        </div>

                        {/* Slider */}
                        <div className="space-y-1">
                          <input
                            type="range"
                            min="1.0"
                            max="5.0"
                            step="0.1"
                            value={currentVal}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setRatingsState((prev) => ({
                                ...prev,
                                [metric.id]: {
                                  score: val,
                                  remarks: prev[metric.id]?.remarks || "",
                                },
                              }));
                            }}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                            <span>1.0 Subpar</span>
                            <span>2.0 Needs Impr.</span>
                            <span>3.0 Meets Standard</span>
                            <span>4.0 Exceeds Standard</span>
                            <span>5.0 Outstanding</span>
                          </div>
                        </div>

                        {/* Dynamic Rubric Benchmark Card */}
                        {rubricText && (
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 flex items-start gap-2">
                            <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-slate-800">
                                Benchmark for Score {roundedScoreKey}:{" "}
                              </span>
                              <span>{rubricText}</span>
                            </div>
                          </div>
                        )}

                        {/* Remarks */}
                        <div>
                          <input
                            type="text"
                            placeholder="Optional evaluator remarks for this KPA..."
                            value={ratingsState[metric.id]?.remarks || ""}
                            onChange={(e) => {
                              const text = e.target.value;
                              setRatingsState((prev) => ({
                                ...prev,
                                [metric.id]: {
                                  score: prev[metric.id]?.score ?? 4.0,
                                  remarks: text,
                                },
                              }));
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Overall Feedback */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Overall Evaluator Feedback & Growth Recommendations
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter summary remarks on overall annual contribution..."
                    value={evaluatorFeedback}
                    onChange={(e) => setEvaluatorFeedback(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEmpId("")}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    Reset Form
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEval}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition-colors flex items-center gap-2"
                  >
                    {submittingEval ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Submit & Compute Appraisal
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: ADMIN DEDUCTIONS & COMPLIANCE                          */}
      {/* ------------------------------------------------------------- */}
      {isAdmin && activeTab === "deductions" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Log Deduction Form */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-7 flex flex-col justify-between space-y-5">
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                  Record Disciplinary Deduction
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Directly deduct marks from final performance score for verified SOP, AMC rejection, or KYC errors.
                </p>
              </div>

              <form onSubmit={handleSubmitDeduction} className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Select Employee *
                    </label>
                    <select
                      value={deductionEmpId}
                      onChange={(e) => setDeductionEmpId(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="">-- Choose Employee --</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.firstName} {emp.lastName} ({emp.department})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Deduction Marks (0.1 to 5.0) *
                      </label>
                      <div className="flex items-center gap-1">
                        {[0.1, 0.25, 0.5, 1.0].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setDeductionScore(preset)}
                            className={`px-2 py-0.5 text-[10.5px] font-bold rounded-md transition-colors ${deductionScore === preset
                                ? "bg-rose-600 text-white shadow-2xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                          >
                            -{preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0.05"
                      max="5.0"
                      step="0.05"
                      value={deductionScore}
                      onChange={(e) => setDeductionScore(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-rose-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Standard scale: 0.10–0.25 (minor error) to 0.75–1.50 (major compliance breach).
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Reason Category *
                    </label>
                    <select
                      value={reasonCategory}
                      onChange={(e) => setReasonCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="DATA_ENTRY_ERROR">Data Entry / Punching Error</option>
                      <option value="AMC_REJECTION">AMC Mutual Fund Rejection</option>
                      <option value="SEBI_AMFI_COMPLIANCE_BREACH">SEBI / AMFI Compliance Breach</option>
                      <option value="SOP_VIOLATION">SOP Violation / Document Delay</option>
                      <option value="CLIENT_COMPLAINT">Client Grievance / Service Escalation</option>
                      <option value="ATTENDANCE_BREACH">Unexcused SLA / Attendance Breach</option>
                      <option value="DISCIPLINARY">General Disciplinary</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Incident Details & Evidence *
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Specific transaction ID, AMC name, client folio, or incident date for the audit record..."
                      value={reasonDetails}
                      onChange={(e) => setReasonDetails(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submittingDeduction}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    {submittingDeduction ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Logging Deduction...
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4" />
                        Apply Deduction & Recalculate
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Deduction Policy Explanation */}
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-5">
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  Standard Disciplinary Deduction Policy
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Disciplinary marks are directly subtracted from the employee's weighted performance score (out of 5.0) before applying the annual YoY Business Growth Cap.
                </p>
              </div>

              <div className="space-y-3.5 flex-1">
                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-slate-900">1. Minor Data Entry & KYC Rectification</p>
                    <p className="text-xs text-slate-500 leading-normal">
                      Non-fatal order punching errors or KYC discrepancies resolved within 24 hours without client impact.
                    </p>
                  </div>
                  <span className="self-start sm:self-center shrink-0 font-extrabold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200/80 text-xs sm:text-sm">
                    -0.10 to -0.20
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-slate-900">2. AMC Order Rejection & Cut-Off Breach</p>
                    <p className="text-xs text-slate-500 leading-normal">
                      Punching errors leading to AMC rejection or missed cut-off causing same-day NAV loss for the investor.
                    </p>
                  </div>
                  <span className="self-start sm:self-center shrink-0 font-extrabold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200/80 text-xs sm:text-sm">
                    -0.30 to -0.50
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-slate-900">3. Client Grievance & Service Escalation</p>
                    <p className="text-xs text-slate-500 leading-normal">
                      Verified complaints regarding field service delays, uncollected physical mandates, or unpunctual client visits.
                    </p>
                  </div>
                  <span className="self-start sm:self-center shrink-0 font-extrabold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200/80 text-xs sm:text-sm">
                    -0.35 to -0.60
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-slate-900">4. SEBI / AMFI Statutory Compliance Breach</p>
                    <p className="text-xs text-slate-500 leading-normal">
                      Missing physical/digital mandates, audit non-conformances, or unauthorized regulatory non-compliance.
                    </p>
                  </div>
                  <span className="self-start sm:self-center shrink-0 font-extrabold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200/80 text-xs sm:text-sm">
                    -0.75 to -1.50
                  </span>
                </div>
              </div>

              {/* Bottom Governance Notice */}
              <div className="p-4 rounded-xl bg-indigo-50/90 border border-indigo-100/90 text-xs text-indigo-950 space-y-1">
                <div className="flex items-center gap-2 font-bold text-indigo-900">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Fairness & Audit Trail Governance</span>
                </div>
                <p className="text-indigo-800 text-[11.5px] leading-relaxed pl-6">
                  All penalties require documented evidence and are permanently logged with the Administrator's ID. Deductions can be reversed at any time if verified as an external AMC technical glitch, automatically restoring the employee's appraisal calculation.
                </p>
              </div>
            </div>
          </div>

          {/* Recent Deductions Audit Table */}
          {recentDeductions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Recent Deductions Log</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3 text-center">Score Penalty</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentDeductions.map((d) => (
                      <tr key={d._id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {d.reasonCategory.replace(/_/g, " ")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{d.reasonDetails}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-rose-600">
                          -{d.deductionScore.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${d.status === "ACTIVE"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-slate-100 text-slate-500 line-through"
                              }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {d.status === "ACTIVE" && (
                            <button
                              onClick={() => handleReverseDeduction(d._id)}
                              className="px-2 py-1 text-[11px] text-indigo-600 hover:bg-indigo-50 rounded flex items-center gap-1 mx-auto"
                            >
                              <RotateCcw className="w-3 h-3" /> Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: TEMPLATES & RUBRICS                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
            <h2 className="text-base font-bold text-slate-800">Team-Wise KPA Framework & Weightings</h2>
            <p className="text-xs text-slate-500">
              Pre-configured KPA benchmarks specifically built for Investment & Mutual Fund operations.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              {templates.map((template) => (
                <div
                  key={template._id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wider">
                        {template.teamKey}
                      </span>
                      <span className="text-xs font-extrabold text-slate-700">100% Weight</span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">{template.teamName}</h3>
                    <p className="text-xs text-slate-500">{template.targetDescription}</p>

                    <div className="pt-2 border-t border-slate-200 space-y-2.5">
                      {template.metrics.map((m, idx) => (
                        <div key={m.id} className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-800">
                              {idx + 1}. {m.title}
                            </span>
                            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                              {m.weight}%
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">{m.description}</p>
                          <p className="text-[10px] text-slate-400 italic">Evaluator: {m.evaluatorRole}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: INTERACTIVE SIMULATOR                                  */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "simulator" && (
        <KpaSimulator defaultGrowthCap={cycle?.yoyBusinessGrowthPercentage ?? 15} />
      )}
    </div>
  );
};

export default KpaDashboard;
