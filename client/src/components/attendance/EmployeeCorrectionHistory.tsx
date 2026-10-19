import React from "react";
import { Clock, Calendar, CheckCircle2, XCircle, AlertCircle, MessageSquare } from "lucide-react";

export interface CorrectionItem {
  id: string;
  date: string;
  inTime: string;
  outTime: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminRemarks?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface EmployeeCorrectionHistoryProps {
  corrections: CorrectionItem[];
  loading: boolean;
  monthlyQuota?: {
    used: number;
    max: number;
    remaining: number;
    monthName?: string;
  } | null;
}

const EmployeeCorrectionHistory: React.FC<EmployeeCorrectionHistoryProps> = ({
  corrections,
  loading,
  monthlyQuota,
}) => {
  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-2xl">
        Loading regularization history...
      </div>
    );
  }

  if (corrections.length === 0) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200/90 rounded-2xl">
        <p className="text-sm font-semibold text-slate-700">No Attendance Correction Requests</p>
        <p className="text-xs text-slate-400 mt-1">
          If you forgot to punch or encountered a technical issue, click "Request Correction" above to submit in/out timings for Admin authorization.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Attendance Regularization Requests
          </h3>
          <p className="text-xs text-slate-500">
            Track status of your submitted in/out timing adjustments and Admin approvals
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {monthlyQuota && (
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                monthlyQuota.remaining === 0
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : monthlyQuota.used >= Math.round(monthlyQuota.max * 0.7)
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200"
              }`}
            >
              {monthlyQuota.monthName || "This Month"}: {monthlyQuota.used}/{monthlyQuota.max} Used
            </span>
          )}
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200/60">
            {corrections.length} Total
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {corrections.map((item) => {
          const formattedDate = new Date(item.date).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          return (
            <div key={item.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    {formattedDate}
                  </span>

                  {item.status === "PENDING" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      Pending Approval
                    </span>
                  )}
                  {item.status === "APPROVED" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      Approved (Marked Present)
                    </span>
                  )}
                  {item.status === "REJECTED" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      <XCircle className="w-3 h-3 text-rose-500" />
                      Rejected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    In: {item.inTime}
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Out: {item.outTime}
                  </span>
                </div>

                <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100 max-w-xl">
                  "{item.reason}"
                </p>

                {item.adminRemarks && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <MessageSquare className="w-3 h-3 text-slate-400" />
                    Remarks: <span className="font-medium text-slate-700">{item.adminRemarks.replace(/Super Admin/gi, "Admin")}</span>
                  </p>
                )}
              </div>

              <div className="text-right text-[11px] text-slate-400">
                Submitted {new Date(item.createdAt).toLocaleDateString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmployeeCorrectionHistory;
