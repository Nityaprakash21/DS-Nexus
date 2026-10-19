import React, { useEffect, useState } from "react";
import {
  Award,
  ShieldAlert,
  Printer,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  IndianRupee,
  User,
  ShieldCheck,
  Building2,
  FileCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { getMyScorecard } from "../api/kpaApi";
import type { KpaEvaluation, AppraisalCycle, AdminDeduction } from "../api/kpaApi";

const KpaScorecard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState<KpaEvaluation | null>(null);
  const [cycle, setCycle] = useState<AppraisalCycle | null>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [deductions, setDeductions] = useState<AdminDeduction[]>([]);

  useEffect(() => {
    const fetchScorecard = async () => {
      try {
        setLoading(true);
        const data = await getMyScorecard();
        if (data.success) {
          setEvaluation(data.evaluation);
          setCycle(data.cycle);
          setEmployee(data.employee);
          setDeductions(data.deductions || []);
        }
      } catch (err: any) {
        console.error(err);
        toast.error("Could not load performance scorecard");
      } finally {
        setLoading(false);
      }
    };
    fetchScorecard();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
          <Award className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">No Evaluation Published Yet</h2>
        <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
          Your manager has not published the official performance evaluation for {cycle?.yearLabel || "the current cycle"}. Please check back once the evaluation window is completed.
        </p>
      </div>
    );
  }

  const isApproved = evaluation.status === "APPROVED";
  const currentSalary = evaluation.currentBasicSalary || employee?.basicSalary || 0;
  const revisedSalary = evaluation.revisedBasicSalary > 0
    ? evaluation.revisedBasicSalary
    : Math.round(currentSalary * (1 + (evaluation.finalAppraisalPercentage || 0) / 100));
  const incrementDelta = Math.max(0, revisedSalary - currentSalary);

  return (
    <div className="w-full space-y-6">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Award className="w-7 h-7 text-indigo-600" />
            Performance & Appraisal Scorecard
          </h1>
          <p className="text-xs text-slate-500">
            Official annual performance assessment & salary increment report for {cycle?.yearLabel || "FY 2025-2026"}
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-all hover:shadow-md"
        >
          <Printer className="w-4 h-4" />
          Print / Export Appraisal Letter
        </button>
      </div>

      {/* Main Full-Width Printable Scorecard Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden printable-area">
        {/* Certificate / Letter Top Header Banner */}
        <div className="bg-linear-to-r from-indigo-50/90 via-white to-indigo-50/40 p-6 sm:p-8 text-slate-800 border-b border-indigo-100/90">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-700 bg-indigo-100/80 px-3 py-1 rounded-full border border-indigo-200/80 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Official Appraisal Assessment
                </span>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {cycle?.yearLabel || "FY 2025-2026"}
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {employee?.firstName} {employee?.lastName}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-600 font-medium pt-0.5">
                  <span className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    {employee?.position || "Team Member"}
                  </span>
                  <span className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    {employee?.department || "Operations"} Department
                  </span>
                </div>
              </div>
            </div>

            {/* Right Side Final Appraisal Rate Pill */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm min-w-64">
              <div className="text-left lg:text-right">
                <p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Approved Increment Rate</p>
                <p className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight mt-0.5">
                  +{evaluation.finalAppraisalPercentage?.toFixed(2)}%
                </p>
              </div>
              <div className="w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex items-center justify-between lg:justify-end gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${isApproved
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isApproved ? "Approved & Finalized" : "Under Final Calibration"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-8">
          {/* Key Metric Strip Cards (Full Width Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Weighted KPA Score</span>
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {evaluation.rawWeightedScore?.toFixed(2)} <span className="text-sm font-semibold text-slate-400">/ 5.0</span>
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Weighted sum across all KPAs</p>
            </div>

            <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Admin Deductions</span>
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
              <p className={`text-2xl sm:text-3xl font-extrabold ${evaluation.totalDeductions > 0 ? "text-rose-600" : "text-slate-800"}`}>
                {evaluation.totalDeductions > 0 ? `-${evaluation.totalDeductions?.toFixed(2)}` : "0.00"}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Verified SOP & compliance marks</p>
            </div>

            <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Company Growth Cap</span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
                {evaluation.businessGrowthCap}%
              </p>
              <p className="text-[11px] text-slate-500 font-medium">Annual YoY business expansion cap</p>
            </div>

            <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Revised Monthly Basic</span>
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-indigo-700">
                ₹{revisedSalary.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                {currentSalary > 0 ? `from ₹${currentSalary.toLocaleString()}` : "Base salary updated"}
              </p>
            </div>
          </div>

          {/* Detailed KPA Performance Breakdown Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Individual Key Performance Area (KPA) Ratings
                </h3>
                <p className="text-xs text-slate-500">
                  Detailed evaluation breakdown across operational quality and business targets
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                Total Weight: 100%
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-2xs">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-5">Performance Area</th>
                    <th className="py-3.5 px-4 text-center">Weight</th>
                    <th className="py-3.5 px-4 text-center">Assigned Score</th>
                    <th className="py-3.5 px-4 text-center">Achievement</th>
                    <th className="py-3.5 px-5">Evaluator Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evaluation.ratings?.map((r) => {
                    const achievementPct = ((r.score / 5.0) * 100).toFixed(0);
                    return (
                      <tr key={r.metricId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-5 font-bold text-slate-900">
                          {r.title}
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-slate-600">
                          <span className="bg-slate-100 px-2.5 py-1 rounded-md text-xs font-bold">
                            {r.weight}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 text-xs sm:text-sm">
                            {r.score.toFixed(1)} / 5.0
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-slate-700">
                          {achievementPct}%
                        </td>
                        <td className="py-4 px-5 text-slate-600 text-xs sm:text-sm italic leading-relaxed">
                          {r.remarks || "Performance verified within target benchmarks."}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compliance & Quality Deductions (if any) or Clean Record Badge */}
          {deductions.length > 0 ? (
            <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
              <h4 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Compliance & Quality Deductions Applied
              </h4>
              <div className="space-y-2">
                {deductions.map((d) => (
                  <div key={d._id} className="text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-rose-800 bg-white p-3 rounded-xl border border-rose-100 shadow-2xs">
                    <div>
                      <span className="font-bold text-rose-900">{d.reasonCategory.replace(/_/g, " ")}: </span>
                      <span>{d.reasonDetails}</span>
                    </div>
                    <span className="self-start sm:self-center font-extrabold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200 shrink-0">
                      -{d.deductionScore.toFixed(2)} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-4 text-emerald-950">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900">Zero Compliance Deductions</p>
                  <p className="text-xs text-emerald-700">Flawless operational quality and adherence maintained with zero disciplinary penalties.</p>
                </div>
              </div>
              <span className="hidden sm:inline-block px-3 py-1 bg-white text-emerald-700 font-bold rounded-lg border border-emerald-200 text-xs shadow-2xs">
                Clean Audit Trail
              </span>
            </div>
          )}

          {/* Evaluator Remarks & Compensation Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Growth Feedback */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600" />
                  Manager's Growth Remarks & Feedback
                </p>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic mt-2">
                  "{evaluation.evaluatorFeedback || "Consistently demonstrated strong alignment with operational benchmarks and company growth goals throughout this financial cycle."}"
                </p>
              </div>
              <div className="pt-3 border-t border-slate-200 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Evaluator Role: Management / Operations Head</span>
                <span>Audit Verified</span>
              </div>
            </div>

            {/* Right: Salary Increment Summary Card */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-linear-to-br from-indigo-50/80 via-white to-indigo-50/40 border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                  <IndianRupee className="w-4 h-4 text-indigo-600" />
                  Salary Revision Impact
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Approved
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1 text-center">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Previous Basic</p>
                  <p className="text-sm sm:text-base font-bold text-slate-800 mt-0.5">₹{currentSalary.toLocaleString()}</p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Increment Rate</p>
                  <p className="text-sm sm:text-base font-bold text-emerald-600 mt-0.5">+{evaluation.finalAppraisalPercentage?.toFixed(2)}%</p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Net Addition</p>
                  <p className="text-sm sm:text-base font-bold text-indigo-600 mt-0.5">+₹{incrementDelta.toLocaleString()}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-600 text-white flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-[10px] text-indigo-100 uppercase font-semibold">New Effective Basic Monthly Salary</p>
                  <p className="text-lg font-extrabold text-white">₹{revisedSalary.toLocaleString()}</p>
                </div>
                <CheckCircle2 className="w-6 h-6 text-indigo-200" />
              </div>
            </div>
          </div>

          {/* Full-Width Formula Calculation Breakdown */}
          <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs sm:text-sm text-indigo-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-indigo-900">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Mathematical Appraisal Calculation Pipeline</span>
            </div>
            <p className="text-indigo-800 text-xs sm:text-sm font-semibold leading-relaxed pl-6">
              Final Appraisal % = (Net Score {(evaluation.netScore || 0).toFixed(2)} ÷ 5.0) × {evaluation.businessGrowthCap}% Business Growth Cap = +{evaluation.finalAppraisalPercentage?.toFixed(2)}%
            </p>
            <p className="text-[11.5px] text-indigo-600/90 pl-6">
              Calculated using: Raw Weighted Score ({evaluation.rawWeightedScore?.toFixed(2)}) - Admin Deductions ({(evaluation.totalDeductions || 0).toFixed(2)}) = Net Score {(evaluation.netScore || 0).toFixed(2)} out of 5.0.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KpaScorecard;
