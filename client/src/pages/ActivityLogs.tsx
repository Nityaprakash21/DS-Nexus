import React, { useState, useEffect } from "react";
import {
  ScrollText,
  Search,
  Calendar,
  Filter,
  Users,
  ShieldAlert,
  RefreshCw,
  FileSpreadsheet,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarRange,
} from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../../context/AuthContext";

export interface ActivityLogItem {
  _id: string;
  userId?: string;
  employeeId?: string;
  userName: string;
  userEmail?: string;
  userRole: "ADMIN" | "EMPLOYEE" | "SYSTEM";
  category:
    | "AUTH"
    | "ATTENDANCE"
    | "LEAVE"
    | "PROFILE"
    | "EMPLOYEES"
    | "DEPARTMENTS"
    | "HOLIDAYS"
    | "INCENTIVES"
    | "PAYSLIPS"
    | "KPA"
    | "FEEDBACK"
    | "SETTINGS"
    | "SYSTEM";
  action: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: "SUCCESS" | "WARNING" | "FAILED";
  createdAt: string;
}

export interface UserOption {
  id: string;
  name: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  AUTH: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  ATTENDANCE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  LEAVE: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  PROFILE: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  EMPLOYEES: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  DEPARTMENTS: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  HOLIDAYS: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  INCENTIVES: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  PAYSLIPS: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  KPA: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  FEEDBACK: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  SETTINGS: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300" },
  SYSTEM: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
};

const formatLogTimestamp = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { date: "-", time: "", relative: "" };

  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const timeFormatted = `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;

  // Relative time
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative = "Just now";
  if (diffMins >= 1 && diffMins < 60) relative = `${diffMins}m ago`;
  else if (diffHours >= 1 && diffHours < 24) relative = `${diffHours}h ago`;
  else if (diffDays === 1) relative = "Yesterday";
  else if (diffDays > 1) relative = `${diffDays}d ago`;

  return {
    date: `${day}-${month}-${year}`,
    time: timeFormatted,
    relative,
  };
};

const ActivityLogs: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  // Data states
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Stats
  const [stats, setStats] = useState({
    todayCount: 0,
    totalCount: 0,
    activeUsersToday: 0,
    failedCount: 0,
  });

  // Filter states
  const [selectedUser, setSelectedUser] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Inspection Modal
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<ActivityLogItem | null>(null);

  // Fetch Users for Dropdown
  const fetchUsers = async () => {
    try {
      const res = await api.get("/activity-logs/users");
      if (res.data?.success) {
        setUsersList(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch users list for logs:", err);
    }
  };

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await api.get("/activity-logs/stats");
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  // Fetch Activity Logs
  const fetchLogs = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      const params: Record<string, any> = {
        page,
        limit,
      };

      if (selectedUser !== "ALL") params.userId = selectedUser;
      if (selectedCategory !== "ALL") params.category = selectedCategory;
      if (selectedStatus !== "ALL") params.status = selectedStatus;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await api.get("/activity-logs", { params });
      if (res.data?.success) {
        setLogs(res.data.data || []);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
        if (showToast) toast.success("Activity logs refreshed.");
      }
    } catch (err: any) {
      console.error("Failed to fetch activity logs:", err);
      toast.error(err.response?.data?.error || "Failed to load activity logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchStats();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin, page, limit, selectedUser, selectedCategory, selectedStatus, startDate, endDate]);

  // Handle Search Debounce / Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  // Quick Date Presets
  const applyDatePreset = (preset: "TODAY" | "YESTERDAY" | "LAST_7" | "THIS_MONTH" | "ALL") => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    setPage(1);

    if (preset === "TODAY") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "YESTERDAY") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split("T")[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "LAST_7") {
      const past7 = new Date(today);
      past7.setDate(past7.getDate() - 7);
      setStartDate(past7.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "THIS_MONTH") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else {
      setStartDate("");
      setEndDate("");
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedUser("ALL");
    setSelectedCategory("ALL");
    setSelectedStatus("ALL");
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
    setPage(1);
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      toast.loading("Preparing export...", { id: "export-logs" });

      const params: Record<string, any> = {
        limit: "all",
      };

      if (selectedUser !== "ALL") params.userId = selectedUser;
      if (selectedCategory !== "ALL") params.category = selectedCategory;
      if (selectedStatus !== "ALL") params.status = selectedStatus;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await api.get("/activity-logs", { params });
      const exportItems: ActivityLogItem[] = res.data?.data || logs;

      if (exportItems.length === 0) {
        toast.error("No activity logs to export.", { id: "export-logs" });
        return;
      }

      const rows = exportItems.map((item, idx) => {
        const { date, time } = formatLogTimestamp(item.createdAt);
        return {
          "SL NO": idx + 1,
          DATE: date,
          TIME: time,
          "EMPLOYEE NAME": item.userName,
          ROLE: item.userRole,
          MODULE: item.category,
          ACTION: item.action,
          DESCRIPTION: item.description,
          STATUS: item.status,
          "IP ADDRESS": item.ipAddress || "-",
          "CLIENT / DEVICE": item.userAgent || "-",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-fit column widths
      worksheet["!cols"] = [
        { wch: 8 }, // SL NO
        { wch: 14 }, // DATE
        { wch: 12 }, // TIME
        { wch: 26 }, // EMPLOYEE NAME
        { wch: 12 }, // ROLE
        { wch: 16 }, // MODULE
        { wch: 20 }, // ACTION
        { wch: 45 }, // DESCRIPTION
        { wch: 12 }, // STATUS
        { wch: 18 }, // IP ADDRESS
        { wch: 35 }, // CLIENT / DEVICE
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Logs");

      const dateStamp = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `Activity_Audit_Logs_${dateStamp}.xlsx`);

      toast.success("Excel audit report downloaded successfully!", { id: "export-logs" });
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export activity logs.", { id: "export-logs" });
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Admin Privileges Required</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-md">
          The User Activity & Audit Logs system is strictly reserved for administrators. Please log in with an administrator account to view audit events.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
              <ScrollText className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              User Activity & Audit Logs
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-300">
              Admin Exclusive
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Track user logins, password modifications, attendance sessions, profile updates, and critical system actions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchLogs(true);
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Activities</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-slate-800 mt-1">
            {stats.todayCount}
          </p>
          <span className="text-[10px] text-emerald-600 font-bold mt-0.5 inline-block">
            Events recorded today
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Users Today</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-indigo-700 mt-1">
            {stats.activeUsersToday}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 inline-block font-medium">
            Distinct accounts active
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Failed / Warnings</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-rose-700 mt-1">
            {stats.failedCount}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 inline-block font-medium">
            Security alerts / failed logins
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Audit Trail</span>
            <ScrollText className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-purple-700 mt-1">
            {stats.totalCount}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 inline-block font-medium">
            Lifetime logs stored
          </span>
        </div>
      </div>

      {/* Main Filter & Query Section */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* EMPLOYEE DROPDOWN */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Select Employee</span>
            </label>
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setPage(1);
              }}
              className="w-full p-2.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Employees</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* FROM DATE (As explicitly requested: "date wise from and to date") */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>From Date</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* TO DATE */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5 text-emerald-600" />
              <span>To Date</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* MODULE CATEGORY FILTER */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-purple-600" />
              <span>Module / Category</span>
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full p-2.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">All Modules</option>
              <option value="AUTH">Authentication & Login</option>
              <option value="ATTENDANCE">Attendance & Punches</option>
              <option value="LEAVE">Leaves & Approvals</option>
              <option value="PROFILE">Profile Changes</option>
              <option value="INCENTIVES">Incentives</option>
              <option value="EMPLOYEES">Employees</option>
              <option value="DEPARTMENTS">Departments</option>
              <option value="HOLIDAYS">Holidays</option>
              <option value="PAYSLIPS">Payslips</option>
              <option value="KPA">KPA & Appraisal</option>
              <option value="FEEDBACK">Feedback</option>
            </select>
          </div>
        </div>

        {/* Date Presets & Search Row */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Presets:</span>
            {[
              { label: "Today", preset: "TODAY" as const },
              { label: "Yesterday", preset: "YESTERDAY" as const },
              { label: "Last 7 Days", preset: "LAST_7" as const },
              { label: "This Month", preset: "THIS_MONTH" as const },
              { label: "All Time", preset: "ALL" as const },
            ].map((item) => (
              <button
                key={item.preset}
                type="button"
                onClick={() => applyDatePreset(item.preset)}
                className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Search Input & Reset Button */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search description, IP, user name..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/60 font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shrink-0 cursor-pointer"
            >
              Search
            </button>

            {(selectedUser !== "ALL" ||
              selectedCategory !== "ALL" ||
              selectedStatus !== "ALL" ||
              startDate ||
              endDate ||
              searchTerm) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors shrink-0 cursor-pointer"
              >
                Reset
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
            <p className="text-xs font-semibold">Loading user activity logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <ScrollText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No activity logs found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No actions match your current user or date filters. Try broadening your date range or clearing the filter.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 px-4 py-1.5 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4 w-44">Date & Time</th>
                  <th className="py-3 px-4 w-52">User Account</th>
                  <th className="py-3 px-3 w-32">Module</th>
                  <th className="py-3 px-3 w-36">Action</th>
                  <th className="py-3 px-4 min-w-[280px]">Activity Description</th>
                  <th className="py-3 px-3 text-center w-24">Status</th>
                  <th className="py-3 px-3 w-32">IP / Device</th>
                  <th className="py-3 px-3 text-center w-16">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {logs.map((item) => {
                  const { date, time, relative } = formatLogTimestamp(item.createdAt);
                  const catStyle = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.SYSTEM;

                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLogForDetail(item)}
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-xs">{date}</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{time}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-indigo-600 font-semibold">{relative}</span>
                          </div>
                        </div>
                      </td>

                      {/* User Account */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                              item.userRole === "ADMIN"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                            }`}
                          >
                            {item.userName ? item.userName.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate text-xs">
                              {item.userName}
                            </p>
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                                  item.userRole === "ADMIN"
                                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {item.userRole}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Module */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide uppercase border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                        >
                          {item.category}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.action}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 text-slate-800">
                        <p className="line-clamp-2 text-xs font-semibold leading-relaxed">
                          {item.description}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {item.status === "SUCCESS" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            Success
                          </span>
                        ) : item.status === "FAILED" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                            Warning
                          </span>
                        )}
                      </td>

                      {/* IP / Device */}
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] font-semibold text-slate-700">
                            {item.ipAddress || "127.0.0.1"}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={item.userAgent}>
                            {item.userAgent ? (item.userAgent.includes("Mobile") ? "Mobile Device" : "Desktop Browser") : "Localhost"}
                          </span>
                        </div>
                      </td>

                      {/* Details Button */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogForDetail(item);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Inspect Metadata & Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {logs.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div>
              Showing <span className="font-bold text-slate-800">{(page - 1) * limit + 1}</span> to{" "}
              <span className="font-bold text-slate-800">
                {Math.min(page * limit, totalCount)}
              </span>{" "}
              of <span className="font-bold text-slate-800">{totalCount}</span> log entries
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>

              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-bold text-slate-700 whitespace-nowrap">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Detail Inspection Modal */}
      {selectedLogForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <ScrollText className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">Audit Log Details</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ID: {selectedLogForDetail._id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Summary Block */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Action
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded break-all ${
                      CATEGORY_COLORS[selectedLogForDetail.category]?.bg || "bg-slate-100"
                    } ${CATEGORY_COLORS[selectedLogForDetail.category]?.text || "text-slate-700"}`}
                  >
                    {selectedLogForDetail.category} • {selectedLogForDetail.action}
                  </span>
                </div>
                <p className="text-sm font-black text-slate-800 break-words">
                  {selectedLogForDetail.description}
                </p>
              </div>

              {/* Attributes Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-100 bg-white min-w-0 overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">User Name</span>
                  <p className="font-black text-slate-800 mt-0.5 break-words">{selectedLogForDetail.userName}</p>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 bg-white min-w-0 overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Role</span>
                  <p className="font-black text-indigo-700 mt-0.5 break-words">{selectedLogForDetail.userRole}</p>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 bg-white min-w-0 overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Timestamp</span>
                  <p className="font-bold text-slate-800 mt-0.5 break-words">
                    {new Date(selectedLogForDetail.createdAt).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-slate-100 bg-white min-w-0 overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">IP Address</span>
                  <p className="font-mono font-bold text-slate-800 mt-0.5 text-xs break-all" title={selectedLogForDetail.ipAddress}>
                    {selectedLogForDetail.ipAddress || "127.0.0.1"}
                  </p>
                </div>
              </div>

              {/* Client User-Agent */}
              <div className="p-3 rounded-xl border border-slate-100 bg-white space-y-1 min-w-0 overflow-hidden">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Browser / User Agent
                </span>
                <p className="font-mono text-[11px] text-slate-600 break-all leading-relaxed">
                  {selectedLogForDetail.userAgent || "Local Client"}
                </p>
              </div>

              {/* Metadata JSON Viewer */}
              {selectedLogForDetail.metadata && Object.keys(selectedLogForDetail.metadata).length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Change Metadata / Payload Diff
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLogForDetail.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogForDetail(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
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

export default ActivityLogs;
