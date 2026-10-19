import React, { useState } from "react";
import {
  Gauge,
  Clock,
  Award,
  ShieldCheck,
  TrendingUp,
  Zap,
  CheckCircle2,
  Search,
  UserCheck,
  Sparkles
} from "lucide-react";
import { useDepartments } from "../hooks/useDepartments";

export interface PunctualityTier {
  label: string;
  code: "EXEMPLARY" | "ON_TRACK" | "CALIBRATION" | "CRITICAL";
  color: "emerald" | "indigo" | "amber" | "rose";
}

export interface EmployeePunctualityItem {
  id: string;
  name: string;
  firstName?: string;
  department: string;
  position: string;
  score: number;
  onTimeRate: number;
  onTimeDays: number;
  lateDays: number;
  totalPunches: number;
  avgCheckInTime: string;
  deductions: number;
  tier: PunctualityTier;
}

export interface EmployeePunctualityData {
  score: number;
  onTimeRate: number;
  onTimeDays: number;
  lateDays: number;
  totalPunches: number;
  avgCheckInTime: string;
  kpaTatScore: number;
  deductionsApplied: number;
  tier: PunctualityTier;
}

export interface AdminPunctualityData {
  overallScore: number;
  totalPunches: number;
  totalLatePunches: number;
  avgCheckInTime: string;
  tier: PunctualityTier;
  employees: EmployeePunctualityItem[];
}

const getTierColorClasses = (color: string) => {
  switch (color) {
    case "emerald":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        bar: "bg-emerald-500",
        ring: "text-emerald-500",
      };
    case "indigo":
      return {
        bg: "bg-indigo-50",
        text: "text-indigo-700",
        border: "border-indigo-200",
        bar: "bg-indigo-500",
        ring: "text-indigo-500",
      };
    case "amber":
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
        bar: "bg-amber-500",
        ring: "text-amber-500",
      };
    case "rose":
    default:
      return {
        bg: "bg-rose-50",
        text: "text-rose-700",
        border: "border-rose-200",
        bar: "bg-rose-500",
        ring: "text-rose-500",
      };
  }
};

export const EmployeePunctualityMeter: React.FC<{ data?: EmployeePunctualityData }> = ({ data }) => {
  if (!data) return null;

  const score = data.score || 95.0;
  const tierColor = getTierColorClasses(data.tier?.color || "emerald");
  const strokeDashoffset = 251.2 - (251.2 * score) / 100;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Punctuality
              <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${tierColor.bg} ${tierColor.text} ${tierColor.border}`}>
                {data.tier?.label || "Exemplary"}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Live operational reliability calculated from your morning punches (60%) and KPA turnaround speed (40%)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          Formula: 60% Punch + 40% KPA SLA
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Animated Radial Progress Meter */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 bg-linear-to-b from-indigo-50/50 to-white rounded-2xl border border-indigo-100/70 text-center">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-slate-100"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className={`${tierColor.ring} transition-all duration-1000 ease-out`}
                strokeWidth="8"
                strokeDasharray="251.2"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {score.toFixed(1)}%
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Reliability</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 font-medium mt-2">
            Monthly Punctuality Index
          </p>
        </div>

        {/* Right: 4 Breakdown Metric Pills */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between hover:border-slate-300 transition-colors">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                On-Time Punch Rate
              </p>
              <p className="text-base font-bold text-slate-900">
                {data.onTimeRate}% <span className="text-xs font-normal text-slate-400">({data.onTimeDays}/{Math.max(1, data.totalPunches)} days)</span>
              </p>
            </div>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between hover:border-slate-300 transition-colors">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Avg Morning Check-In
              </p>
              <p className="text-base font-bold text-emerald-700">
                {data.avgCheckInTime || "09:20 AM"}
              </p>
            </div>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between hover:border-slate-300 transition-colors">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                KPA TAT / SLA Rating
              </p>
              <p className="text-base font-bold text-indigo-700">
                {data.kpaTatScore.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 5.0</span>
              </p>
            </div>
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between hover:border-slate-300 transition-colors">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                Delay Deductions
              </p>
              <p className={`text-base font-bold ${data.deductionsApplied > 0 ? "text-rose-600" : "text-slate-800"}`}>
                {data.deductionsApplied > 0 ? `-${data.deductionsApplied.toFixed(2)} pts` : "0.00 pts (Clean)"}
              </p>
            </div>
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminPunctualityMeter: React.FC<{ data?: AdminPunctualityData }> = ({ data }) => {
  const { departmentNames } = useDepartments();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");

  if (!data) return null;

  const employees = data.employees || [];
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === "ALL" || emp.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const overallScore = data.overallScore || 93.0;
  const overallTierColor = getTierColorClasses(data.tier?.color || "emerald");

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Employee Punctuality & SLA Ratings
              <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border ${overallTierColor.bg} ${overallTierColor.text} ${overallTierColor.border}`}>
                Org Avg: {overallScore.toFixed(1)}%
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Individual punctuality metrics calculated per employee from attendance punches (60%) and KPA turnaround speed (40%)
            </p>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 w-44"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {departmentNames.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Individual Employee Punctuality Grid */}
      {filteredEmployees.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
          No employees found matching filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((emp) => {
            const eColor = getTierColorClasses(emp.tier?.color || "emerald");
            return (
              <div
                key={emp.id}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:border-indigo-300 hover:shadow-2xs transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{emp.name}</h4>
                    <p className="text-[11px] text-slate-500">{emp.position}</p>
                    <span className="inline-block mt-1 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 rounded border border-slate-200">
                      {emp.department}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-slate-900 block leading-tight">
                      {emp.score.toFixed(1)}%
                    </span>
                    <span className={`text-[9.5px] uppercase font-extrabold px-2 py-0.5 rounded-full border inline-block mt-0.5 ${eColor.bg} ${eColor.text} ${eColor.border}`}>
                      {emp.tier?.label}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${eColor.bar} transition-all duration-500`}
                    style={{ width: `${Math.min(100, emp.score)}%` }}
                  />
                </div>

                {/* Sub-Metrics */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/70">
                  <div>
                    <span className="text-slate-400 block text-[10px]">On-Time Rate</span>
                    <span className="font-bold text-slate-700">{emp.onTimeRate}%</span>
                    <span className="text-slate-400 text-[10px]"> ({emp.onTimeDays}d)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Avg Punch</span>
                    <span className="font-bold text-emerald-700">{emp.avgCheckInTime}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Late Days</span>
                    <span className={`font-bold ${emp.lateDays > 0 ? "text-rose-600" : "text-slate-700"}`}>
                      {emp.lateDays}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Deductions</span>
                    <span className={`font-bold ${emp.deductions > 0 ? "text-rose-600" : "text-slate-700"}`}>
                      {emp.deductions > 0 ? `-${emp.deductions.toFixed(2)}` : "0.00"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
