import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  ShieldCheck,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios";

export interface AdminCorrectionItem {
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
    department: string;
    position: string;
  };
  currentAttendance?: {
    status: string;
    checkIn?: string;
    checkOut?: string;
    workingHours?: number;
    dayType?: string;
  };
}

const AdminCorrectionReview: React.FC = () => {
  const [corrections, setCorrections] = useState<AdminCorrectionItem[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");

  // Rejection modal state
  const [rejectingItem, setRejectingItem] = useState<AdminCorrectionItem | null>(null);
  const [rejectionRemark, setRejectionRemark] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCorrections = useCallback(async () => {
    try {
      setLoading(true);
      const url = statusFilter === "ALL"
        ? "/attendance-corrections"
        : `/attendance-corrections?status=${statusFilter}`;
      const res = await api.get(url);
      setCorrections(res.data.data || []);
      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to fetch correction requests.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCorrections();
  }, [fetchCorrections]);

  // Handle Approve
  const handleApprove = async (item: AdminCorrectionItem) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await api.patch(`/attendance-corrections/${item.id}/review`, {
        action: "APPROVE",
        remarks: "Approved by Admin - Marked Present",
      });
      toast.success(res.data.message || `Approved correction for ${item.employee?.name}. Day marked PRESENT.`);
      fetchCorrections();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Approval failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject Submit
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await api.patch(`/attendance-corrections/${rejectingItem.id}/review`, {
        action: "REJECT",
        remarks: rejectionRemark.trim() || "Rejected by Admin",
      });
      toast.success(res.data.message || "Correction request rejected.");
      setRejectingItem(null);
      setRejectionRemark("");
      fetchCorrections();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Rejection failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Pending Review</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{counts.pending}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Awaiting Admin authorization</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Approved & Present</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{counts.approved}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Days successfully regularized</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Rejected</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{counts.rejected}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Requests declined</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2">
          {(["PENDING", "ALL", "APPROVED", "REJECTED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${statusFilter === tab
                ? "bg-indigo-600 text-white shadow-xs shadow-indigo-600/30"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                }`}
            >
              {tab === "PENDING" && `Pending (${counts.pending})`}
              {tab === "ALL" && "All Requests"}
              {tab === "APPROVED" && `Approved (${counts.approved})`}
              {tab === "REJECTED" && `Rejected (${counts.rejected})`}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Admin Authorization Gate
        </div>
      </div>

      {/* Correction Requests List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-2xl">
          Loading attendance correction requests...
        </div>
      ) : corrections.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No {statusFilter.toLowerCase()} requests</p>
          <p className="text-xs text-slate-400 mt-1">
            All attendance correction requests have been addressed by the Admin.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {corrections.map((item) => {
            const formattedDate = new Date(item.date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
              >
                {/* Employee Header & Status */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-sm shadow-xs">
                      {item.employee?.name ? item.employee.name.charAt(0).toUpperCase() : "E"}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{item.employee?.name}</h4>
                      <p className="text-xs text-slate-500">
                        {item.employee?.position} • <span className="font-semibold text-slate-600">{item.employee?.department}</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    {item.status === "PENDING" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        Awaiting Admin
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
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Requested Date</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      {formattedDate}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Proposed Timings</span>
                    <span className="font-bold text-slate-800 flex items-center gap-2 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      In: {item.inTime} | Out: {item.outTime}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Original Punch Record</span>
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
                  <p className="text-xs text-slate-800 font-medium bg-white p-3 rounded-xl border border-slate-200/80">
                    "{item.reason}"
                  </p>
                </div>

                {/* Admin Remarks if any */}
                {item.adminRemarks && (
                  <p className="text-xs text-slate-500">
                    Remarks: <span className="font-semibold text-slate-700">{item.adminRemarks.replace(/Super Admin/gi, "Admin")}</span>
                  </p>
                )}

                {/* Action Buttons for Admin */}
                {item.status === "PENDING" && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => setRejectingItem(item)}
                      className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all"
                    >
                      Reject Request
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApprove(item)}
                      className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                      <Check className="w-4 h-4" />
                      Approve & Mark Present
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Decline Attendance Correction</h3>
              <button
                onClick={() => setRejectingItem(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              You are rejecting the attendance correction for <strong>{rejectingItem.employee?.name}</strong> on {new Date(rejectingItem.date).toLocaleDateString()}.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Reason for Rejection
                </label>
                <textarea
                  rows={3}
                  value={rejectionRemark}
                  onChange={(e) => setRejectionRemark(e.target.value)}
                  placeholder="e.g. Unverified absence, lack of prior approval, insufficient explanation"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-rose-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
                >
                  {actionLoading ? "Processing..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCorrectionReview;
