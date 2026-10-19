import React, { useState, useRef } from "react";
import { X, Clock, Calendar, Send } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios";

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

interface RequestCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  monthlyQuota?: {
    used: number;
    max: number;
    remaining: number;
    monthName?: string;
  } | null;
}

const RequestCorrectionModal: React.FC<RequestCorrectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  monthlyQuota,
}) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];
  const maxDateStr = yesterdayStr;
  const defaultDateStr = (initialDate && initialDate < todayStr) ? initialDate : yesterdayStr;

  const [date, setDate] = useState(defaultDateStr);
  const [dateDisplay, setDateDisplay] = useState(toDMY(defaultDateStr));
  const hiddenDateInputRef = useRef<HTMLInputElement>(null);

  const [inTime, setInTime] = useState("10:00 AM");
  const [outTime, setOutTime] = useState("06:00 PM");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isQuotaExceeded = Boolean(monthlyQuota && monthlyQuota.remaining <= 0);

  // Sync date when initialDate changes (strictly clamp to yesterday or earlier)
  React.useEffect(() => {
    const target = (initialDate && initialDate < todayStr) ? initialDate : yesterdayStr;
    setDate(target);
    setDateDisplay(toDMY(target));
  }, [initialDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalDate = date || fromDMY(dateDisplay);
    if (!finalDate) {
      toast.error("Please enter a valid date in DD/MM/YYYY format.");
      return;
    }
    if (finalDate >= todayStr) {
      toast.error("Attendance correction can only be applied from the next day onwards. You cannot apply for today or future dates.");
      return;
    }
    if (!inTime.trim() || !outTime.trim()) {
      toast.error("Please provide both In-Time and Out-Time.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please provide the reason for not being able to punch.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/attendance-corrections", {
        date: finalDate,
        inTime,
        outTime,
        reason,
      });

      toast.success(res.data.message || "Correction request submitted to Admin!");
      setReason("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-indigo-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Request Attendance Correction
              </h3>
              <p className="text-xs text-slate-500">
                Submit in/out timings for Admin approval & regularize presence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Monthly Quota Indicator */}
          {monthlyQuota && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                isQuotaExceeded
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-indigo-50/80 border-indigo-200/80 text-indigo-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 shrink-0 ${isQuotaExceeded ? "text-rose-600" : "text-indigo-600"}`} />
                <span className="font-semibold">
                  Monthly Quota ({monthlyQuota.monthName || "This Month"}):
                </span>
              </div>
              <span
                className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${
                  isQuotaExceeded
                    ? "bg-rose-600 text-white"
                    : "bg-indigo-600 text-white"
                }`}
              >
                {monthlyQuota.used} / {monthlyQuota.max} Used ({monthlyQuota.remaining} Left)
              </span>
            </div>
          )}

          {/* Date Picker (DD/MM/YYYY) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Date of Missed / Inaccurate Punch
              </label>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="DD/MM/YYYY"
                value={dateDisplay}
                onChange={(e) => {
                  const val = e.target.value;
                  setDateDisplay(val);
                  const parsed = fromDMY(val);
                  if (parsed) {
                    setDate(parsed);
                  }
                }}
                onBlur={() => {
                  if (date) {
                    setDateDisplay(toDMY(date));
                  }
                }}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-11 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
              />

              {/* Calendar Picker Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  if (hiddenDateInputRef.current) {
                    if (typeof hiddenDateInputRef.current.showPicker === "function") {
                      hiddenDateInputRef.current.showPicker();
                    } else {
                      hiddenDateInputRef.current.focus();
                      hiddenDateInputRef.current.click();
                    }
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Choose date from calendar"
              >
                <Calendar className="w-4 h-4" />
              </button>

              {/* Hidden native date input for the calendar popup picker */}
              <input
                ref={hiddenDateInputRef}
                type="date"
                max={maxDateStr}
                value={date}
                onChange={(e) => {
                  if (e.target.value) {
                    setDate(e.target.value);
                    setDateDisplay(toDMY(e.target.value));
                  }
                }}
                tabIndex={-1}
                className="sr-only pointer-events-none"
                aria-hidden="true"
              />
            </div>

            {/* Formatted Date Human-readable hint */}
            {date && (
              <p className="text-[11px] font-medium text-slate-500 mt-1.5 flex items-center gap-1.5">
                <span>Selected:</span>
                <span className="font-semibold text-slate-800">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </p>
            )}

            {/* Next Day Policy Notice */}
            <p className="text-[11px] text-amber-800 font-medium mt-1.5 flex items-center gap-1.5 bg-amber-50/80 border border-amber-200/80 px-2.5 py-1.5 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Correction for any date can only be requested from the next day onwards (not on the same day).</span>
            </p>
          </div>

          {/* In Time and Out Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Actual In-Time
              </label>
              <input
                type="text"
                value={inTime}
                onChange={(e) => setInTime(e.target.value)}
                placeholder="e.g. 09:30 AM"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Format: 09:30 AM or 09:30</span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Actual Out-Time
              </label>
              <input
                type="text"
                value={outTime}
                onChange={(e) => setOutTime(e.target.value)}
                placeholder="e.g. 06:30 PM"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Format: 06:30 PM or 18:30</span>
            </div>
          </div>

          {/* Reason of not able to punch */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Reason for Not Able to Punch <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Client on-site meeting at AMC branch, biometric punch glitch, field operations duty, etc."
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              This reason will be directly reviewed by the Admin for authorization.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isQuotaExceeded}
              title={isQuotaExceeded ? `Monthly limit of ${monthlyQuota?.max || 10} attendance corrections reached` : ""}
              className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-indigo-600/20 inline-flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              {submitting ? (
                <span>Submitting...</span>
              ) : isQuotaExceeded ? (
                <span>Limit Reached ({monthlyQuota?.used || 10}/{monthlyQuota?.max || 10})</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Submit for Approval
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestCorrectionModal;
