import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Users,
  Search,
  RefreshCw,
  Eye,
  MapPin,
  ChevronRight,
  X,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import api from "../../api/axios";
// @ts-ignore
import { getDayTypeDisplay, getWorkingHoursDisplay } from "../../assets/assets";

interface PunchItem {
  type: "IN" | "OUT";
  time: string;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  accuracyMeters?: number;
  locationVerified?: boolean;
}

interface TeamMember {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  position: string;
  isLocationExempt?: boolean;
}

interface TodaySummaryItem {
  employee: TeamMember;
  recordId: string | null;
  hasPunchedToday: boolean;
  isCurrentlyIn: boolean;
  firstInTime: string | null;
  lastPunchTime: string | null;
  lastPunchType: "IN" | "OUT" | null;
  punchesCount: number;
  workingHours: number;
  status: string;
  verdict: string;
  isLateBuffer: boolean;
  wasLate: boolean;
  requiresCorrection: boolean;
  punches: PunchItem[];
}

interface TeamAttendanceRecord {
  id: string;
  employeeId?: string;
  employee: TeamMember | null;
  date: string;
  checkIn?: string;
  checkOut?: string;
  currentStatus?: string;
  status: string;
  workingHours?: number;
  dayType?: string;
  verdict?: string;
  isLateBuffer?: boolean;
  wasLate?: boolean;
  lateCountThisMonth?: number;
  requiresCorrection?: boolean;
  punches: PunchItem[];
}

interface TeamPunchesViewProps {
  onSwitchToRegularizations?: () => void;
}

const TeamPunchesView: React.FC<TeamPunchesViewProps> = ({ onSwitchToRegularizations }) => {
  const [loading, setLoading] = useState(true);
  const [assignedTeam, setAssignedTeam] = useState<TeamMember[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodaySummaryItem[]>([]);
  const [history, setHistory] = useState<TeamAttendanceRecord[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [punchDetailRecord, setPunchDetailRecord] = useState<TeamAttendanceRecord | null>(null);

  const fetchTeamPunches = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { limit: 100 };
      if (selectedMemberId !== "ALL") {
        params.employeeId = selectedMemberId;
      }
      if (selectedDate) {
        params.date = selectedDate;
      }

      const res = await api.get("/attendance/team-punches", { params });
      setAssignedTeam(res.data?.assignedTeam || []);
      setTodaySummary(res.data?.todaySummary || []);
      setHistory(res.data?.history || []);
    } catch (err: any) {
      console.error("Failed to load team punches:", err);
      toast.error(err.response?.data?.error || "Failed to load team attendance punches.");
    } finally {
      setLoading(false);
    }
  }, [selectedMemberId, selectedDate]);

  useEffect(() => {
    fetchTeamPunches();
  }, [fetchTeamPunches]);

  // Filter history records based on search query
  const filteredHistory = history.filter((r) => {
    if (selectedMemberId !== "ALL" && r.employee?.id !== selectedMemberId && r.employeeId !== selectedMemberId) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const empName = (r.employee?.name || "").toLowerCase();
    const empCode = (r.employee?.employeeCode || "").toLowerCase();
    const verdict = (r.verdict || "").toLowerCase();
    const dateFormatted = format(new Date(r.date), "MMM dd, yyyy").toLowerCase();
    return empName.includes(q) || empCode.includes(q) || verdict.includes(q) || dateFormatted.includes(q);
  });

  // Helper: format clock time
  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return "-";
    try {
      return format(new Date(timeStr), "hh:mm a");
    } catch {
      return "-";
    }
  };

  // Helper: compute sequential sessions from punches array
  const computeSessions = (punches: PunchItem[]) => {
    const sessions: Array<{
      inTime: string;
      outTime?: string;
      durationMinutes?: number;
      distanceMeters?: number;
      locationVerified?: boolean;
    }> = [];

    let currentIn: PunchItem | null = null;
    for (const p of punches) {
      if (p.type === "IN") {
        currentIn = p;
      } else if (p.type === "OUT" && currentIn) {
        const diffMs = new Date(p.time).getTime() - new Date(currentIn.time).getTime();
        const durationMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
        sessions.push({
          inTime: currentIn.time,
          outTime: p.time,
          durationMinutes,
          distanceMeters: currentIn.distanceMeters,
          locationVerified: currentIn.locationVerified,
        });
        currentIn = null;
      }
    }

    if (currentIn) {
      sessions.push({
        inTime: currentIn.time,
        distanceMeters: currentIn.distanceMeters,
        locationVerified: currentIn.locationVerified,
      });
    }

    return sessions;
  };

  if (loading && assignedTeam.length === 0) {
    return (
      <div className="card p-12 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
        <p className="font-semibold text-sm text-slate-700">Loading team punches & live attendance...</p>
        <p className="text-xs text-slate-400 mt-1">Retrieving assigned personnel punch logs</p>
      </div>
    );
  }

  if (assignedTeam.length === 0) {
    return (
      <div className="card p-12 text-center border border-dashed border-slate-200">
        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-800 text-base">No Assigned Team Members</h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
          You are currently not designated as the Attendance Approver for any team members in the Role Authorization matrix. Once Super Admin assigns personnel to you, their live punches and attendance logs will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Approver Header Notice */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50 via-slate-50 to-emerald-50/70 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-600 text-white">
                Attendance Approver Oversight
              </span>
              <span className="text-xs font-bold text-slate-700">
                {assignedTeam.length} Assigned Team Member{assignedTeam.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
              Monitoring real-time punches, morning check-ins, multi-session clock logs, and working hour verdicts for your assigned personnel.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          {onSwitchToRegularizations && (
            <button
              type="button"
              onClick={onSwitchToRegularizations}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <span>Review Regularizations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={fetchTeamPunches}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh punches data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Real-Time Live Punch Status Cards (Today) */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">Today's Live Punch Status</h3>
            <span className="text-[11px] font-bold text-slate-400 font-mono">
              ({format(new Date(), "MMM dd, yyyy")})
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Real-time punch state & session duration
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {todaySummary.map((item) => {
            const isCurrentlyIn = item.isCurrentlyIn;
            const hasPunched = item.hasPunchedToday;

            return (
              <div
                key={item.employee.id}
                className="card card-hover p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between border-slate-200/90 shadow-2xs"
              >
                {/* Status indicator bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    isCurrentlyIn
                      ? "bg-emerald-500"
                      : hasPunched
                      ? "bg-amber-500"
                      : "bg-slate-300"
                  }`}
                />

                {/* Card Top: Member info & live badge */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-800 font-black text-xs flex items-center justify-center shrink-0">
                        {item.employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 leading-snug">
                          {item.employee.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-mono font-semibold text-indigo-600">
                            #{item.employee.employeeCode}
                          </span>
                          <span>•</span>
                          <span className="truncate max-w-[130px]">{item.employee.position}</span>
                        </div>
                      </div>
                    </div>

                    {/* Live status badge */}
                    {isCurrentlyIn ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        IN
                      </span>
                    ) : hasPunched ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        OUT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                        NOT CLOCKED
                      </span>
                    )}
                  </div>

                  {/* Punch metrics */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">First Check-In</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {formatTime(item.firstInTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Last Punch</span>
                      <div className="flex items-center gap-1 font-bold text-slate-800 font-mono">
                        {item.lastPunchType === "IN" ? (
                          <ArrowUpRight className="w-3 h-3 text-emerald-600 shrink-0" />
                        ) : item.lastPunchType === "OUT" ? (
                          <ArrowDownRight className="w-3 h-3 text-amber-600 shrink-0" />
                        ) : null}
                        <span>{formatTime(item.lastPunchTime)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Working hours & details button */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-600 font-mono text-xs">
                      {item.punchesCount} punch{item.punchesCount !== 1 ? "es" : ""}
                    </span>
                    {typeof item.workingHours === "number" && item.workingHours > 0 && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-600 font-semibold font-mono">
                          {item.workingHours} hrs
                        </span>
                      </>
                    )}
                  </div>

                  {item.punches && item.punches.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPunchDetailRecord({
                          id: item.recordId || "today",
                          employee: item.employee,
                          date: new Date().toISOString(),
                          checkIn: item.firstInTime || undefined,
                          checkOut: item.lastPunchTime || undefined,
                          currentStatus: item.isCurrentlyIn ? "IN" : "OUT",
                          status: item.status,
                          workingHours: item.workingHours,
                          verdict: item.verdict,
                          punches: item.punches,
                        });
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer transition-colors"
                    >
                      <span>View Log</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Punches History Table */}
      <div className="card overflow-hidden border-slate-200/90 shadow-2xs">
        {/* Table Filter Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Assigned Team Punch History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily punch logs, shift sessions, GPS office verification, and duration for your personnel
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter by Member */}
            <div className="relative">
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer pr-8"
              >
                <option value="ALL">All Team Members ({assignedTeam.length})</option>
                {assignedTeam.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} (#{emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker Filter */}
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                title="Filter by specific date"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate("")}
                  className="ml-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear date"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="table-modern w-full min-w-[1080px]">
            <thead>
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Employee</th>
                <th className="px-6 py-4 whitespace-nowrap">Date</th>
                <th className="px-6 py-4 whitespace-nowrap">First In</th>
                <th className="px-6 py-4 whitespace-nowrap">Last Out</th>
                <th className="px-6 py-4 whitespace-nowrap">Total Punches</th>
                <th className="px-6 py-4 whitespace-nowrap">Work Hours</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No punch records found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      No matching attendance records for the selected team members or date.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredHistory.map((record) => {
                  const dayType = getDayTypeDisplay(record);
                  const firstInTime =
                    record.punches && record.punches.length > 0
                      ? record.punches.find((p) => p.type === "IN")?.time || record.checkIn
                      : record.checkIn;

                  const lastOutTime =
                    record.punches && record.punches.length > 0
                      ? (() => {
                          for (let i = record.punches.length - 1; i >= 0; i--) {
                            if (record.punches[i].type === "OUT") return record.punches[i].time;
                          }
                          return record.checkOut;
                        })()
                      : record.checkOut;

                  const punchCount =
                    record.punches?.length || (record.checkOut ? 2 : record.checkIn ? 1 : 0);

                  const sessionCount =
                    record.punches && record.punches.length > 2
                      ? Math.floor(record.punches.length / 2)
                      : 0;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Employee Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5 whitespace-nowrap">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                            {(record.employee?.name || "Emp")
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="whitespace-nowrap">
                            <span className="font-bold text-slate-900 text-xs block whitespace-nowrap">
                              {record.employee?.name || "Unknown"}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                              #{record.employee?.employeeCode || "-"} • {record.employee?.department || ""}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date Column */}
                      <td className="px-6 py-4 font-medium text-slate-900 text-xs whitespace-nowrap">
                        <span className="whitespace-nowrap inline-block">
                          {format(new Date(record.date), "MMM dd, yyyy")}
                        </span>
                      </td>

                      {/* First In Column */}
                      <td className="px-6 py-4 text-slate-700 font-semibold text-xs font-mono whitespace-nowrap">
                        <span className="whitespace-nowrap inline-block">
                          {formatTime(firstInTime)}
                        </span>
                      </td>

                      {/* Last Out Column */}
                      <td className="px-6 py-4 text-slate-700 font-semibold text-xs font-mono whitespace-nowrap">
                        {lastOutTime ? (
                          <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <span className="whitespace-nowrap font-mono">{formatTime(lastOutTime)}</span>
                            {sessionCount > 1 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-sans whitespace-nowrap shrink-0">
                                {sessionCount} sessions
                              </span>
                            )}
                          </div>
                        ) : record.checkIn ? (
                          <span className="text-emerald-600 font-medium text-xs whitespace-nowrap">Active Session</span>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* Total Punches Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setPunchDetailRecord(record)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/80 transition-all cursor-pointer whitespace-nowrap shrink-0"
                          title="Click to view complete punch log"
                        >
                          <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span className="whitespace-nowrap">{punchCount} Punch{punchCount !== 1 ? "es" : ""}</span>
                        </button>
                      </td>

                      {/* Work Hours Column */}
                      <td className="px-6 py-4 text-slate-700 font-medium text-xs font-mono whitespace-nowrap">
                        <span className="whitespace-nowrap inline-block">
                          {getWorkingHoursDisplay(record)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap"
                          title={record.verdict || undefined}
                        >
                          <span
                            className={`badge whitespace-nowrap shrink-0 ${
                              record.status === "PRESENT"
                                ? "badge-success"
                                : record.status === "LATE" || record.isLateBuffer
                                ? "badge-warning"
                                : "badge-danger"
                            }`}
                          >
                            {record.status === "PRESENT" && (record.isLateBuffer || record.wasLate)
                              ? "LATE (PRESENT)"
                              : record.status}
                          </span>
                          {dayType.label !== "-" && (
                            <span className={`badge whitespace-nowrap shrink-0 ${dayType.className}`}>{dayType.label}</span>
                          )}
                          {record.requiresCorrection && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap shrink-0">
                              Correction Needed
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setPunchDetailRecord(record)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" />
                          <span className="whitespace-nowrap">View Log</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Punch Log Modal */}
      {punchDetailRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-scale-up">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-500/20">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Punch Log & Session Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {punchDetailRecord.employee?.name} (#{punchDetailRecord.employee?.employeeCode}) •{" "}
                    {format(new Date(punchDetailRecord.date), "MMM dd, yyyy")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPunchDetailRecord(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                  <span className="font-extrabold text-xs text-slate-800 mt-0.5 block">
                    {punchDetailRecord.status}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Work</span>
                  <span className="font-extrabold text-xs text-indigo-600 mt-0.5 block font-mono">
                    {punchDetailRecord.workingHours || 0} Hrs
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Punches Count</span>
                  <span className="font-extrabold text-xs text-slate-800 mt-0.5 block font-mono">
                    {punchDetailRecord.punches?.length || 0}
                  </span>
                </div>
              </div>

              {/* Multi-Session Analysis */}
              {punchDetailRecord.punches && punchDetailRecord.punches.length > 2 && (() => {
                const sessions = computeSessions(punchDetailRecord.punches);
                return (
                  <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs">
                    <span className="font-bold text-indigo-950 block mb-2">
                      Multi-Session Breakdown ({sessions.length} sessions):
                    </span>
                    <div className="space-y-1.5">
                      {sessions.map((s, sIdx) => (
                        <div key={sIdx} className="flex items-center justify-between text-slate-700 font-mono">
                          <span>
                            Session {sIdx + 1}: {formatTime(s.inTime)} {s.outTime ? `→ ${formatTime(s.outTime)}` : "(Active)"}
                          </span>
                          <span className="font-bold text-indigo-600">
                            {s.durationMinutes !== undefined ? `${Math.floor(s.durationMinutes / 60)}h ${s.durationMinutes % 60}m` : "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Punch Sequence */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  Chronological Punch Sequence
                </h4>

                {!punchDetailRecord.punches || punchDetailRecord.punches.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    <p className="font-medium">No raw punch GPS events recorded for this entry.</p>
                    {punchDetailRecord.checkIn && (
                      <p className="mt-1 font-mono text-slate-700">
                        Check-in: {formatTime(punchDetailRecord.checkIn)} | Check-out:{" "}
                        {formatTime(punchDetailRecord.checkOut)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {punchDetailRecord.punches.map((p, idx) => {
                      const isIN = p.type === "IN";
                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                            isIN
                              ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                              : "bg-amber-50/50 border-amber-200 text-amber-950"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                                isIN ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs">
                                  {isIN ? "CLOCK IN" : "CLOCK OUT"}
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-800">
                                  {format(new Date(p.time), "hh:mm:ss a")}
                                </span>
                              </div>
                              {p.distanceMeters !== undefined && (
                                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  <span>{p.distanceMeters}m from office premises</span>
                                  {p.locationVerified && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded">
                                      Verified
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>

                          <span
                            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full ${
                              isIN
                                ? "bg-emerald-100/80 text-emerald-800"
                                : "bg-amber-100/80 text-amber-800"
                            }`}
                          >
                            {isIN ? "Session Start" : "Break / End"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Verdict note */}
              {punchDetailRecord.verdict && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950">
                  <span className="font-bold block text-indigo-900 mb-0.5">Official Verdict Note:</span>
                  <p>{punchDetailRecord.verdict}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setPunchDetailRecord(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamPunchesView;
