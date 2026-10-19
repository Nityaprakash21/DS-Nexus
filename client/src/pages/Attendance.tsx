import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Loading from "../components/Loading.js";
import CheckInButton from "../components/attendance/CheckInButton.js";
import AttendanceStats from "../components/attendance/AttendanceStats.js";
import AttendanceHistory from "../components/attendance/AttendanceHistory.js";
import RequestCorrectionModal from "../components/attendance/RequestCorrectionModal.js";
import ApplyLeaveModal from "../components/leave/ApplyLeaveModal.js";
import EmployeeCorrectionHistory, { type CorrectionItem } from "../components/attendance/EmployeeCorrectionHistory.js";
import AdminCorrectionReview from "../components/attendance/AdminCorrectionReview.js";

import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import { PlusCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { format } from "date-fns";

import DelegatedCorrectionReview, { type DelegatedCorrectionItem } from "../components/attendance/DelegatedCorrectionReview";
import TeamPunchesView from "../components/attendance/TeamPunchesView";

const Attendance = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  // Employee state
  const [history, setHistory] = useState([]);
  const [financialYear, setFinancialYear] = useState<any>(null);
  const [monthAttendance, setMonthAttendance] = useState<any>(null);
  const [lateAllowance, setLateAllowance] = useState<any>(null);
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [delegatedCorrections, setDelegatedCorrections] = useState<DelegatedCorrectionItem[]>([]);
  const [delegatedCounts, setDelegatedCounts] = useState<{ all: number; pending: number; approved: number; rejected: number } | undefined>(undefined);
  const [isAttendanceApprover, setIsAttendanceApprover] = useState(false);
  const [activeTab, setActiveTab] = useState<"my" | "team-punches" | "team-regularizations">("my");
  const [loading, setLoading] = useState(true);
  const [correctionsLoading, setCorrectionsLoading] = useState(true);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isLocationExempt, setIsLocationExempt] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionPrefillDate, setCorrectionPrefillDate] = useState<string>("");
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leavePrefillDate, setLeavePrefillDate] = useState<string>("");
  const location = useLocation();
  const [monthlyQuota, setMonthlyQuota] = useState<{
    used: number;
    max: number;
    remaining: number;
    monthName?: string;
  } | null>(null);

  // Fetch employee attendance
  const fetchData = useCallback(async () => {
    if (isAdmin) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/attendance");
      const json = res.data;
      setHistory(json.data || []);
      if (json.financialYear) setFinancialYear(json.financialYear);
      if (json.monthAttendance) setMonthAttendance(json.monthAttendance);
      if (json.lateAllowance) setLateAllowance(json.lateAllowance);
      if (json.employee?.isDeleted) setIsDeleted(true);
      if (json.employee?.isLocationExempt) setIsLocationExempt(true);
      if (json.isAttendanceApprover) setIsAttendanceApprover(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  // Fetch employee correction requests & delegated reviews
  const fetchCorrections = useCallback(async () => {
    if (isAdmin) return;
    try {
      setCorrectionsLoading(true);
      const res = await api.get("/attendance-corrections");
      setCorrections(res.data.data || []);
      setDelegatedCorrections(res.data.delegatedReviews || []);
      setDelegatedCounts(res.data.delegatedCounts);
      if (res.data.monthlyQuota) {
        setMonthlyQuota(res.data.monthlyQuota);
      }
      setIsAttendanceApprover(Boolean(res.data.isAttendanceApprover || (res.data.delegatedReviews && res.data.delegatedReviews.length > 0)));
    } catch (error: any) {
      console.error("Failed to fetch corrections:", error);
    } finally {
      setCorrectionsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchData();
    fetchCorrections();
  }, [fetchData, fetchCorrections]);

  useEffect(() => {
    if (location.state?.openModal === "leave" && location.state?.prefillDate) {
      setLeavePrefillDate(location.state.prefillDate);
      setIsLeaveModalOpen(true);
    } else if (location.state?.openModal === "correction" && location.state?.prefillDate) {
      setCorrectionPrefillDate(location.state.prefillDate);
      setIsCorrectionModalOpen(true);
    }
  }, [location.state]);

  if (loading) return <Loading />;

  // ---------------- ADMIN VIEW ----------------
  if (isAdmin) {
    return (
      <div className="animate-fade-in space-y-8">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            Attendance & Regularization Hub
            <span className="text-xs uppercase font-extrabold px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
              Admin
            </span>
          </h1>
          <p className="page-subtitle">
            Authorize employee attendance corrections, regularize punches, and manage presence
          </p>
        </div>

        <AdminCorrectionReview />
      </div>
    );
  }

  // ---------------- EMPLOYEE VIEW ----------------
  const getISTDate = (d: Date | string) => {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(d));
    } catch {
      return "";
    }
  };

  const todayIST = getISTDate(new Date());
  const todayRecord = history.find((r: any) => getISTDate(r.date) === todayIST);

  // Detect if yesterday had an unclosed punch locked at midnight (00:00 hrs)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIST = getISTDate(yesterday);
  const yesterdayRecord: any = history.find((r: any) => getISTDate(r.date) === yesterdayIST);
  const hasYesterdayValidOut = Boolean(
    yesterdayRecord && (
      (yesterdayRecord.checkOut && yesterdayRecord.currentStatus !== "IN" && (!yesterdayRecord.punches?.length || yesterdayRecord.punches[yesterdayRecord.punches.length - 1]?.type !== "IN")) ||
      (yesterdayRecord.punches && yesterdayRecord.punches.length > 0 && yesterdayRecord.punches[yesterdayRecord.punches.length - 1].type === "OUT") ||
      (yesterdayRecord.status === "PRESENT" && typeof yesterdayRecord.workingHours === "number" && yesterdayRecord.workingHours > 0)
    )
  );
  const yesterdayMissingPunch = Boolean(
    yesterdayRecord &&
    (yesterdayRecord.checkIn || (yesterdayRecord.punches && yesterdayRecord.punches.length > 0)) &&
    !hasYesterdayValidOut
  );

  const pendingDelegatedCount = delegatedCounts?.pending ?? delegatedCorrections.filter((c) => c.status === "PENDING").length;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="page-title">Attendance & Regularization</h1>
            {isAttendanceApprover && (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                Designated Approver
              </span>
            )}
          </div>
          <p className="page-subtitle">
            {isAttendanceApprover
              ? "Track your work hours and authorize punch timing regularizations for assigned team members"
              : "Track your work hours, morning punches, and request attendance corrections"}
          </p>
        </div>

        {/* Request Correction CTA Button (Always available for employee's own adjustments) */}
        {!isDeleted && (
          <button
            onClick={() => {
              setCorrectionPrefillDate(new Date().toISOString().split("T")[0]);
              setIsCorrectionModalOpen(true);
            }}
            className="btn-primary text-center inline-flex items-center justify-center gap-2 text-xs sm:text-sm py-2.5 px-4 shadow-sm cursor-pointer w-full sm:w-auto shrink-0"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Request Attendance Correction</span>
          </button>
        )}
      </div>

      {/* Delegated Approvals Tab Switcher (For employees assigned as attendance approvers) */}
      {(isAttendanceApprover || delegatedCorrections.length > 0) && (
        <div className="border-b border-slate-200">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
            <button
              type="button"
              onClick={() => setActiveTab("my")}
              className={`pb-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === "my"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              My Attendance & Regularization
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("team-punches")}
              className={`pb-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "team-punches"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>Team Punches & Attendance</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("team-regularizations")}
              className={`pb-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "team-regularizations"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>Team Regularizations</span>
              {pendingDelegatedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800">
                  {pendingDelegatedCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* View Routing based on Active Tab */}
      {activeTab === "team-punches" && (isAttendanceApprover || delegatedCorrections.length > 0) ? (
        <TeamPunchesView onSwitchToRegularizations={() => setActiveTab("team-regularizations")} />
      ) : activeTab === "team-regularizations" && (isAttendanceApprover || delegatedCorrections.length > 0) ? (
        <DelegatedCorrectionReview
          reviews={delegatedCorrections}
          counts={delegatedCounts}
          loading={correctionsLoading}
          onUpdate={() => {
            fetchCorrections();
            fetchData();
          }}
        />
      ) : (
        /* My Attendance View */
        <>
          {isDeleted ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center">
              <p className="text-rose-600 font-semibold">
                You can no longer clock in or out because your employee records have been deactivated.
              </p>
            </div>
          ) : (
            <div className="space-y-4 mb-2">
              {/* Yesterday's Shift Locked Missing Punch Alert Banner */}
              {yesterdayMissingPunch && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border border-amber-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                      <AlertTriangle className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500 text-white shadow-2xs">
                          Yesterday's Shift Locked
                        </span>
                        <span className="text-xs font-bold text-amber-900">
                          Missing Clock-Out on {format(yesterday, "MMM dd, yyyy")}
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 font-medium mt-1">
                        Your shift from yesterday was locked at 00:00 hrs because clock-out was not recorded. Today's punch session is completely separate. Please submit an attendance correction for yesterday.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
                      setCorrectionPrefillDate(yStr);
                      setIsCorrectionModalOpen(true);
                    }}
                    className="self-start sm:self-auto shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                  >
                    <span>Apply for {format(yesterday, "MMM dd")} Correction</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <CheckInButton
                todayRecord={todayRecord}
                lateAllowance={lateAllowance}
                isLocationExempt={isLocationExempt}
                onAction={fetchData}
                onOpenCorrection={(date?: string) => {
                  setCorrectionPrefillDate(date || new Date().toISOString().split("T")[0]);
                  setIsCorrectionModalOpen(true);
                }}
                onOpenLeave={(date?: string) => {
                  setLeavePrefillDate(date || new Date().toISOString().split("T")[0]);
                  setIsLeaveModalOpen(true);
                }}
              />
            </div>
          )}

          {/* Top Stats */}
          <AttendanceStats history={history} financialYear={financialYear} monthAttendance={monthAttendance} />

          {/* Attendance History */}
          <AttendanceHistory
            history={history}
            onOpenCorrection={(dateStr: string) => {
              setCorrectionPrefillDate(dateStr);
              setIsCorrectionModalOpen(true);
            }}
            onOpenLeave={(dateStr: string) => {
              setLeavePrefillDate(dateStr);
              setIsLeaveModalOpen(true);
            }}
          />

          {/* Employee Correction Requests History */}
          <EmployeeCorrectionHistory
            corrections={corrections}
            loading={correctionsLoading}
            monthlyQuota={monthlyQuota}
          />
        </>
      )}

      {/* Request Correction Modal */}
      <RequestCorrectionModal
        isOpen={isCorrectionModalOpen}
        initialDate={correctionPrefillDate}
        monthlyQuota={monthlyQuota}
        onClose={() => {
          setIsCorrectionModalOpen(false);
          setCorrectionPrefillDate("");
        }}
        onSuccess={() => {
          fetchCorrections();
          fetchData();
        }}
      />

      {/* Apply Leave for Absent Regularization Modal */}
      <ApplyLeaveModal
        open={isLeaveModalOpen}
        isRegularization={true}
        targetDate={leavePrefillDate}
        allowedTypes={["SICK", "CASUAL"]}
        onClose={() => {
          setIsLeaveModalOpen(false);
          setLeavePrefillDate("");
        }}
        onSuccess={() => {
          fetchCorrections();
          fetchData();
        }}
      />
    </div>
  );
};

export default Attendance;