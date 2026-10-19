import React, { useState } from "react";
import {
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  ShieldCheck,
  Check,
  User,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios";

export interface DelegatedCorrectionItem {
  id: string;
  date: string;
  inTime: string;
  outTime: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminRemarks?: string;
  createdAt: string;
  reviewedAt?: string;
  employee?: {
    id: string;
    name: string;
    employeeCode?: string;
    department?: string;
    position?: string;
  };
  currentAttendance?: {
    status: string;
    checkIn?: string;
    checkOut?: string;
    workingHours?: number;
    dayType?: string;
  };
}

interface DelegatedCorrectionReviewProps {
  reviews: DelegatedCorrectionItem[];
  counts?: {
    all: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  loading?: boolean;
  onUpdate: () => void;
}

const DelegatedCorrectionReview: React.FC<DelegatedCorrectionReviewProps> = ({
  reviews,
  counts,
  loading = false,
  onUpdate,
}) => {
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [rejectingItem, setRejectingItem] = useState<DelegatedCorrectionItem | null>(null);
  const [rejectionRemark, setRejectionRemark] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Filter items based on local status filter
  const filteredReviews = reviews.filter((item) => {
    if (statusFilter === "ALL") return true;
    return item.status === statusFilter;
  });

  const allCount = counts?.all ?? reviews.length;
  const pendingCount = counts?.pending ?? reviews.filter((r) => r.status === "PENDING").length;
  const approvedCount = counts?.approved ?? reviews.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = counts?.rejected ?? reviews.filter((r) => r.status === "REJECTED").length;

  const handleApprove = async (item: DelegatedCorrectionItem) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await api.patch(`/attendance-corrections/${item.id}/review`, {
        action: "APPROVE",
        remarks: "Approved by Designated Approver - Marked Present",
      });
      toast.success(res.data?.message || `Approved correction for ${item.employee?.name || "employee"}. Day marked PRESENT.`);
      onUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Approval failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await api.patch(`/attendance-corrections/${rejectingItem.id}/review`, {
        action: "REJECT",
        remarks: rejectionRemark.trim() || "Declined by Designated Approver",
      });
      toast.success(res.data?.message || `Declined correction for ${rejectingItem.employee?.name || "employee"}.`);
      setRejectingItem(null);
      setRejectionRemark("");
      onUpdate();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Decline failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Approver Header & Role Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">
                Team Attendance Regularizations
              </h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Designated Approver
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Review and action punch timing adjustments for your assigned personnel. Approved corrections mark the employee as Present.
            </p>
          </div>
        </div>

        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0 shadow-2xs">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            {pendingCount} Awaiting Your Action
          </span>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Requests ({allCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "PENDING"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("APPROVED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "APPROVED"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("REJECTED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "REJECTED"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Declined ({rejectedCount})
          </button>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing {filteredReviews.length} record{filteredReviews.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-500">Loading team regularization requests...</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="card p-12 text-center text-slate-400 border border-dashed border-slate-200">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-700">No Regularization Requests Found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {statusFilter === "ALL"
              ? "None of your assigned team members have submitted attendance regularization requests yet."
              : `No regularization requests currently in '${statusFilter.toLowerCase()}' status.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredReviews.map((item) => {
            const formattedDate = new Date(item.date).toLocaleDateString("en-US", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
              >
                {/* Employee Header & Status Badge */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-sm shadow-xs">
                      {item.employee?.name ? item.employee.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">{item.employee?.name || "Employee"}</h4>
                        {item.employee?.employeeCode && (
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded shrink-0">
                            #{item.employee.employeeCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.employee?.position || "Staff"} • <span className="font-semibold text-slate-600">{item.employee?.department || "Department"}</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    {item.status === "PENDING" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        Pending Your Approval
                      </span>
                    )}
                    {item.status === "APPROVED" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Approved & Marked Present
                      </span>
                    )}
                    {item.status === "REJECTED" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        Declined
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Date</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      {formattedDate}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Requested Timings</span>
                    <span className="font-bold text-slate-800 flex items-center gap-2 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      In: {item.inTime} | Out: {item.outTime}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Recorded Attendance Log</span>
                    <span className="font-medium mt-0.5 block">
                      {item.currentAttendance ? (
                        <span className="text-amber-700 font-semibold">
                          {item.currentAttendance.status} (
                          {(() => {
                            const wh = item.currentAttendance.workingHours;
                            if (wh == null || wh < 0) return "0 hrs";
                            const hrs = Math.floor(wh);
                            const mins = Math.round((wh - hrs) * 60);
                            if (hrs === 0 && mins === 0) return "0 hrs";
                            if (hrs === 0) return `${mins}m`;
                            if (mins === 0) return `${hrs}h`;
                            return `${hrs}h ${mins}m`;
                          })()}
                          )
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No punch recorded (Absent)</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Stated Reason */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Employee Stated Reason:
                  </span>
                  <p className="text-xs text-slate-800 font-medium bg-slate-50/60 p-3 rounded-xl border border-slate-200/80 italic">
                    "{item.reason}"
                  </p>
                </div>

                {/* Review Remarks if completed */}
                {item.adminRemarks && (
                  <div className="p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-xs flex items-start gap-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px] shrink-0 mt-0.5">
                      Remarks:
                    </span>
                    <span className="text-slate-700 font-medium">{item.adminRemarks}</span>
                  </div>
                )}

                {/* Action Buttons for Pending Items */}
                {item.status === "PENDING" && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => {
                        setRejectingItem(item);
                        setRejectionRemark("");
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApprove(item)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve & Mark Present
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Remarks Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-900">Decline Attendance Correction</h4>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Provide a reason for declining the correction request from{" "}
              <strong className="text-slate-800">{rejectingItem.employee?.name}</strong>.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Decline Remarks / Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionRemark}
                  onChange={(e) => setRejectionRemark(e.target.value)}
                  placeholder="e.g. In/Out timings not verified by management or insufficient justification provided."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? "Declining..." : "Confirm Decline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DelegatedCorrectionReview;
