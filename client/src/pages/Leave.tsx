import { useState, useCallback, useEffect } from "react"
import Loading from "../components/Loading"
import { AlertCircle, Ban, PalmtreeIcon, PlusIcon, ThermometerIcon, UmbrellaIcon } from "lucide-react"
import LeaveHistory from "../components/leave/LeaveHistory"
import ApplyLeaveModal from "../components/leave/ApplyLeaveModal"
import { useAuth } from "../../context/AuthContext"
import api from "../api/axios"
import toast from "react-hot-toast"

interface LeaveQuotaItem {
  consumed: number;
  total: number;
  remaining: number;
  pending?: number;
}

interface LeaveQuotas {
  financialYear: string;
  fullLabel?: string;
  totalQuota?: number;
  totalConsumed?: number;
  totalPending?: number;
  totalRemaining?: number;
  allLeavesConsumed?: boolean;
  SICK: LeaveQuotaItem;
  CASUAL: LeaveQuotaItem;
  ANNUAL: LeaveQuotaItem;
}

const Leave = () => {

  const { user } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([])
  const [delegatedLeaves, setDelegatedLeaves] = useState<any[]>([])
  const [isLeaveApprover, setIsLeaveApprover] = useState(false)
  const [activeTab, setActiveTab] = useState<"my" | "team">("my")
  const [leaveQuotas, setLeaveQuotas] = useState<LeaveQuotas | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false);
  const isAdmin = user?.role === "ADMIN";

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await api.get('/leave');
      setLeaves(res.data.data || []);
      setDelegatedLeaves(res.data.delegatedLeaves || []);
      setIsLeaveApprover(Boolean(res.data.isLeaveApprover || (res.data.delegatedLeaves && res.data.delegatedLeaves.length > 0)));
      setLeaveQuotas(res.data.leaveQuotas || null);
      setIsDeleted(Boolean(res.data.employee?.isDeleted));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error.message)
    } finally {
      setLoading(false);
    }
  }, [])

  useEffect(() => {
    fetchLeaves()
  }, [fetchLeaves])

  if (loading) return <Loading />

  const sickData = leaveQuotas?.SICK || { consumed: 0, total: 5, remaining: 5 };
  const casualData = leaveQuotas?.CASUAL || { consumed: 0, total: 10, remaining: 10 };
  const annualData = leaveQuotas?.ANNUAL || { consumed: 0, total: 20, remaining: 20 };
  const fyLabel = leaveQuotas?.financialYear || "FY 2026-27";

  const applicableRemaining = (sickData.remaining ?? Math.max(0, sickData.total - sickData.consumed)) +
    (casualData.remaining ?? Math.max(0, casualData.total - casualData.consumed));

  const allLeavesConsumed = Boolean(leaveQuotas?.allLeavesConsumed) || applicableRemaining <= 0;

  const leaveStats = [
    {
      type: "CASUAL",
      label: "Casual Leave",
      consumed: casualData.consumed,
      total: casualData.total,
      remaining: casualData.remaining,
      icon: UmbrellaIcon,
      accentColor: "border-sky-500/70 group-hover:border-sky-500",
      iconBg: "bg-sky-50 group-hover:bg-sky-100/70",
      iconColor: "text-sky-600",
      barColor: "bg-sky-500",
      badgeColor: "bg-sky-50 text-sky-700 border-sky-200"
    },
    {
      type: "ANNUAL",
      label: "Annual Holidays (Gazetted)",
      consumed: annualData.consumed,
      total: annualData.total,
      remaining: annualData.remaining,
      icon: PalmtreeIcon,
      accentColor: "border-emerald-500/70 group-hover:border-emerald-500",
      iconBg: "bg-emerald-50 group-hover:bg-emerald-100/70",
      iconColor: "text-emerald-600",
      barColor: "bg-emerald-500",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200"
    },
    {
      type: "SICK",
      label: "Sick Leave",
      consumed: sickData.consumed,
      total: sickData.total,
      remaining: sickData.remaining,
      icon: ThermometerIcon,
      accentColor: "border-amber-500/70 group-hover:border-amber-500",
      iconBg: "bg-amber-50 group-hover:bg-amber-100/70",
      iconColor: "text-amber-600",
      barColor: "bg-amber-500",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200"
    }
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="page-title">Leave Management</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {leaveQuotas?.fullLabel || `${fyLabel} (Apr - Mar)`}
            </span>
            {isLeaveApprover && (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Designated Approver
              </span>
            )}
          </div>
          <p className="page-subtitle">
            {isLeaveApprover ? "Annual leave quotas and team approval actions" : `Annual leave quotas & applications for ${fyLabel}`}
          </p>
        </div>
        {!isAdmin && (
          <div className="flex flex-col sm:items-end gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => {
                if (!allLeavesConsumed && !isDeleted) setShowModal(true);
              }}
              disabled={isDeleted || allLeavesConsumed}
              title={
                allLeavesConsumed
                  ? "All leaves have been consumed already"
                  : isDeleted
                  ? "Account deactivated"
                  : "Apply for Leave"
              }
              className={`flex items-center gap-2 w-full sm:w-auto justify-center transition-all ${
                allLeavesConsumed
                  ? "bg-slate-100 text-slate-400 border border-slate-200/90 cursor-not-allowed py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold shadow-none opacity-80"
                  : isDeleted
                  ? "btn-primary opacity-50 cursor-not-allowed"
                  : "btn-primary cursor-pointer"
              }`}
            >
              {allLeavesConsumed ? <Ban className="w-4 h-4 text-slate-400" /> : <PlusIcon className="w-4 h-4" />}
              Apply for Leave
            </button>
            {allLeavesConsumed && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                All leaves has been consumed already
              </span>
            )}
          </div>
        )}
      </div>

      {/* All Leaves Consumed Alert Banner */}
      {!isAdmin && allLeavesConsumed && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50/90 border border-amber-300 flex items-center justify-between gap-3 text-amber-950 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                All leaves has been consumed already
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded border border-rose-200">
                  0 Remaining
                </span>
              </h4>
              <p className="text-xs text-amber-800/90 mt-0.5">
                You have consumed all available leaves (10 Casual + 5 Sick) for {fyLabel}. Applying for leave has been disabled for the remainder of this financial year.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
            Quota Exhausted
          </span>
        </div>
      )}

      {/* Delegated Approvals Tab Switcher (For employees assigned as leave approvers) */}
      {!isAdmin && (isLeaveApprover || delegatedLeaves.length > 0) && (
        <div className="flex items-center gap-2 mb-6 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("my")}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "my"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            My Leaves & Balance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "team"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>Team Approvals</span>
            {delegatedLeaves.filter((l) => l.status === "PENDING").length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800">
                {delegatedLeaves.filter((l) => l.status === "PENDING").length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Leave Quota Stat Cards - Visible for all users (Admin & Employees) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-8">
        {leaveStats.map((s) => {
          const percent = Math.min(100, Math.round((s.consumed / s.total) * 100));
          return (
            <div
              key={s.label}
              className="card card-hover p-5 sm:p-6 relative overflow-hidden group flex flex-col justify-between"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-r-full ${s.barColor}`} />

              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {s.label}
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
                      {s.consumed}
                    </span>
                    <span className="text-xl sm:text-2xl font-bold text-slate-300">/</span>
                    <span className="text-xl sm:text-2xl font-bold text-slate-500 font-mono">
                      {s.total}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">
                      leaves
                    </span>
                  </div>
                </div>

                <div className={`p-3 rounded-xl ${s.iconBg} transition-colors duration-200 shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.iconColor} transition-colors duration-200`} />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                  <span className="text-slate-600">
                    <strong>{s.remaining}</strong> remaining
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {percent}% used
                  </span>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${s.barColor} rounded-full transition-all duration-500`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* My Leaves View */}
      {(!isAdmin && activeTab === "my") && (
        <LeaveHistory leaves={leaves} isAdmin={false} onUpdate={fetchLeaves} />
      )}

      {/* Team Approvals View for Delegated Approvers */}
      {(!isAdmin && activeTab === "team") && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
            <span className="font-medium">
              You are the designated Leave Approver for assigned team members. Review and action their leave applications below.
            </span>
            <span className="font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
              {delegatedLeaves.length} Total Application{delegatedLeaves.length !== 1 ? "s" : ""}
            </span>
          </div>

          {delegatedLeaves.length === 0 ? (
            <div className="card p-12 text-center text-slate-400 border border-dashed border-slate-200">
              <p className="text-sm font-bold text-slate-700">No Team Leave Applications</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                None of your assigned team members have submitted leave applications yet.
              </p>
            </div>
          ) : (
            <LeaveHistory leaves={delegatedLeaves} isAdmin={false} canApprove={true} onUpdate={fetchLeaves} />
          )}
        </div>
      )}

      {/* Admin View */}
      {isAdmin && (
        <LeaveHistory leaves={leaves} isAdmin={true} onUpdate={fetchLeaves} />
      )}

      <ApplyLeaveModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchLeaves}
        leaveQuotas={leaveQuotas}
      />
    </div>
  )
}

export default Leave