import React, { useState } from "react";
import { Calculator, TrendingUp, ShieldAlert, Sparkles, IndianRupee } from "lucide-react";

interface Props {
  defaultGrowthCap?: number;
}

const PRESET_TEAMS = [
  {
    name: "Operations Team (In-Office)",
    metrics: [
      { id: "m1", title: "Processing Accuracy (AMC Zero-Rejection)", weight: 40, defaultScore: 4.5 },
      { id: "m2", title: "Turnaround Time (NAV Cut-off Deadlines)", weight: 30, defaultScore: 4.0 },
      { id: "m3", title: "Client Document & Compliance Filing", weight: 30, defaultScore: 4.5 },
    ],
  },
  {
    name: "Outside Service & Product Team",
    metrics: [
      { id: "m1", title: "Service TAT & Outside Resolution", weight: 40, defaultScore: 4.0 },
      { id: "m2", title: "Client Satisfaction (CSAT Rating)", weight: 30, defaultScore: 4.2 },
      { id: "m3", title: "Product Cross-Selling Support (FD/Ins)", weight: 30, defaultScore: 3.8 },
    ],
  },
  {
    name: "Management Team",
    metrics: [
      { id: "m1", title: "Business Revenue & Net AUM Inflows", weight: 40, defaultScore: 4.8 },
      { id: "m2", title: "Team Productivity & Staff Retention", weight: 30, defaultScore: 4.2 },
      { id: "m3", title: "Operational Risk & Compliance Audit", weight: 30, defaultScore: 5.0 },
    ],
  },
];

const KpaSimulator: React.FC<Props> = ({ defaultGrowthCap = 15 }) => {
  const [selectedTeamIdx, setSelectedTeamIdx] = useState(0);
  const [growthCap, setGrowthCap] = useState(defaultGrowthCap);
  const [currentSalary, setCurrentSalary] = useState(50000);
  const [adminDeduction, setAdminDeduction] = useState(0.2);

  // Scores for current team
  const currentTeam = PRESET_TEAMS[selectedTeamIdx];
  const [scores, setScores] = useState<Record<string, number>>({
    m1: currentTeam.metrics[0].defaultScore,
    m2: currentTeam.metrics[1].defaultScore,
    m3: currentTeam.metrics[2].defaultScore,
  });

  const handleScoreChange = (metricId: string, val: number) => {
    setScores((prev) => ({ ...prev, [metricId]: val }));
  };

  const handleTeamChange = (idx: number) => {
    setSelectedTeamIdx(idx);
    const newTeam = PRESET_TEAMS[idx];
    setScores({
      m1: newTeam.metrics[0].defaultScore,
      m2: newTeam.metrics[1].defaultScore,
      m3: newTeam.metrics[2].defaultScore,
    });
  };

  // Mathematical calculations
  const rawWeightedScore = Number(
    currentTeam.metrics
      .reduce((sum, m) => sum + ((scores[m.id] || 3) * m.weight) / 100, 0)
      .toFixed(3)
  );

  const netScore = Math.max(0, Number((rawWeightedScore - adminDeduction).toFixed(3)));
  const performanceRatio = Number((netScore / 5.0).toFixed(4));
  const finalAppraisalPct = Number((performanceRatio * growthCap).toFixed(2));
  const incrementAmount = Math.round((currentSalary * finalAppraisalPct) / 100);
  const revisedSalary = currentSalary + incrementAmount;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs text-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Interactive KPA & Appraisal Simulator</h3>
            <p className="text-xs text-slate-500">Model live scores, growth caps, and disciplinary deductions</p>
          </div>
        </div>

        {/* Team Selector */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          {PRESET_TEAMS.map((t, idx) => (
            <button
              key={t.name}
              onClick={() => handleTeamChange(idx)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                selectedTeamIdx === idx
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Sliders and Inputs */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              1. KPA Performance Scoring (1.0 to 5.0 Scale)
            </h4>

            {currentTeam.metrics.map((metric) => {
              const val = scores[metric.id] ?? 3;
              return (
                <div key={metric.id} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 font-medium">
                      {metric.title} <span className="text-indigo-600 font-semibold">({metric.weight}%)</span>
                    </span>
                    <span className="font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                      {val.toFixed(1)} / 5.0
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={val}
                    onChange={(e) => handleScoreChange(metric.id, parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>1.0 Subpar</span>
                    <span>3.0 Meets Standard</span>
                    <span>5.0 Outstanding</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Business & Deduction Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                YoY Growth Cap %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={growthCap}
                onChange={(e) => setGrowthCap(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                Admin Deduction
              </label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={adminDeduction}
                onChange={(e) => setAdminDeduction(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-rose-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
                Base Monthly (₹)
              </label>
              <input
                type="number"
                min="0"
                step="5000"
                value={currentSalary}
                onChange={(e) => setCurrentSalary(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Right: Live Calculation Output Card */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-linear-to-br from-indigo-50/80 via-white to-indigo-50/40 border border-indigo-100 rounded-2xl p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-indigo-100 pb-3">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Calculation Output
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                Live Formula Active
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Raw Weighted Score:</span>
                <span className="font-semibold text-slate-800">{rawWeightedScore.toFixed(2)} / 5.0</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Admin Deduction Score:</span>
                <span className="font-semibold text-rose-600">-{adminDeduction.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Net Performance Score:</span>
                <span className="font-bold text-indigo-600">{netScore.toFixed(2)} / 5.0</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Performance Ratio:</span>
                <span className="font-semibold text-slate-800">{(performanceRatio * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-slate-500">Business Growth Cap:</span>
                <span className="font-semibold text-emerald-600">{growthCap.toFixed(1)}%</span>
              </div>
            </div>

            {/* Big Highlight Card */}
            <div className="mt-5 p-4 rounded-xl bg-linear-to-r from-indigo-600 to-indigo-700 text-white text-center space-y-1 shadow-sm shadow-indigo-600/20">
              <p className="text-[10px] font-semibold text-indigo-100 uppercase tracking-wider">Final Approved Appraisal</p>
              <p className="text-3xl font-extrabold text-white tracking-tight">
                {finalAppraisalPct.toFixed(2)}%
              </p>
              <p className="text-[11px] text-indigo-200">
                Formula: ({netScore.toFixed(2)} ÷ 5.0) × {growthCap.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Salary Impact */}
          <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Revised Monthly Salary</p>
              <p className="text-base font-bold text-emerald-600">₹{revisedSalary.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Net Monthly Increment</p>
              <p className="text-sm font-bold text-indigo-600">+₹{incrementAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KpaSimulator;
