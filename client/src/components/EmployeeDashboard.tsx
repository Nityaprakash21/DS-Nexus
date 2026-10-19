import { ArrowRightIcon, CalendarIcon, FileTextIcon, IndianRupee, PalmtreeIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AttendanceCalendar from "./attendance/AttendanceCalendar";
import { EmployeePunctualityMeter, type EmployeePunctualityData } from "./PunctualityMeter";

interface EmployeeDashboardProps {
  data: {
    employee: {
      firstName?: string;
      lastName?: string;
      position?: string;
      department?: string;
      employeeCode?: string;
    };
    currentMonthAttendance: number;
    pendingLeaves: number;
    remainingLeaves?: number;
    leaveSummary?: {
      totalQuota: number;
      consumed: number;
      remaining: number;
      allLeavesConsumed?: boolean;
      financialYear?: string;
      breakdown?: {
        casual: { consumed: number; total: number; remaining: number };
        annual: { consumed: number; total: number; remaining: number };
        sick: { consumed: number; total: number; remaining: number };
      };
    };
    monthAttendance?: {
      month?: number;
      year?: number;
      monthName?: string;
      label?: string;
      presentDays?: number;
    };
    financialYear?: {
      label?: string;
      fullLabel?: string;
      presentDays?: number;
      totalHolidays?: number;
    };
    latestPayslip?: {
      netSalary?: number;
    };
    punctualityMeter?: EmployeePunctualityData;
  };
}

const EmployeeDashboard = ({ data }: EmployeeDashboardProps) => {
  const navigate = useNavigate();
  const emp = data.employee;
  const fyLabel = data.financialYear?.label || "FY 2026-27";
  const currentMonthName = new Date().toLocaleString("en-US", { month: "long" });
  const currentMonthYear = `${currentMonthName} ${new Date().getFullYear()}`;
  const monthLabel = data.monthAttendance?.label || currentMonthYear;
  const monthPresentDays = data.monthAttendance?.presentDays ?? data.currentMonthAttendance ?? data.financialYear?.presentDays ?? 0;

  const totalLeaveQuota = data.leaveSummary?.totalQuota ?? 35;
  const consumedLeaves = data.leaveSummary?.consumed ?? 0;
  const remainingLeaves = data.leaveSummary?.remaining ?? (data.remainingLeaves ?? Math.max(0, totalLeaveQuota - consumedLeaves));
  const allLeavesConsumed = Boolean(data.leaveSummary?.allLeavesConsumed) || remainingLeaves <= 0;

  const cards = [
    {
      icon: CalendarIcon,
      value: monthPresentDays,
      title: `Days Present (${monthLabel})`,
      subtitle: `${data.monthAttendance?.monthName || currentMonthName} attendance records`,
      accent: "bg-indigo-500/70 group-hover:bg-indigo-500",
      iconBg: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100/80",
      link: "/attendance"
    },
    {
      icon: PalmtreeIcon,
      value: remainingLeaves,
      total: totalLeaveQuota,
      title: `Remaining Leaves (${fyLabel})`,
      subtitle: consumedLeaves > 0
        ? `${consumedLeaves} taken • ${remainingLeaves} of ${totalLeaveQuota} left`
        : `All ${totalLeaveQuota} leaves available`,
      accent: "bg-emerald-500/70 group-hover:bg-emerald-500",
      iconBg: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100/80",
      link: "/leave"
    },
    {
      icon: FileTextIcon,
      value: data.pendingLeaves,
      title: "Pending Leaves",
      subtitle: data.pendingLeaves > 0 ? "Awaiting manager approval" : "No pending requests",
      accent: "bg-amber-500/70 group-hover:bg-amber-500",
      iconBg: "bg-amber-50 text-amber-600 group-hover:bg-amber-100/80",
      link: "/leave"
    },
    {
      icon: IndianRupee,
      value: data.latestPayslip ? `₹${data.latestPayslip.netSalary?.toLocaleString()}` : "N/A",
      title: "Latest Payslip",
      subtitle: data.latestPayslip ? "Most recent payout" : "No payslips issued",
      accent: "bg-purple-500/70 group-hover:bg-purple-500",
      iconBg: "bg-purple-50 text-purple-600 group-hover:bg-purple-100/80",
      link: "/payslips"
    }
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="page-title">Welcome, {emp?.firstName}!</h1>
            {emp?.employeeCode && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs tracking-wider">
                <span className="text-indigo-400 font-sans font-normal text-[11px]">Employee Code:</span> #{emp.employeeCode}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {fyLabel} (Apr - Mar)
            </span>
          </div>
          <p className="page-subtitle flex items-center gap-2 flex-wrap">
            {emp?.employeeCode && (
              <span className="sm:hidden inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[11px] font-bold border border-indigo-200/70">
                #{emp.employeeCode}
              </span>
            )}
            <span>{emp?.position}</span>
            <span>•</span>
            <span>{emp?.department || "Not assigned"}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/attendance" className="btn-primary text-center inline-flex items-center justify-center gap-2 text-xs sm:text-sm py-2 px-4">
            Mark Attendance <ArrowRightIcon className="w-4 h-4" />
          </Link>
          {allLeavesConsumed ? (
            <div className="flex flex-col sm:items-end gap-1">
              <button
                type="button"
                disabled
                title="All leaves have been consumed already"
                className="bg-slate-200 text-slate-400 border border-slate-300 text-center text-xs sm:text-sm py-2 px-4 rounded-xl font-medium cursor-not-allowed shadow-none"
              >
                Apply for Leave
              </button>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                All leaves has been consumed already
              </span>
            </div>
          ) : (
            <Link to="/leave" className="btn-secondary text-center text-xs sm:text-sm py-2 px-4">
              Apply for Leave
            </Link>
          )}
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {cards.map((card, index) => {
          const CardWrapper = card.link ? Link : 'div';
          return (
            <CardWrapper
              key={index}
              to={card.link || ""}
              className="card card-hover p-4 sm:p-5 relative overflow-hidden group flex items-center justify-between transition-all"
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-full ${card.accent}`} />
                <p className="text-xs sm:text-sm font-semibold text-slate-700 truncate" title={card.title}>
                  {card.title}
                </p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                    {card.value}
                  </span>
                  {card.total !== undefined && (
                    <span className="text-sm font-semibold text-slate-400 font-mono">
                      / {card.total}
                    </span>
                  )}
                  {card.total !== undefined && (
                    <span className="text-xs font-medium text-slate-400 ml-0.5">
                      leaves
                    </span>
                  )}
                </div>
                {card.subtitle && (
                  <p className="text-xs text-slate-500 mt-1 truncate" title={card.subtitle}>
                    {card.subtitle}
                  </p>
                )}
              </div>
              <card.icon className={`size-10 p-2.5 rounded-lg ${card.iconBg} transition-colors duration-200 shrink-0`} />
            </CardWrapper>
          );
        })}
      </div>

      {/* Personal Employee Punctuality Meter */}
      {data.punctualityMeter && (
        <EmployeePunctualityMeter data={data.punctualityMeter} />
      )}

      {/* Attendance Calendar */}
      <AttendanceCalendar
        isAdmin={false}
        onApplyCorrection={(dateStr) => navigate("/attendance", { state: { prefillDate: dateStr, openModal: "correction" } })}
        onApplyLeave={(dateStr) => navigate("/attendance", { state: { prefillDate: dateStr, openModal: "leave" } })}
      />
    </div>
  );
};

export default EmployeeDashboard;