import { AlertCircleIcon, CalendarIcon, ClockIcon, Sparkles } from "lucide-react";
import { getFinancialYear, getHolidaysForFinancialYear } from "../../constants/marketHolidays";

interface MonthAttendanceData {
  month?: number;
  year?: number;
  monthName?: string;
  label?: string;
  presentDays?: number;
  lateDays?: number;
  avgHours?: string;
}

interface FinancialYearData {
  label: string;
  fullLabel?: string;
  presentDays?: number;
  lateDays?: number;
  avgHours?: string;
  totalHolidays?: number;
}

interface AttendanceStatsProps {
  history: any[];
  financialYear?: FinancialYearData | null;
  monthAttendance?: MonthAttendanceData | null;
}

const AttendanceStats = ({ history = [], financialYear, monthAttendance }: AttendanceStatsProps) => {
  const fy = getFinancialYear();
  const now = new Date();
  const currentMonthName = now.toLocaleString("en-US", { month: "long" });
  const currentMonthYear = `${currentMonthName} ${now.getFullYear()}`;
  const monthLabel = monthAttendance?.label || currentMonthYear;

  // Current calendar month date boundaries for month-basis fallback
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthHistory = history.filter((h) => {
    const d = new Date(h.date);
    return d >= startOfMonth && d <= endOfMonth;
  });

  // Fallback calculation from history if not passed from server
  const fyHistory = history.filter((h) => {
    const d = new Date(h.date);
    return d >= fy.startDate && d <= fy.endDate;
  });

  // Month-basis days present
  const totalPresent = monthAttendance?.presentDays !== undefined
    ? monthAttendance.presentDays
    : financialYear?.presentDays !== undefined
    ? financialYear.presentDays
    : monthHistory.filter((h) => h.status === "PRESENT" || h.status === "LATE").length;

  const totalLate = financialYear?.lateDays !== undefined
    ? financialYear.lateDays
    : fyHistory.filter((h) => h.status === "LATE" || h.isLateBuffer || h.wasLate).length;

  const totalHolidays = financialYear?.totalHolidays !== undefined
    ? financialYear.totalHolidays
    : getHolidaysForFinancialYear(fy.startYear).length;

  const validHoursHistory = fyHistory.filter((h) => typeof h.workingHours === "number" && h.workingHours > 0);
  const calculatedAvgHours = validHoursHistory.length > 0
    ? `${parseFloat((validHoursHistory.reduce((s, h) => s + h.workingHours, 0) / validHoursHistory.length).toFixed(1))} Hrs`
    : "0.0 Hrs";

  const avgHours = financialYear?.avgHours && financialYear.avgHours !== "8.5 Hrs"
    ? financialYear.avgHours
    : calculatedAvgHours;

  const stats = [
    {
      label: `Days Present (${monthLabel})`,
      subtitle: `${monthAttendance?.monthName || currentMonthName} attendance records`,
      value: totalPresent,
      icon: CalendarIcon,
      color: "indigo",
    },
    {
      label: `Late Arrivals (${fy.label})`,
      subtitle: "Logged late buffer arrivals",
      value: totalLate,
      icon: AlertCircleIcon,
      color: "amber",
    },
    {
      label: `Market Holidays (${fy.label})`,
      subtitle: "Official circular holidays",
      value: totalHolidays,
      icon: Sparkles,
      color: "purple",
    },
    {
      label: "Avg. Work Hrs",
      subtitle: "Live daily punch average",
      value: avgHours,
      icon: ClockIcon,
      color: "emerald",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="card card-hover p-5 flex items-center gap-4 relative overflow-hidden group"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full bg-slate-500/70 group-hover:bg-indigo-500/70" />
          <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-indigo-50 transition-colors duration-200 shrink-0">
            <s.icon className="w-5 h-5 text-slate-600 group-hover:text-indigo-600 transition-colors duration-200" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{s.label}</p>
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              {s.value}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AttendanceStats;