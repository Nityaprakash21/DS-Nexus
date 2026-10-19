import { AlertCircle, CalendarDays, FileText, Loader2, Send, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import api from "../../api/axios";
import toast from "react-hot-toast";

interface LeaveQuotaItem {
  consumed: number;
  total: number;
  remaining: number;
  pending?: number;
}

interface ApplyLeaveModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isRegularization?: boolean;
  targetDate?: string;
  allowedTypes?: ("SICK" | "CASUAL")[];
  leaveQuotas?: {
    financialYear?: string;
    fullLabel?: string;
    totalQuota?: number;
    totalConsumed?: number;
    totalPending?: number;
    totalRemaining?: number;
    allLeavesConsumed?: boolean;
    SICK?: LeaveQuotaItem;
    CASUAL?: LeaveQuotaItem;
    ANNUAL?: LeaveQuotaItem;
  } | null;
}

// Helper: Convert YYYY-MM-DD -> DD/MM/YYYY
const toDMY = (isoDate: string) => {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return isoDate;
};

// Helper: Convert DD/MM/YYYY -> YYYY-MM-DD
const fromDMY = (dmyStr: string) => {
  const clean = dmyStr.replace(/[-.]/g, "/").trim();
  const parts = clean.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d && m && y && y.length === 4) {
      const day = d.padStart(2, "0");
      const month = m.padStart(2, "0");
      return `${y}-${month}-${day}`;
    }
  }
  return null;
};

const ApplyLeaveModal = ({
  open,
  onClose,
  onSuccess,
  isRegularization = false,
  targetDate,
  leaveQuotas
}: ApplyLeaveModalProps) => {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"SICK" | "CASUAL">("CASUAL");
  const [startDate, setStartDate] = useState("");
  const [startDateDisplay, setStartDateDisplay] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endDateDisplay, setEndDateDisplay] = useState("");
  const startPickerRef = useRef<HTMLInputElement>(null);
  const endPickerRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState("");
  const [internalQuotas, setInternalQuotas] = useState<any>(null);

  const activeQuotas = leaveQuotas || internalQuotas;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const minDate = isRegularization ? undefined : tomorrow.toISOString().split("T")[0];

  const sickRemaining = activeQuotas?.SICK?.remaining ?? 5;
  const casualRemaining = activeQuotas?.CASUAL?.remaining ?? 10;

  const totalRemaining = isRegularization
    ? (sickRemaining + casualRemaining)
    : (sickRemaining + casualRemaining);

  const allLeavesConsumed = totalRemaining <= 0;

  useEffect(() => {
    if (open) {
      if (!leaveQuotas) {
        api.get("/leave").then(res => {
          if (res.data?.leaveQuotas) setInternalQuotas(res.data.leaveQuotas);
        }).catch(err => console.error("Failed to load leave quotas:", err));
      }
      if (targetDate) {
        const cleanDate = targetDate.includes("T") ? targetDate.split("T")[0] : targetDate;
        setStartDate(cleanDate);
        setStartDateDisplay(toDMY(cleanDate));
        setEndDate(cleanDate);
        setEndDateDisplay(toDMY(cleanDate));
      }
      if (casualRemaining <= 0 && sickRemaining > 0) {
        setType("SICK");
      } else {
        setType("CASUAL");
      }
    }
  }, [open, targetDate, isRegularization, leaveQuotas, casualRemaining, sickRemaining]);

  const currentQuota = activeQuotas ? activeQuotas[type] : null;

  // Calculate duration in days inclusive
  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    if (end < start) return 0;
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  };

  const requestedDays = calculateDays();
  const exceedsQuota = Boolean(currentQuota && requestedDays > currentQuota.remaining);
  const isZeroBalance = Boolean(currentQuota && currentQuota.remaining <= 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (allLeavesConsumed) {
      toast.error(
        isRegularization
          ? "All Sick and Casual leaves have been consumed for this financial year."
          : `All Sick and Casual leaves have been consumed already for ${activeQuotas?.financialYear || "this financial year"}.`
      );
      return;
    }
    if (isZeroBalance) {
      toast.error(`You have exhausted all ${type.toLowerCase()} leaves for this financial year.`);
      return;
    }
    if (exceedsQuota) {
      toast.error(`Requested ${requestedDays} days exceeds your remaining balance of ${currentQuota?.remaining} days.`);
      return;
    }
    setLoading(true);

    try {
      await api.post('/leave', {
        type,
        startDate,
        endDate,
        reason,
        isRegularization: Boolean(isRegularization)
      });
      toast.success(
        isRegularization
          ? "Leave application submitted for absent day regularization!"
          : "Leave application submitted successfully!"
      );
      if (onSuccess) onSuccess();
      onClose();
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to submit leave application");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 bg-slate-50/50 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">
                {isRegularization ? "Regularize Absent via Leave" : "Apply for Leave"}
              </h2>
              {isRegularization && (
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                  Sick / Casual Only
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isRegularization
                ? "Retroactive application — mapped strictly to Sick or Casual leaves"
                : `Submit your leave request for managerial approval (${activeQuotas?.financialYear || "FY 2026-27"})`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Absent Regularization Info Banner */}
        {isRegularization && (
          <div className="mx-6 mt-4 p-3 bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 rounded-xl text-xs text-slate-700 flex items-start gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-slate-900">Absent Regularization Policy</p>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Applying leave for an absent day clears your absent penalty and removes the LWP deduction. This option strictly uses your <strong>Casual Leave</strong> (10/yr) or <strong>Sick Leave</strong> (5/yr) quotas. Annual leave is not permitted.
              </p>
            </div>
          </div>
        )}

        {/* All Leaves Consumed Alert Banner */}
        {allLeavesConsumed && (
          <div className="mx-6 mt-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-rose-800">
                All leaves have been consumed already
              </p>
              <p className="text-[11px] text-rose-700/90 mt-0.5">
                {isRegularization
                  ? `You have consumed all Sick and Casual leaves for ${activeQuotas?.financialYear || "this financial year"}. Please use Option 1 (Attendance Correction) instead.`
                  : `You have consumed all available leaves (10 Casual + 5 Sick) for ${activeQuotas?.financialYear || "this financial year"}. Applying for leave is disabled.`}
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Leave Type */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              <FileText className="w-4 h-4 text-indigo-500" /> Leave Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "SICK" | "CASUAL")}
              required
              disabled={allLeavesConsumed}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="CASUAL" disabled={(activeQuotas?.CASUAL?.remaining ?? 10) <= 0}>
                Casual Leave (Cap: 10 per FY) {(activeQuotas?.CASUAL?.remaining ?? 10) <= 0 ? "— Consumed" : `(${activeQuotas?.CASUAL?.remaining ?? 10} left)`}
              </option>
              <option value="SICK" disabled={(activeQuotas?.SICK?.remaining ?? 5) <= 0}>
                Sick Leave (Cap: 5 per FY) {(activeQuotas?.SICK?.remaining ?? 5) <= 0 ? "— Consumed" : `(${activeQuotas?.SICK?.remaining ?? 5} left)`}
              </option>
            </select>

            {/* Quota indicator card */}
            {currentQuota && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block">
                    {activeQuotas?.financialYear || "FY 2026-27"} Quota:
                  </span>
                  <span className="font-bold text-slate-800">
                    {currentQuota.consumed} / {currentQuota.total} leaves consumed
                  </span>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                    currentQuota.remaining > 0
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}>
                    {currentQuota.remaining} day{currentQuota.remaining === 1 ? "" : "s"} remaining
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              <CalendarDays className="w-4 h-4 text-indigo-500" /> Duration
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="block text-xs font-medium text-slate-500">From</span>
                  <span className="text-[10px] font-semibold text-indigo-600">DD/MM/YYYY</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={startDateDisplay}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDateDisplay(val);
                      const parsed = fromDMY(val);
                      if (parsed) setStartDate(parsed);
                    }}
                    onBlur={() => {
                      if (startDate) setStartDateDisplay(toDMY(startDate));
                    }}
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (startPickerRef.current) {
                        if (typeof startPickerRef.current.showPicker === "function") {
                          startPickerRef.current.showPicker();
                        } else {
                          startPickerRef.current.focus();
                          startPickerRef.current.click();
                        }
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Choose from calendar"
                  >
                    <CalendarDays className="w-4 h-4" />
                  </button>
                  <input
                    ref={startPickerRef}
                    type="date"
                    value={startDate}
                    min={minDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setStartDate(e.target.value);
                        setStartDateDisplay(toDMY(e.target.value));
                      }
                    }}
                    tabIndex={-1}
                    className="sr-only pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="block text-xs font-medium text-slate-500">To</span>
                  <span className="text-[10px] font-semibold text-indigo-600">DD/MM/YYYY</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={endDateDisplay}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEndDateDisplay(val);
                      const parsed = fromDMY(val);
                      if (parsed) setEndDate(parsed);
                    }}
                    onBlur={() => {
                      if (endDate) setEndDateDisplay(toDMY(endDate));
                    }}
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (endPickerRef.current) {
                        if (typeof endPickerRef.current.showPicker === "function") {
                          endPickerRef.current.showPicker();
                        } else {
                          endPickerRef.current.focus();
                          endPickerRef.current.click();
                        }
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Choose from calendar"
                  >
                    <CalendarDays className="w-4 h-4" />
                  </button>
                  <input
                    ref={endPickerRef}
                    type="date"
                    value={endDate}
                    min={startDate || minDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setEndDate(e.target.value);
                        setEndDateDisplay(toDMY(e.target.value));
                      }
                    }}
                    tabIndex={-1}
                    className="sr-only pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            {/* Requested days counter banner */}
            {requestedDays > 0 && (
              <div className={`mt-2.5 p-3 rounded-xl text-xs flex items-center justify-between transition-all ${
                exceedsQuota
                  ? "bg-rose-50 border border-rose-200 text-rose-800"
                  : "bg-indigo-50/70 border border-indigo-100 text-indigo-950"
              }`}>
                <div>
                  <span className="font-semibold block">
                    Duration: {requestedDays} calendar day{requestedDays > 1 ? "s" : ""}
                  </span>
                  <span className="text-[11px] opacity-80">
                    ({startDate} to {endDate})
                  </span>
                </div>
                <div>
                  {exceedsQuota ? (
                    <span className="font-bold text-rose-700 bg-rose-100/80 px-2 py-1 rounded-md">
                      Exceeds {currentQuota?.remaining} day{currentQuota?.remaining === 1 ? "" : "s"} left
                    </span>
                  ) : (
                    <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
                      Within quota balance
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
              placeholder="Briefly describe why you need this leave..."
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || allLeavesConsumed || exceedsQuota || isZeroBalance}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all flex items-center justify-center gap-2 ${
                allLeavesConsumed
                  ? "bg-slate-200 text-slate-400 border border-slate-300 shadow-none cursor-not-allowed opacity-80"
                  : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {loading
                ? "Submitting..."
                : allLeavesConsumed
                ? "All leaves has been consumed already"
                : isZeroBalance
                ? "Quota Exhausted"
                : exceedsQuota
                ? "Exceeds Available Quota"
                : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplyLeaveModal;