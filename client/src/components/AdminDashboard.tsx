import { useState } from "react";
import { Building2Icon, CalendarIcon, FileTextIcon, UsersIcon, Sparkles, CalendarClock } from "lucide-react";
import AttendanceCalendar from "./attendance/AttendanceCalendar";
import AdminReminderCalendar from "./admin/AdminReminderCalendar";

interface AdminDashboardData {
  totalEmployees: number;
  totalDepartments: number;
  todayAttendance: number;
  pendingLeaves: number;
  financialYear?: {
    label?: string;
    fullLabel?: string;
    totalHolidays?: number;
  };
}

const AdminDashboard = ({ data }: { data: AdminDashboardData }) => {
  const [activeCalendarTab, setActiveCalendarTab] = useState<"attendance" | "schedule">("schedule");
  const fyLabel = data.financialYear?.label || "FY 2026-27";
  const totalHolidays = data.financialYear?.totalHolidays ?? 20;

  const stats = [
    {
      icon: UsersIcon,
      value: data.totalEmployees,
      label: "Total Employees",
      description: "Active workforce"
    },
    {
      icon: Building2Icon,
      value: data.totalDepartments,
      label: "Departments",
      description: "Organization units"
    },
    {
      icon: CalendarIcon,
      value: data.todayAttendance,
      label: "Today's Attendance",
      description: "Checked in today"
    },
    {
      icon: Sparkles,
      value: totalHolidays,
      label: `Market Holidays (${fyLabel})`,
      description: "Official non-trading days"
    },
    {
      icon: FileTextIcon,
      value: data.pendingLeaves,
      label: "Pending Leaves",
      description: "Awaiting approval"
    }
  ];
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="page-title">Dashboard</h1>
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {fyLabel} (Apr - Mar)
          </span>
        </div>
        <p className="page-subtitle">Welcome back, Admin - here's your overview for {fyLabel}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="card card-hover p-5 sm:p-6 relative overflow-hidden group flex items-center justify-between">
            <div>
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-slate-500/70 group-hover:bg-indigo-500/70" />
              <p className="text-sm font-medium text-slate-700">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{s.value}</p>
            </div>
            <s.icon className="size-10 p-2.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors duration-200" />
          </div>
        ))}
      </div>

      {/* Horizontal Calendar Views Tab Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-2xs mb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveCalendarTab("schedule")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeCalendarTab === "schedule"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            <span>Executive Schedule</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeCalendarTab === "schedule"
                  ? "bg-white/20 text-white"
                  : "bg-purple-50 text-purple-700 border border-purple-200"
              }`}
            >
              Reminders & Tasks
            </span>
          </button>

          <button
            onClick={() => setActiveCalendarTab("attendance")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeCalendarTab === "attendance"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            <span>Staff Attendance</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeCalendarTab === "attendance"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {data.totalEmployees} Staff
            </span>
          </button>
        </div>
      </div>

      {activeCalendarTab === "attendance" ? (
        <AttendanceCalendar isAdmin={true} />
      ) : (
        <AdminReminderCalendar />
      )}
    </div>
  );
};

export default AdminDashboard;