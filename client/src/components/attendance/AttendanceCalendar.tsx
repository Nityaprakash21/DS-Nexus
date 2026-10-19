import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  User,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Coffee,
  Sparkles,
  CalendarDays,
  X,
  FileText,
  Plus,
  Clock,
  Trash2,
  Tag,
  Check,
  Edit2,
  ListTodo,
  LogIn,
  LogOut,
  ArrowRight,
  History,
  Timer,
} from "lucide-react";
import api from "../../api/axios";
import { useHolidays, type HolidayItem } from "../../hooks/useHolidays";
import {
  type AdminReminderItem,
  dispatchInstantReminderNotification,
  isReminderStarted,
  getReminderDateString,
} from "../../hooks/useAdminNotifications";
import toast from "react-hot-toast";

interface LeaveItem {
  _id?: string;
  id?: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
}

interface CorrectionItem {
  _id?: string;
  id?: string;
  date: string;
  status: string;
  reason?: string;
}

export interface PunchSession {
  sessionNumber: number;
  inTime: string;
  outTime: string | null;
  isCurrentlyActive: boolean;
  durationMinutes: number | null;
  durationFormatted: string;
  breakAfterMinutes?: number | null;
  breakAfterFormatted?: string;
  breakAfterStart?: string | null;
  breakAfterEnd?: string | null;
}

interface AttendanceRecord {
  _id: string;
  employeeId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: "PRESENT" | "ABSENT" | "LATE";
  currentStatus?: "IN" | "OUT" | null;
  isLateBuffer?: boolean;
  wasLate?: boolean;
  lateCountThisMonth?: number;
  verdict?: string | null;
  requiresCorrection?: boolean;
  workingHours?: number | null;
  dayType?: "Full Day" | "Three Quarter Day" | "Half Day" | "Short Day" | "Absent" | null;
  punches?: Array<{ type: string; time: string }>;
}

interface EmployeeItem {
  id: string;
  _id: string;
  firstName: string;
  lastName: string;
  department?: string;
  position?: string;
  employeeCode?: string;
  isDeleted?: boolean;
  deactivationDate?: string | Date;
  employmentStatus?: string;
  updatedAt?: string | Date;
}

interface AttendanceCalendarProps {
  isAdmin?: boolean;
  onApplyCorrection?: (dateStr: string) => void;
  onApplyLeave?: (dateStr: string) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const TASK_CATEGORIES = [
  "General", "Meeting", "Review", "Deadline", "Payroll", "Operations", "Personal"
];

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

// Helper: Format time slot
const formatTimeSlot = (startTime?: string | null, endTime?: string | null, isAllDay?: boolean) => {
  if (isAllDay) return "All Day";
  if (!startTime) return "";

  const formatSingle = (timeStr: string) => {
    const [hStr, mStr] = timeStr.split(":");
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${mStr || "00"} ${ampm}`;
  };

  const startFormatted = formatSingle(startTime);
  if (!endTime) return startFormatted;
  return `${startFormatted} – ${formatSingle(endTime)}`;
};

// Helper: Determine if an attendance record represents a late arrival in the 10:15 - 10:30 AM buffer
export const isLateArrivalRecord = (rec: AttendanceRecord | null | undefined): boolean => {
  if (!rec) return false;

  // 1. If verdict explicitly says "On Time", it is NEVER a late arrival
  if (rec.verdict && /on time/i.test(rec.verdict)) {
    return false;
  }

  // 2. Check actual first punch time (IST) - strictly between 10:15 AM and 10:30 AM (616 - 630 minutes)
  const getPunchISTMinutes = (timeStr?: string | null): number | null => {
    if (!timeStr) return null;
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return null;
    return (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
  };

  let firstInMinutes: number | null = null;
  if (rec.punches && rec.punches.length > 0) {
    const firstIn = rec.punches.find((p) => p.type === "IN");
    if (firstIn?.time) {
      firstInMinutes = getPunchISTMinutes(firstIn.time);
    }
  }
  if (firstInMinutes === null && rec.checkIn) {
    firstInMinutes = getPunchISTMinutes(rec.checkIn);
  }

  if (firstInMinutes !== null) {
    // If clocked in on time (<= 10:15 AM IST, i.e. 615 mins), NEVER late
    if (firstInMinutes <= 615) {
      return false;
    }
    // Strictly in late buffer window: 10:15 AM to 10:30 AM (616 to 630 mins)
    if (firstInMinutes > 615 && firstInMinutes <= 630) {
      return true;
    }
    // If clocked in after 10:30 AM (> 630 mins), that is absent/past cutoff, NOT late buffer
    return false;
  }

  // 3. Fallback when punch timestamps are not available
  if (rec.status === "LATE" || rec.isLateBuffer) {
    return true;
  }

  if (
    rec.verdict &&
    /late arrival|late buffer/i.test(rec.verdict) &&
    !/after 10:30/i.test(rec.verdict)
  ) {
    return true;
  }

  return false;
};

const AttendanceCalendar = ({ isAdmin = false, onApplyCorrection, onApplyLeave }: AttendanceCalendarProps) => {
  const today = new Date();
  const { holidays, getHoliday } = useHolidays();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isHolidayScheduleOpen, setIsHolidayScheduleOpen] = useState<boolean>(false);

  // Reminders / Tasks State
  const [reminders, setReminders] = useState<AdminReminderItem[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | "PRIORITY" | "MEDIUM" | "NORMAL">("ALL");

  // Day Detail Modal State (Combined Attendance + Reminders)
  const [selectedDateDetail, setSelectedDateDetail] = useState<{
    dateStr: string;
    dayName: string;
    isWeekend: boolean;
    holiday: HolidayItem | null;
    record: AttendanceRecord | null;
    reminders: AdminReminderItem[];
    isInactive?: boolean;
  } | null>(null);

  // Task Create / Edit Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<AdminReminderItem | null>(null);
  const [modalDate, setModalDate] = useState<string>("");
  const [modalDateDisplay, setModalDateDisplay] = useState<string>("");
  const datePickerRef = useRef<HTMLInputElement>(null);
  const [modalTitle, setModalTitle] = useState<string>("");
  const [modalDescription, setModalDescription] = useState<string>("");
  const [modalStartTime, setModalStartTime] = useState<string>("10:00");
  const [modalEndTime, setModalEndTime] = useState<string>("11:00");
  const [modalIsAllDay, setModalIsAllDay] = useState<boolean>(false);
  const [modalPriority, setModalPriority] = useState<"PRIORITY" | "MEDIUM" | "NORMAL">("NORMAL");
  const [modalCategory, setModalCategory] = useState<string>("General");
  const [modalIsCompleted, setModalIsCompleted] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>("");
  const [taskSubmitting, setTaskSubmitting] = useState<boolean>(false);

  // Fetch employee list if Admin or Delegated Attendance Approver
  useEffect(() => {
    if (isAdmin) {
      api.get("/employees")
        .then((res) => {
          const list = res.data || [];
          setEmployees(list);
          if (list.length > 0 && !selectedEmpId) {
            const firstActive = list.find((e: any) => !e.isDeleted);
            const target = firstActive || list[0];
            setSelectedEmpId(target.id || target._id);
          }
        })
        .catch((err) => console.error("Failed to fetch employees for calendar", err));
    } else {
      // Check if designated attendance approver for any team members
      api.get("/authorizations/my-delegations")
        .then((res) => {
          const delegated = res.data?.canApproveAttendanceFor || [];
          if (delegated.length > 0) {
            const mapped = delegated.map((d: any) => ({
              id: d.id,
              _id: d.id,
              firstName: d.name ? d.name.split(" ")[0] : "Employee",
              lastName: d.name ? d.name.split(" ").slice(1).join(" ") : "",
              department: d.department || d.position || "Assigned Team",
              employeeCode: d.employeeCode
            }));
            setEmployees(mapped);
          } else {
            setEmployees([]);
          }
        })
        .catch((err) => console.error("Failed to check attendance delegations for calendar", err));
    }
  }, [isAdmin]);

  // Fetch monthly attendance data
  const fetchMonthlyData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        year: selectedYear,
        month: selectedMonth,
      };
      if (selectedEmpId) {
        params.employeeId = selectedEmpId;
      }
      const res = await api.get("/attendance/monthly", { params });
      setRecords(res.data?.data || []);
      setLeaves(res.data?.leaves || []);
      setCorrections(res.data?.corrections || []);
      if (isAdmin && res.data?.selectedEmployeeId && !selectedEmpId) {
        setSelectedEmpId(res.data.selectedEmployeeId);
      }
    } catch (err) {
      console.error("Error fetching monthly attendance", err);
      setRecords([]);
      setLeaves([]);
      setCorrections([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedEmpId, isAdmin]);

  // Fetch reminders / tasks for the selected month
  const fetchReminders = useCallback(async () => {
    try {
      const res = await api.get("/admin/reminders", {
        params: {
          year: selectedYear,
          month: selectedMonth,
        },
      });
      setReminders(res.data?.data || []);
    } catch (err) {
      console.error("Error fetching reminders in AttendanceCalendar:", err);
      setReminders([]);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchMonthlyData();
    fetchReminders();
  }, [fetchMonthlyData, fetchReminders]);

  // Listen to cross-component task creation/sync events
  useEffect(() => {
    const handleCreated = () => {
      fetchReminders();
    };
    window.addEventListener("ADMIN_REMINDER_CREATED", handleCreated);
    return () => window.removeEventListener("ADMIN_REMINDER_CREATED", handleCreated);
  }, [fetchReminders]);

  // Navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleToday = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth() + 1);
  };

  // Format helpers
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const formatTimeExact = (isoString?: string | null) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const formatHours = (hours?: number | null) => {
    if (hours === undefined || hours === null) return "-";
    if (hours > 24 || hours < 0) return "-";
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    if (hrs === 0 && mins === 0) return "0 hrs";
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const formatDurationMinutes = (totalMinutes: number | null | undefined): string => {
    if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes) || totalMinutes < 0) {
      return "—";
    }
    const hrs = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    if (hrs === 0 && mins === 0) return "0 mins";
    if (hrs === 0) return `${mins} mins`;
    if (mins === 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
    return `${hrs} hr${hrs > 1 ? "s" : ""} ${mins} min${mins > 1 ? "s" : ""}`;
  };

  // Helper: Get First In time of the day (earliest IN punch or checkIn)
  const getFirstInTime = (record?: AttendanceRecord | null): string | null => {
    if (!record) return null;
    if (record.punches && record.punches.length > 0) {
      const firstIn = record.punches.find((p) => p.type === "IN");
      if (firstIn?.time) return firstIn.time;
    }
    return record.checkIn || null;
  };

  // Helper: Get Last Out time of the day and determine if employee is currently punched in
  const getLastOutTime = (
    record?: AttendanceRecord | null,
    isPastDay?: boolean
  ): { time: string | null; isCurrentlyIn: boolean } => {
    if (!record) return { time: null, isCurrentlyIn: false };
    const isPast = isPastDay ?? (record.date ? (() => {
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const rStr = record.date.includes("T") ? record.date.split("T")[0] : record.date;
      return rStr < todayStr;
    })() : false);

    if (record.punches && record.punches.length > 0) {
      const lastPunch = record.punches[record.punches.length - 1];
      if (lastPunch.type === "IN") {
        return { time: null, isCurrentlyIn: !isPast };
      }
      for (let i = record.punches.length - 1; i >= 0; i--) {
        if (record.punches[i].type === "OUT") {
          return { time: record.punches[i].time, isCurrentlyIn: false };
        }
      }
    }
    if (record.checkOut) {
      return { time: record.checkOut, isCurrentlyIn: false };
    }
    if (record.checkIn && !record.checkOut) {
      return { time: null, isCurrentlyIn: !isPast };
    }
    return { time: null, isCurrentlyIn: false };
  };

  // Helper: Group punches into sequential (IN -> OUT) sessions with break gap calculations
  const extractPunchSessions = (record?: AttendanceRecord | null, isPastDay?: boolean): PunchSession[] => {
    if (!record) return [];
    const isPast = isPastDay ?? (record.date ? (() => {
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const rStr = record.date.includes("T") ? record.date.split("T")[0] : record.date;
      return rStr < todayStr;
    })() : false);

    const sessions: PunchSession[] = [];

    if (record.punches && record.punches.length > 0) {
      let currentInTime: string | null = null;
      let sessionNumber = 1;
      let prevOutTimestamp: number | null = null;
      let prevOutIso: string | null = null;

      for (let i = 0; i < record.punches.length; i++) {
        const punch = record.punches[i];

        if (punch.type === "IN") {
          currentInTime = punch.time;
          if (prevOutTimestamp !== null && sessions.length > 0) {
            const currentInTimestamp = new Date(punch.time).getTime();
            const breakMs = Math.max(0, currentInTimestamp - prevOutTimestamp);
            const breakMinutes = Math.round(breakMs / (1000 * 60));
            const lastSession = sessions[sessions.length - 1];
            lastSession.breakAfterMinutes = breakMinutes;
            lastSession.breakAfterFormatted = formatDurationMinutes(breakMinutes);
            lastSession.breakAfterStart = prevOutIso;
            lastSession.breakAfterEnd = punch.time;
            prevOutTimestamp = null;
            prevOutIso = null;
          }
        } else if (punch.type === "OUT" && currentInTime) {
          const inDate = new Date(currentInTime);
          const outDate = new Date(punch.time);
          const durationMs = Math.max(0, outDate.getTime() - inDate.getTime());
          const durationMinutes = Math.round(durationMs / (1000 * 60));

          sessions.push({
            sessionNumber: sessionNumber++,
            inTime: currentInTime,
            outTime: punch.time,
            isCurrentlyActive: false,
            durationMinutes,
            durationFormatted: formatDurationMinutes(durationMinutes),
          });

          prevOutTimestamp = outDate.getTime();
          prevOutIso = punch.time;
          currentInTime = null;
        }
      }

      // If an IN punch has no subsequent OUT punch
      if (currentInTime) {
        if (isPast) {
          sessions.push({
            sessionNumber: sessionNumber++,
            inTime: currentInTime,
            outTime: null,
            isCurrentlyActive: false,
            durationMinutes: null,
            durationFormatted: "Incomplete (Missing Out)",
          });
        } else {
          const inDate = new Date(currentInTime);
          const nowMs = Date.now();
          const durationMs = Math.max(0, nowMs - inDate.getTime());
          const durationMinutes = Math.round(durationMs / (1000 * 60));

          sessions.push({
            sessionNumber: sessionNumber++,
            inTime: currentInTime,
            outTime: null,
            isCurrentlyActive: true,
            durationMinutes,
            durationFormatted: `${formatDurationMinutes(durationMinutes)} (active)`,
          });
        }
      }
    }

    // Fallback for legacy records or corrections where punches[] is empty but checkIn / checkOut exist
    if (sessions.length === 0 && (record.checkIn || record.checkOut)) {
      const inTime = record.checkIn || null;
      const outTime = record.checkOut || null;
      let durationMinutes: number | null = null;

      if (inTime && outTime) {
        const diffMs = Math.max(0, new Date(outTime).getTime() - new Date(inTime).getTime());
        durationMinutes = Math.round(diffMs / (1000 * 60));
      } else if (typeof record.workingHours === "number" && record.workingHours > 0) {
        durationMinutes = Math.round(record.workingHours * 60);
      }

      if (inTime) {
        sessions.push({
          sessionNumber: 1,
          inTime,
          outTime,
          isCurrentlyActive: !outTime,
          durationMinutes,
          durationFormatted: durationMinutes !== null ? formatDurationMinutes(durationMinutes) : "In Progress",
        });
      }
    }

    return sessions;
  };

  // Maps of reminders by date string (YYYY-MM-DD)
  const allRemindersByDateMap = useMemo(() => {
    const map = new Map<string, AdminReminderItem[]>();
    reminders.forEach((r) => {
      const dStr = getReminderDateString(r.date);
      if (!dStr) return;
      const list = map.get(dStr) || [];
      list.push(r);
      map.set(dStr, list);
    });
    return map;
  }, [reminders]);

  const filteredRemindersByDateMap = useMemo(() => {
    const map = new Map<string, AdminReminderItem[]>();
    reminders.forEach((r) => {
      if (priorityFilter !== "ALL" && r.priority !== priorityFilter) return;
      const dStr = getReminderDateString(r.date);
      if (!dStr) return;
      const list = map.get(dStr) || [];
      list.push(r);
      map.set(dStr, list);
    });
    return map;
  }, [reminders, priorityFilter]);

  // Keep Day Detail Modal in sync when reminders update
  useEffect(() => {
    if (selectedDateDetail) {
      const updated = allRemindersByDateMap.get(selectedDateDetail.dateStr) || [];
      setSelectedDateDetail((prev) => (prev ? { ...prev, reminders: updated } : null));
    }
  }, [allRemindersByDateMap]);

  // Open Create Task Modal
  const handleOpenCreateTaskModal = (dateStr?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetDate =
      dateStr ||
      `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(
        Math.min(today.getDate(), 28)
      ).padStart(2, "0")}`;

    setEditingTask(null);
    setModalDate(targetDate);
    setModalDateDisplay(toDMY(targetDate));
    setModalTitle("");
    setModalDescription("");
    setModalStartTime("10:00");
    setModalEndTime("11:00");
    setModalIsAllDay(false);
    setModalPriority("NORMAL");
    setModalCategory("General");
    setModalIsCompleted(false);
    setModalError("");
    setIsTaskModalOpen(true);
  };

  // Open Edit Task Modal
  const handleOpenEditTaskModal = (task: AdminReminderItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Mark as read immediately when opened
    if (!task.isRead) {
      api.patch(`/admin/reminders/${task._id}/read`).catch(() => {});
      setReminders((prev) =>
        prev.map((item) =>
          item._id === task._id
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item
        )
      );
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CLOSE_NOTIFICATION",
          tag: `task-${task._id}`,
        });
      }
    }

    const dStr = getReminderDateString(task.date);

    setEditingTask({
      ...task,
      isRead: true,
      readAt: task.readAt || new Date().toISOString(),
    });
    setModalDate(dStr);
    setModalDateDisplay(toDMY(dStr));
    setModalTitle(task.title);
    setModalDescription(task.description || "");
    setModalStartTime(task.startTime || "10:00");
    setModalEndTime(task.endTime || "11:00");
    setModalIsAllDay(Boolean(task.isAllDay));
    setModalPriority(task.priority || "NORMAL");
    setModalCategory(task.category || "General");
    setModalIsCompleted(Boolean(task.isCompleted));
    setModalError("");
    setIsTaskModalOpen(true);
  };

  // Toggle Completion Quick Action
  const handleToggleTaskComplete = async (task: AdminReminderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.put(`/admin/reminders/${task._id}`, {
        isCompleted: !task.isCompleted,
      });
      fetchReminders();
    } catch (err) {
      console.error("Failed to toggle reminder status", err);
    }
  };

  // Delete Task Action
  const handleDeleteTask = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this task/reminder?")) return;

    try {
      await api.delete(`/admin/reminders/${id}`);
      setIsTaskModalOpen(false);
      toast.success("Task deleted");
      await fetchReminders();
    } catch (err) {
      console.error("Failed to delete task:", err);
      toast.error("Failed to delete task. Please try again.");
    }
  };

  // Submit Task Modal (Save / Update)
  const handleSubmitTaskModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      setModalError("Please provide a title for the task/reminder.");
      return;
    }
    const finalDate = modalDate || fromDMY(modalDateDisplay);
    if (!finalDate) {
      setModalError("Please select or enter a valid date in DD/MM/YYYY format.");
      return;
    }

    setTaskSubmitting(true);
    setModalError("");

    try {
      const payload = {
        title: modalTitle.trim(),
        description: modalDescription.trim(),
        date: finalDate,
        startTime: modalIsAllDay ? null : modalStartTime,
        endTime: modalIsAllDay ? null : modalEndTime,
        isAllDay: modalIsAllDay,
        priority: modalPriority,
        category: modalCategory,
        isCompleted: modalIsCompleted,
      };

      let savedTask: AdminReminderItem | null = null;
      if (editingTask) {
        const res = await api.put(`/admin/reminders/${editingTask._id}`, payload);
        savedTask = res.data?.data;
        toast.success("Task updated successfully");
      } else {
        const res = await api.post("/admin/reminders", payload);
        savedTask = res.data?.data;
        toast.success("Task created and scheduled!");
      }

      // If scheduled on/before start day, trigger forced instant notification in PWA & native tray
      if (
        savedTask &&
        isReminderStarted(savedTask) &&
        !savedTask.isCompleted &&
        !savedTask.isRead
      ) {
        dispatchInstantReminderNotification(savedTask);
        window.dispatchEvent(
          new CustomEvent("ADMIN_REMINDER_CREATED", { detail: savedTask })
        );
      }

      setIsTaskModalOpen(false);
      await fetchReminders();
    } catch (err: any) {
      console.error("Failed to save task:", err);
      setModalError(err.response?.data?.error || "Failed to save task. Please try again.");
    } finally {
      setTaskSubmitting(false);
    }
  };

  // Calendar logic calculation
  const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ...
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  // Generate grid items
  const gridCells = [];

  // Previous month padding cells
  for (let i = 0; i < startingDayOfWeek; i++) {
    gridCells.push({ isPadding: true, key: `pad-prev-${i}` });
  }

  // Map of date string -> record (YYYY-MM-DD)
  const recordsByDateMap = new Map<string, AttendanceRecord>();
  records.forEach((rec) => {
    const d = new Date(rec.date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    recordsByDateMap.set(dateStr, rec);
  });

  // Map of date string -> leave application
  const leavesByDateMap = new Map<string, LeaveItem>();
  leaves.forEach((l) => {
    const s = new Date(l.startDate);
    const e = new Date(l.endDate);
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);
    for (let c = new Date(s); c <= e; c.setDate(c.getDate() + 1)) {
      const dStr = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-${String(c.getDate()).padStart(2, "0")}`;
      leavesByDateMap.set(dStr, l);
    }
  });

  // Map of date string -> correction
  const correctionsByDateMap = new Map<string, CorrectionItem>();
  corrections.forEach((c) => {
    const cd = new Date(c.date);
    const dStr = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, "0")}-${String(cd.getDate()).padStart(2, "0")}`;
    correctionsByDateMap.set(dStr, c);
  });

  // Current month day cells
  let monthHolidaysCount = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDateObj = new Date(selectedYear, selectedMonth - 1, day);
    const dayOfWeek = currentDateObj.getDay();
    const isWeekend = dayOfWeek === 0; // Sunday only
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const record = recordsByDateMap.get(dateStr) || null;
    const leave = leavesByDateMap.get(dateStr) || null;
    const correction = correctionsByDateMap.get(dateStr) || null;
    const holiday = getHoliday(dateStr);
    const isHoliday = !!holiday;

    if (isHoliday) {
      monthHolidaysCount++;
    }

    const isToday =
      day === today.getDate() &&
      selectedMonth === today.getMonth() + 1 &&
      selectedYear === today.getFullYear();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isPastDay = currentDateObj < todayMidnight;

    const isCurrentTimeAfterShift = today.getHours() >= 18;
    const isDayAndPunchCompleted = isPastDay || (isToday && isCurrentTimeAfterShift);
    const hasPunches = !!(record && (record.checkIn || (record.punches && record.punches.length > 0)));

    const selectedEmp = employees.find((e) => (e.id || e._id) === selectedEmpId);
    const isDeactivatedEmployee = Boolean(selectedEmp?.isDeleted || selectedEmp?.employmentStatus === "INACTIVE");
    let isInactiveDay = false;
    if (isDeactivatedEmployee) {
      const deactDateVal = selectedEmp?.deactivationDate || selectedEmp?.updatedAt;
      if (deactDateVal) {
        const d = new Date(deactDateVal);
        const deactDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (dateStr >= deactDateStr) {
          isInactiveDay = true;
        }
      }
    }

    // Absent conditions:
    // 1. Unpunched day: workday must be completed (past day or today after 18:00), no punches, no leave, no correction, and not inactive
    const isUnexcusedAbsent = !isInactiveDay && !isWeekend && !isHoliday && isDayAndPunchCompleted && !hasPunches && !leave && !correction;
    // 2. Punched late cutoff (Tier 3): employee punched in after 10:30 AM cutoff and was marked absent
    const isAbsentWithPunches = hasPunches && record?.status === "ABSENT";
    const isAbsent = isUnexcusedAbsent || isAbsentWithPunches;
    const isInactive = isInactiveDay && !hasPunches && !leave && !correction;

    gridCells.push({
      isPadding: false,
      day,
      dateObj: currentDateObj,
      dateStr,
      isWeekend,
      holiday,
      isHoliday,
      record,
      leave,
      correction,
      isToday,
      isPastDay,
      isDayAndPunchCompleted,
      isAbsent,
      isInactive,
      dayName: currentDateObj.toLocaleDateString("en-US", { weekday: "short" }),
      key: `day-${day}`,
    });
  }

  // Next month padding cells
  const remainingSlots = (7 - (gridCells.length % 7)) % 7;
  for (let i = 0; i < remainingSlots; i++) {
    gridCells.push({ isPadding: true, key: `pad-next-${i}` });
  }

  const yearOptions = [];
  const currentYr = today.getFullYear();
  for (let y = currentYr - 2; y <= currentYr + 2; y++) {
    yearOptions.push(y);
  }

  // Reminder stats for current month
  const totalRemindersCount = reminders.length;
  const priorityTasksCount = reminders.filter((r) => r.priority === "PRIORITY").length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden mt-8">
      {/* Calendar Header & Filters Bar */}
      <div className="p-5 bg-slate-50/60 border-b border-slate-200/80 flex flex-col gap-4">
        {/* Title & Action Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">Attendance & Task Calendar</h2>
                {monthHolidaysCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    {monthHolidaysCount} Market Holiday{monthHolidaysCount > 1 ? "s" : ""}
                  </span>
                )}
                {totalRemindersCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                    <Tag className="w-3 h-3 text-indigo-600" />
                    {totalRemindersCount} Task{totalRemindersCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Overview of daily punches, working hours, scheduled tasks & market holidays
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleOpenCreateTaskModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task / Reminder</span>
            </button>
            <button
              type="button"
              onClick={() => setIsHolidayScheduleOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100/80 text-purple-700 border border-purple-200 transition-all shadow-2xs cursor-pointer"
            >
              <CalendarDays className="w-3.5 h-3.5 text-purple-600" />
              <span>Market Holidays List</span>
            </button>
          </div>
        </div>

        {/* Filters & Navigation Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/60">
          {/* Left: Task Priority Filter & Attendance Legend */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Priority Filter */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs">
              <span className="text-[11px] font-semibold text-slate-400 pl-1.5 pr-0.5 flex items-center gap-1">
                <ListTodo className="w-3.5 h-3.5 text-indigo-600" /> Filter:
              </span>
              <button
                type="button"
                onClick={() => setPriorityFilter("ALL")}
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  priorityFilter === "ALL"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setPriorityFilter("PRIORITY")}
                className={`whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  priorityFilter === "PRIORITY"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "text-rose-700 hover:bg-rose-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Priority {priorityTasksCount > 0 && `(${priorityTasksCount})`}
              </button>
              <button
                type="button"
                onClick={() => setPriorityFilter("MEDIUM")}
                className={`whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  priorityFilter === "MEDIUM"
                    ? "bg-amber-500 text-white shadow-2xs"
                    : "text-amber-800 hover:bg-amber-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Medium
              </button>
              <button
                type="button"
                onClick={() => setPriorityFilter("NORMAL")}
                className={`whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  priorityFilter === "NORMAL"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-indigo-700 hover:bg-indigo-50"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                Normal
              </button>
            </div>

            {/* Attendance Legend Guide */}
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Late
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Absent
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-500" /> Leave
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-600" /> Holiday
              </span>
            </div>
          </div>

          {/* Right Controls: Month/Year selector */}
          <div className="flex flex-wrap items-center gap-2">
            {employees.length > 0 && (() => {
              const activeEmps = employees.filter((e) => !e.isDeleted);
              const deactivatedEmps = employees.filter((e) => e.isDeleted);

              return (
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs shrink-0">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="!w-auto !py-1 bg-transparent border-none focus:outline-none font-medium text-slate-800 cursor-pointer pr-1"
                  >
                    {!isAdmin && <option value="">My Attendance</option>}
                    {activeEmps.length > 0 && (
                      <optgroup label="Active Employees">
                        {activeEmps.map((emp) => (
                          <option key={emp.id || emp._id} value={emp.id || emp._id}>
                            {emp.firstName} {emp.lastName} {emp.employeeCode ? `(#${emp.employeeCode})` : ""} - {emp.department || "Employee"}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {deactivatedEmps.length > 0 && (
                      <optgroup label="Deactivated Staff">
                        {deactivatedEmps.map((emp) => (
                          <option key={emp.id || emp._id} value={emp.id || emp._id}>
                            {emp.firstName} {emp.lastName} [Deactivated] {emp.employeeCode ? `(#${emp.employeeCode})` : ""} - {emp.department || "Ex-Staff"}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              );
            })()}

            {/* Month Dropdown */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="!w-auto bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs shrink-0"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>

            {/* Year Dropdown */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="!w-auto bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer shadow-2xs shrink-0"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            {/* Today Button */}
            <button
              onClick={handleToday}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-2xs cursor-pointer shrink-0"
            >
              Today
            </button>

            {/* Prev/Next Month Arrow Buttons */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs shrink-0">
              <button
                onClick={handlePrevMonth}
                title="Previous Month"
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                title="Next Month"
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="p-4 sm:p-6 overflow-x-auto">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium text-slate-500 mt-2">Loading calendar records & tasks...</p>
          </div>
        ) : (
          <div className="min-w-[750px]">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                <div
                  key={day}
                  className={`py-2 text-center text-xs font-bold uppercase tracking-wider ${
                    idx === 0 ? "text-rose-500/80" : "text-slate-500"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days Cells */}
            <div className="grid grid-cols-7 gap-2">
              {gridCells.map((cell) => {
                if (cell.isPadding) {
                  return (
                    <div
                      key={cell.key}
                      className="min-h-[125px] bg-slate-50/40 rounded-xl border border-slate-100/60 p-2 opacity-30"
                    />
                  );
                }

                const rec = cell.record;
                const cellTasks = filteredRemindersByDateMap.get(cell.dateStr!) || [];
                const allCellTasks = allRemindersByDateMap.get(cell.dateStr!) || [];

                // Detect missing punch on past days (employee clocked in on past day but forgot to clock out)
                const hasValidOut = Boolean(
                  rec && (
                    (rec.checkOut && rec.currentStatus !== "IN" && (!rec.punches?.length || rec.punches[rec.punches.length - 1]?.type !== "IN")) ||
                    (rec.punches && rec.punches.length > 0 && rec.punches[rec.punches.length - 1].type === "OUT") ||
                    (rec.status === "PRESENT" && typeof rec.workingHours === "number" && rec.workingHours > 0)
                  )
                );
                const isMissingPunch = Boolean(
                  cell.isPastDay &&
                  rec &&
                  (rec.checkIn || (rec.punches && rec.punches.length > 0)) &&
                  !hasValidOut
                );

                let statusBadge = null;

                if (isMissingPunch) {
                  statusBadge = (
                    <span
                      title="Missing Punch (Shift locked at 00:00 hrs)"
                      className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-400 shadow-2xs max-w-full min-w-0 animate-pulse"
                    >
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                      <span className="truncate">Missing Punch</span>
                    </span>
                  );
                } else if (cell.isHoliday && rec && (rec.checkIn || (rec.punches && rec.punches.length > 0))) {
                  statusBadge = (
                    <span
                      title="Punched (Holiday)"
                      className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs max-w-full min-w-0"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                      <span className="truncate">Punched (Holiday)</span>
                    </span>
                  );
                } else if (cell.isHoliday) {
                  statusBadge = (
                    <span
                      title={cell.holiday?.name || "Holiday"}
                      className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs max-w-full min-w-0"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                      <span className="truncate">Holiday</span>
                    </span>
                  );
                } else if (cell.isWeekend) {
                  statusBadge = (
                    <span
                      title="Sunday Off"
                      className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200/60 max-w-full min-w-0"
                    >
                      <Coffee className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                      <span className="truncate">Sunday Off</span>
                    </span>
                  );
                } else if (rec && (rec.checkIn || (rec.punches && rec.punches.length > 0))) {
                  const isLateArrival = isLateArrivalRecord(rec);
                  if (rec.status === "PRESENT") {
                    if (isLateArrival) {
                      statusBadge = (
                        <span
                          title="Late Arrival (Present)"
                          className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs max-w-full min-w-0"
                        >
                          <Clock className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                          <span className="truncate">Late (Present)</span>
                        </span>
                      );
                    } else if (cell.correction && cell.correction.status === "APPROVED") {
                      statusBadge = (
                        <span
                          title="Regularized"
                          className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold shadow-2xs border bg-emerald-50 text-emerald-700 border-emerald-200 max-w-full min-w-0"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          <span className="truncate">Regularized</span>
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span
                          title="Present"
                          className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 max-w-full min-w-0"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          <span className="truncate">Present</span>
                        </span>
                      );
                    }
                  } else if (rec.status === "LATE") {
                    statusBadge = (
                      <span
                        title="Late"
                        className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs max-w-full min-w-0"
                      >
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                        <span className="truncate">Late</span>
                      </span>
                    );
                  } else if (rec.status === "ABSENT") {
                    statusBadge = (
                      <span
                        title="Absent"
                        className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs max-w-full min-w-0"
                      >
                        <XCircle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                        <span className="truncate">Absent</span>
                      </span>
                    );
                  }
                } else if (cell.leave) {
                  statusBadge = (
                    <span
                      title={cell.leave.type}
                      className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs max-w-full min-w-0"
                    >
                      <FileText className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                      <span className="truncate">{cell.leave.type}</span>
                    </span>
                  );
                } else if (cell.correction) {
                  const isApproved = cell.correction.status === "APPROVED";
                  statusBadge = (
                    <span
                      title={isApproved ? "Regularized" : "Pending"}
                      className={`inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold shadow-2xs border max-w-full min-w-0 ${
                        isApproved
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      <CheckCircle2 className={`w-2.5 h-2.5 shrink-0 ${isApproved ? "text-emerald-600" : "text-amber-600"}`} />
                      <span className="truncate">{isApproved ? "Regularized" : "Pending"}</span>
                    </span>
                  );
                } else if (cell.isInactive) {
                  statusBadge = (
                    <span
                      title="Deactivated / Inactive"
                      className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 shadow-2xs max-w-full min-w-0"
                    >
                      <span className="truncate">Inactive</span>
                    </span>
                  );
                } else if (cell.isAbsent) {
                  statusBadge = (
                    <span
                      title="Absent"
                      className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs max-w-full min-w-0"
                    >
                      <XCircle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                      <span className="truncate">Absent</span>
                    </span>
                  );
                } else if (cell.isToday && !cell.isDayAndPunchCompleted) {
                  statusBadge = (
                    <span
                      title="No records found"
                      className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200/60 max-w-full min-w-0"
                    >
                      <span className="truncate">No records found</span>
                    </span>
                  );
                } else if (cell.isPastDay) {
                  statusBadge = (
                    <span
                      title="No Log"
                      className="inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-medium bg-slate-100 text-slate-400 border border-slate-200/50 max-w-full min-w-0"
                    >
                      <span className="truncate">No Log</span>
                    </span>
                  );
                }

                return (
                  <div
                    key={cell.key}
                    onClick={() => {
                      const isPunched = !!(cell.record && (cell.record.checkIn || (cell.record.punches && cell.record.punches.length > 0)));
                      const shouldShowRecord = isPunched || (!cell.isInactive && cell.isAbsent);
                      setSelectedDateDetail({
                        dateStr: cell.dateStr!,
                        dayName: cell.dayName!,
                        isWeekend: cell.isWeekend ?? false,
                        holiday: cell.holiday || null,
                        record: shouldShowRecord ? (cell.record || {
                          _id: `absent-${cell.dateStr}`,
                          employeeId: selectedEmpId,
                          date: cell.dateStr!,
                          checkIn: null,
                          checkOut: null,
                          status: "ABSENT",
                          workingHours: 0,
                          dayType: "Absent",
                          verdict: "Marked Absent: Shift and punch window completed with no check-in, leave application, or attendance correction.",
                          requiresCorrection: true,
                        }) : null,
                        reminders: allCellTasks,
                        isInactive: cell.isInactive ?? false,
                      });
                    }}
                    className={`min-h-[125px] p-1.5 sm:p-2 rounded-xl border transition-all duration-200 flex flex-col justify-between cursor-pointer group hover:shadow-md relative overflow-hidden max-w-full ${
                      isMissingPunch
                        ? "bg-gradient-to-br from-amber-50/95 via-rose-50/60 to-amber-50/40 border-amber-400 shadow-md ring-2 ring-amber-400/50 hover:border-amber-500 hover:shadow-lg"
                        : cell.isToday
                        ? (cell.isAbsent
                            ? "bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20"
                            : isLateArrivalRecord(rec)
                            ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/30"
                            : "bg-indigo-50/40 border-indigo-300 ring-2 ring-indigo-500/20")
                        : cell.isHoliday
                        ? "bg-gradient-to-br from-purple-50/90 via-indigo-50/40 to-purple-50/30 border-purple-300/80 hover:border-purple-400 shadow-2xs ring-1 ring-purple-500/10"
                        : cell.isWeekend
                        ? "bg-slate-50/70 border-slate-200/70"
                        : cell.isInactive
                        ? "bg-slate-50/80 border-slate-200/80 hover:border-slate-300"
                        : cell.isAbsent
                        ? "bg-rose-50/70 border-rose-300/80 hover:border-rose-400 hover:bg-rose-100/50 shadow-2xs ring-1 ring-rose-500/15"
                        : isLateArrivalRecord(rec)
                        ? "bg-amber-50/80 border-amber-300/90 hover:border-amber-400 shadow-2xs ring-1 ring-amber-500/25"
                        : rec?.status === "PRESENT"
                        ? "bg-white border-slate-200 hover:border-indigo-200"
                        : cell.leave
                        ? "bg-sky-50/60 border-sky-200/80 hover:border-sky-300"
                        : cell.correction && cell.correction.status === "PENDING"
                        ? "bg-amber-50/50 border-amber-200/80 hover:border-amber-300"
                        : rec
                        ? "bg-white border-slate-200 hover:border-indigo-200"
                        : "bg-white border-slate-100 hover:border-slate-300"
                    }`}
                  >
                    {/* Top Section: Date Number, Quick Add Action, & Attendance Status */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-1 min-w-0 w-full">
                      <div className="flex items-center justify-between lg:justify-start gap-1 shrink-0">
                        <span
                          className={`text-xs font-bold flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg shrink-0 ${
                            isMissingPunch
                              ? "bg-amber-500 text-white font-black shadow-xs ring-1 ring-amber-600/30"
                              : cell.isToday
                              ? (cell.isAbsent ? "bg-rose-600 text-white shadow-xs" : isLateArrivalRecord(rec) ? "bg-amber-500 text-white shadow-xs font-black ring-1 ring-amber-600/30" : "bg-indigo-600 text-white shadow-xs")
                              : cell.isHoliday
                              ? "bg-purple-600 text-white shadow-2xs font-extrabold"
                              : cell.isWeekend
                              ? "text-slate-400"
                              : cell.isInactive
                              ? "bg-slate-100 text-slate-500 font-bold border border-slate-200"
                              : cell.isAbsent
                              ? "bg-rose-100 text-rose-700 font-extrabold border border-rose-300"
                              : isLateArrivalRecord(rec)
                              ? "bg-amber-100 text-amber-900 font-black border border-amber-300"
                              : "text-slate-800 group-hover:text-indigo-600"
                          }`}
                        >
                          {cell.day}
                        </span>

                        {/* Quick Add Task Button on Hover */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenCreateTaskModal(cell.dateStr, e)}
                          title="Schedule task on this date"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-md hover:bg-indigo-100 text-indigo-600 cursor-pointer hidden sm:block"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {statusBadge && (
                        <div className="min-w-0 max-w-full flex justify-start lg:justify-end">
                          {statusBadge}
                        </div>
                      )}
                    </div>

                    {/* Middle Row: Attendance Log Info */}
                    {rec && (rec.checkIn || rec.checkOut || (rec.punches && rec.punches.length > 0)) ? (() => {
                      const firstIn = getFirstInTime(rec);
                      const lastOutInfo = getLastOutTime(rec, cell.isPastDay);
                      const sessions = extractPunchSessions(rec, cell.isPastDay);
                      const hasMultiPunches = sessions.length > 1 || (rec.punches && rec.punches.length > 2);

                      return (
                        <div className="mt-1 space-y-0.5 text-[9px] sm:text-[10px] min-w-0 overflow-hidden">
                          <div className="flex items-center justify-between text-slate-600 gap-1">
                            <span className="font-medium text-slate-400 shrink-0">In:</span>
                            <span className="font-semibold text-slate-700 truncate" title={`First In: ${formatTime(firstIn)}`}>
                              {formatTime(firstIn)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 gap-1">
                            <span className="font-medium text-slate-400 shrink-0">Out:</span>
                            {isMissingPunch ? (
                              <span className="font-bold text-amber-800 inline-flex items-center gap-1 shrink-0" title="Shift locked at 00:00. Clock-out missing.">
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                Missing (Locked)
                              </span>
                            ) : lastOutInfo.isCurrentlyIn ? (
                              <span className="font-bold text-emerald-600 inline-flex items-center gap-1 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Active
                              </span>
                            ) : (
                              <span className="font-semibold text-slate-700 truncate" title={`Last Out: ${formatTime(lastOutInfo.time)}`}>
                                {formatTime(lastOutInfo.time)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-slate-600 gap-1">
                            <span className="font-medium text-slate-400 shrink-0">Hours:</span>
                            {isMissingPunch ? (
                              <span className="font-bold text-amber-800 truncate" title="Shift locked with missing clock-out">
                                {rec.workingHours ? formatHours(rec.workingHours) : "Incomplete"}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1 overflow-hidden">
                                <span className="font-bold text-indigo-600 truncate">{formatHours(rec.workingHours)}</span>
                                {hasMultiPunches && (
                                  <span
                                    className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0"
                                    title={`${sessions.length} Punch Sessions`}
                                  >
                                    {sessions.length}s
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })() : cell.isHoliday ? (
                      <div className="mt-1 min-w-0 overflow-hidden">
                        <p className="text-[9px] sm:text-[10px] font-bold text-purple-900 truncate" title={cell.holiday?.name}>
                          {cell.holiday?.name}
                        </p>
                      </div>
                    ) : cell.isInactive ? (
                      <div className="mt-1 min-w-0 overflow-hidden">
                        <p className="text-[9px] font-semibold text-slate-500 truncate">
                          Account Inactive
                        </p>
                      </div>
                    ) : cell.isAbsent ? (
                      <div className="mt-1 min-w-0 overflow-hidden">
                        <p className="text-[9px] font-semibold text-rose-700 truncate">
                          No punches recorded
                        </p>
                      </div>
                    ) : null}

                    {/* Bottom Row: Reminders & Tasks Pill List */}
                    {cellTasks.length > 0 && (
                      <div className="mt-1.5 pt-1 border-t border-slate-200/60 space-y-1 min-w-0 overflow-hidden">
                        {cellTasks.slice(0, 2).map((task) => (
                          <div
                            key={task._id}
                            onClick={(e) => handleOpenEditTaskModal(task, e)}
                            className={`group/task flex items-center justify-between gap-1 px-1 sm:px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-medium border transition-all hover:scale-[1.01] min-w-0 overflow-hidden max-w-full ${
                              task.isCompleted
                                ? "bg-slate-50 border-slate-200 text-slate-400 line-through"
                                : task.priority === "PRIORITY"
                                ? "bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100 shadow-2xs font-semibold"
                                : task.priority === "MEDIUM"
                                ? "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100 shadow-2xs"
                                : "bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100 shadow-2xs"
                            }`}
                            title={`${task.title}${task.description ? `\n${task.description}` : ""}`}
                          >
                            <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                              <button
                                type="button"
                                onClick={(e) => handleToggleTaskComplete(task, e)}
                                className={`w-3 h-3 rounded flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                  task.isCompleted
                                    ? "bg-emerald-600 text-white"
                                    : "border border-slate-300 hover:border-indigo-600 bg-white"
                                }`}
                                title={task.isCompleted ? "Mark incomplete" : "Mark completed"}
                              >
                                {task.isCompleted && <Check className="w-2 h-2 stroke-[3]" />}
                              </button>
                              <span className="truncate min-w-0 flex-1">{task.title}</span>
                            </div>
                            {task.isAllDay ? (
                              <span className="text-[8px] font-semibold text-slate-400 shrink-0">All Day</span>
                            ) : task.startTime ? (
                              <span className="text-[8px] font-semibold text-slate-500 shrink-0">
                                {task.startTime}
                              </span>
                            ) : null}
                          </div>
                        ))}

                        {cellTasks.length > 2 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDateDetail({
                                dateStr: cell.dateStr!,
                                dayName: cell.dayName!,
                                isWeekend: cell.isWeekend ?? false,
                                holiday: cell.holiday || null,
                                record: cell.record || null,
                                reminders: allCellTasks,
                                isInactive: cell.isInactive ?? false,
                              });
                            }}
                            className="w-full text-left px-1 py-0.5 text-[8px] sm:text-[9px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors truncate"
                          >
                            +{cellTasks.length - 2} more tasks
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Day Schedule & Attendance Inspection Modal */}
      {selectedDateDetail && (() => {
        const modalRec = selectedDateDetail.record;
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const isModalPastDay = selectedDateDetail.dateStr < todayStr;
        const hasModalValidOut = Boolean(
          modalRec && (
            (modalRec.checkOut && modalRec.currentStatus !== "IN" && (!modalRec.punches?.length || modalRec.punches[modalRec.punches.length - 1]?.type !== "IN")) ||
            (modalRec.punches && modalRec.punches.length > 0 && modalRec.punches[modalRec.punches.length - 1].type === "OUT") ||
            (modalRec.status === "PRESENT" && typeof modalRec.workingHours === "number" && modalRec.workingHours > 0)
          )
        );
        const isModalMissingPunch = Boolean(
          isModalPastDay &&
          modalRec &&
          (modalRec.checkIn || (modalRec.punches && modalRec.punches.length > 0)) &&
          !hasModalValidOut
        );

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
            onClick={() => setSelectedDateDetail(null)}
          >
            <div
              className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      selectedDateDetail.holiday
                        ? "bg-purple-100 text-purple-700"
                        : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    {selectedDateDetail.holiday ? <Sparkles className="w-4 h-4" /> : <CalendarIcon className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {new Date(selectedDateDetail.dateStr).toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedDateDetail.holiday ? "Official Market Holiday & Tasks" : "Attendance & Scheduled Tasks"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDateDetail(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
                {/* Holiday Information Banner if Applicable */}
                {selectedDateDetail.holiday && (
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-1.5 text-purple-700 font-extrabold text-xs uppercase tracking-wide">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      Market Holiday (NSE / BSE)
                    </div>
                    <p className="text-sm font-bold text-purple-950 mt-1">
                      {selectedDateDetail.holiday.name}
                    </p>
                    <p className="text-xs text-purple-700 mt-0.5">
                      Official trading holiday for D&S Investment.
                    </p>
                  </div>
                )}

                {/* Attendance Log Section */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Attendance Log
                    </span>
                    {isModalMissingPunch ? (
                      <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-700" />
                        MISSING PUNCH (LOCKED)
                      </span>
                    ) : selectedDateDetail.record && isLateArrivalRecord(selectedDateDetail.record) ? (
                      <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-700" />
                        {selectedDateDetail.record.status === "PRESENT" ? "PRESENT (LATE ARRIVAL)" : "LATE ARRIVAL"}
                      </span>
                    ) : (
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-white border border-slate-200 shadow-2xs">
                        {selectedDateDetail.record?.status || (
                          selectedDateDetail.isWeekend
                            ? "SUNDAY OFF"
                            : (selectedDateDetail.dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}` && today.getHours() < 18 && !selectedDateDetail.record?.checkIn)
                            ? "NO RECORDS FOUND"
                            : "NO LOG"
                        )}
                      </span>
                    )}
                  </div>

                  {/* Shift Locked Missing Punch Alert Callout Banner */}
                  {isModalMissingPunch && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border border-amber-300 shadow-xs flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-black text-amber-900 uppercase tracking-wide">
                          Shift Locked at 00:00 hrs (Clock-Out Missing)
                        </h4>
                        <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed font-medium">
                          Clock-out was not recorded on this day before midnight. This shift has been locked to prevent timing overflow. Please request an attendance correction to regularize your hours.
                        </p>
                      </div>
                    </div>
                  )}

                {(() => {
                  const rec = selectedDateDetail.record;
                  const hasAttendance = !!(rec && (rec.checkIn || rec.checkOut || (rec.punches && rec.punches.length > 0)));

                  if (!hasAttendance) {
                    return (
                      <p className="text-xs text-slate-500">
                        {selectedDateDetail.isInactive
                          ? "Employee account inactive on and after this date."
                          : selectedDateDetail.holiday
                          ? "Off day on account of official market holiday."
                          : selectedDateDetail.isWeekend
                          ? "Sunday / Weekly off-day."
                          : (selectedDateDetail.dateStr === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}` && today.getHours() < 18 && !selectedDateDetail.record?.checkIn)
                          ? "Office hours in progress. No check-in recorded yet."
                          : "No punches recorded for this date."}
                      </p>
                    );
                  }

                  const firstIn = getFirstInTime(rec);
                  const lastOutInfo = getLastOutTime(rec, isModalPastDay);
                  const sessions = extractPunchSessions(rec, isModalPastDay);
                  const rawPunches = rec?.punches || [];
                  const totalPunchesCount = rawPunches.length > 0
                    ? rawPunches.length
                    : rec?.checkOut ? 2 : rec?.checkIn ? 1 : 0;
                  const totalBreakMinutes = sessions.reduce((acc, s) => acc + (s.breakAfterMinutes || 0), 0);

                  return (
                    <div className="space-y-3.5">
                      {/* Top Metrics Row: First In, Last Out, Net Hours, Total Sessions */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-bold uppercase tracking-wider">First In (Start)</span>
                            <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <span className="text-xs sm:text-sm font-black text-slate-800 mt-1 truncate">
                            {formatTime(firstIn)}
                          </span>
                        </div>

                        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Last Out (Final)</span>
                            <LogOut className="w-3.5 h-3.5 text-rose-600" />
                          </div>
                          <span className="text-xs sm:text-sm font-black mt-1 truncate">
                            {isModalMissingPunch ? (
                              <span className="text-amber-700 font-bold inline-flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Missing Out
                              </span>
                            ) : lastOutInfo.isCurrentlyIn ? (
                              <span className="text-emerald-600 inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Active
                              </span>
                            ) : (
                              <span className="text-slate-800">{formatTime(lastOutInfo.time)}</span>
                            )}
                          </span>
                        </div>

                        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Net Work Duration</span>
                            <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          <span className="text-xs sm:text-sm font-black text-indigo-600 mt-1 truncate">
                            {isModalMissingPunch && !rec?.workingHours ? "Incomplete" : formatHours(rec?.workingHours)}
                          </span>
                        </div>

                        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Punch Sessions</span>
                            <Timer className="w-3.5 h-3.5 text-purple-600" />
                          </div>
                          <span className="text-xs sm:text-sm font-black text-slate-800 mt-1 truncate">
                            {sessions.length} {sessions.length === 1 ? "Session" : "Sessions"}
                            <span className="text-[10px] font-semibold text-slate-400 ml-1">
                              ({totalPunchesCount}p)
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Sessions Breakdown Card */}
                      <div className="bg-white rounded-xl border border-slate-200/80 p-3 space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <History className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Punch Transactions & Sessions Breakdown</span>
                          </div>
                          {totalBreakMinutes > 0 && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              Total Break: {formatDurationMinutes(totalBreakMinutes)}
                            </span>
                          )}
                        </div>

                        {/* Sequential Session Cards & Intermission Breaks */}
                        <div className="space-y-2">
                          {sessions.map((session) => (
                            <div key={`session-${session.sessionNumber}`} className="space-y-2">
                              {/* Session Box */}
                              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 shrink-0">
                                    Session {session.sessionNumber}
                                  </span>
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                                      <LogIn className="w-3 h-3 text-emerald-600" />
                                      {formatTime(session.inTime)}
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    {session.isCurrentlyActive ? (
                                      <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-300 font-bold">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        In Progress
                                      </span>
                                    ) : !session.outTime ? (
                                      <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300 font-bold">
                                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                                        Missing Out Punch
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/80">
                                        <LogOut className="w-3 h-3 text-rose-600" />
                                        {formatTime(session.outTime)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                  <span className="text-[11px] font-bold text-slate-500">
                                    Duration:
                                  </span>
                                  <span className="text-xs font-black text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-200/60">
                                    {session.durationFormatted}
                                  </span>
                                </div>
                              </div>

                              {/* Intermission Break Between Sessions */}
                              {session.breakAfterMinutes !== undefined && session.breakAfterMinutes !== null && session.breakAfterMinutes > 0 && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50/80 border border-dashed border-amber-200 text-amber-900 text-xs">
                                  <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                    <Coffee className="w-3 h-3" />
                                  </div>
                                  <div className="flex items-center justify-between gap-2 flex-wrap flex-1 text-[11px]">
                                    <span className="font-semibold text-amber-800">
                                      Break / Away: <strong>{session.breakAfterFormatted}</strong>
                                    </span>
                                    {session.breakAfterStart && session.breakAfterEnd && (
                                      <span className="text-amber-700 font-mono text-[10px]">
                                        ({formatTime(session.breakAfterStart)} – {formatTime(session.breakAfterEnd)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Individual Raw Punch Logs (Audit Trail) */}
                        {rawPunches.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                              Chronological Punch Audit Trail ({rawPunches.length} records)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {rawPunches.map((punch, pIdx) => {
                                const isFirstIn = pIdx === 0 && punch.type === "IN";
                                const isLastOut = pIdx === rawPunches.length - 1 && punch.type === "OUT";

                                return (
                                  <div
                                    key={`punch-audit-${pIdx}`}
                                    className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono text-slate-400">
                                        #{pIdx + 1}
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1 font-bold text-[10px] px-1.5 py-0.5 rounded ${
                                          punch.type === "IN"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-rose-100 text-rose-800"
                                        }`}
                                      >
                                        {punch.type === "IN" ? (
                                          <LogIn className="w-2.5 h-2.5" />
                                        ) : (
                                          <LogOut className="w-2.5 h-2.5" />
                                        )}
                                        {punch.type}
                                      </span>
                                      {isFirstIn && (
                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-200">
                                          First In
                                        </span>
                                      )}
                                      {isLastOut && (
                                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 rounded border border-rose-200">
                                          Last Out
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-semibold text-slate-700 font-mono">
                                      {formatTimeExact(punch.time)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Verdict Callout */}
                {selectedDateDetail.record?.verdict && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                      selectedDateDetail.record.status === "ABSENT" || selectedDateDetail.record.requiresCorrection
                        ? "bg-rose-50 border-rose-200 text-rose-800"
                        : isLateArrivalRecord(selectedDateDetail.record)
                        ? "bg-amber-50 border-amber-300 text-amber-900"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <span className="font-bold uppercase tracking-wider block text-[10px] mb-0.5">
                      Verdict:
                    </span>
                    <p className="font-medium text-[11px]">{selectedDateDetail.record.verdict}</p>
                  </div>
                )}
              </div>

              {/* Tasks & Reminders Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ListTodo className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Tasks & Reminders ({selectedDateDetail.reminders.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateTaskModal(selectedDateDetail.dateStr)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task</span>
                  </button>
                </div>

                {selectedDateDetail.reminders.length === 0 ? (
                  <div className="py-6 px-4 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-xl">
                    <ListTodo className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-700">No tasks for this day</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Schedule important duties, meeting reminders, or action items.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateTaskModal(selectedDateDetail.dateStr)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Schedule Task</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDateDetail.reminders.map((task) => {
                      const isPriority = task.priority === "PRIORITY";
                      const isMedium = task.priority === "MEDIUM";

                      return (
                        <div
                          key={task._id}
                          className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                            task.isCompleted
                              ? "bg-slate-50 border-slate-200 opacity-75"
                              : isPriority
                              ? "bg-rose-50/60 border-rose-200"
                              : isMedium
                              ? "bg-amber-50/50 border-amber-200"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={(e) => handleToggleTaskComplete(task, e)}
                                className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                  task.isCompleted
                                    ? "bg-emerald-600 text-white"
                                    : "border border-slate-300 hover:border-indigo-600 bg-white"
                                }`}
                                title={task.isCompleted ? "Mark incomplete" : "Mark completed"}
                              >
                                {task.isCompleted && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </button>

                              <div className="min-w-0 flex-1">
                                <h4
                                  className={`text-xs font-bold leading-snug ${
                                    task.isCompleted ? "line-through text-slate-400" : "text-slate-900"
                                  }`}
                                >
                                  {task.title}
                                </h4>
                                {task.description && (
                                  <p className="text-[11px] text-slate-500 mt-1 whitespace-pre-line leading-relaxed">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Actions: Edit & Delete */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => handleOpenEditTaskModal(task, e)}
                                className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Edit Task"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteTask(task._id, e)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete Task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Tag Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-[10px]">
                            {/* Priority Badge */}
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${
                                isPriority
                                  ? "bg-rose-100 text-rose-800 border border-rose-300"
                                  : isMedium
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : "bg-indigo-100 text-indigo-800 border border-indigo-300"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isPriority ? "bg-rose-500" : isMedium ? "bg-amber-500" : "bg-indigo-500"
                                }`}
                              />
                              {task.priority === "PRIORITY"
                                ? "Priority SLA"
                                : task.priority === "MEDIUM"
                                ? "Medium"
                                : "Normal"}
                            </span>

                            {/* Category Badge */}
                            {task.category && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                                {task.category}
                              </span>
                            )}

                            {/* Time Slot Badge */}
                            {(task.startTime || task.isAllDay) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                                <Clock className="w-2.5 h-2.5" />
                                {formatTimeSlot(task.startTime, task.endTime, task.isAllDay)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                {(!selectedDateDetail.isInactive && (isModalMissingPunch || selectedDateDetail.record?.status === "ABSENT" || selectedDateDetail.record?.requiresCorrection)) && (
                  (() => {
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                    const isTodayOrFuture = selectedDateDetail.dateStr >= todayStr;

                    if (isTodayOrFuture) {
                      return (
                        <div
                          className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs"
                          title="Per company policy, attendance correction for today can only be applied from tomorrow (the next day) once the shift concludes."
                        >
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Correction Opens Tomorrow</span>
                        </div>
                      );
                    }

                    if (onApplyCorrection) {
                      return (
                        <button
                          onClick={() => {
                            const dStr = selectedDateDetail.dateStr;
                            setSelectedDateDetail(null);
                            onApplyCorrection(dStr);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5 ${
                            isModalMissingPunch
                              ? "bg-amber-600 hover:bg-amber-700"
                              : "bg-rose-600 hover:bg-rose-700"
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Apply Attendance Correction</span>
                        </button>
                      );
                    }

                    return null;
                  })()
                )}
                {(!selectedDateDetail.isInactive && (selectedDateDetail.record?.status === "ABSENT" || selectedDateDetail.record?.requiresCorrection)) && onApplyLeave && (
                  <button
                    onClick={() => {
                      const dStr = selectedDateDetail.dateStr;
                      setSelectedDateDetail(null);
                      onApplyLeave(dStr);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Apply Leave (Sick/Casual)</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedDateDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 transition-colors shadow-2xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    })()}

      {/* Task / Reminder Create & Edit Modal */}
      {isTaskModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsTaskModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <ListTodo className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingTask ? "Edit Task / Reminder" : "Schedule Task / Reminder"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Automatic forced PWA push alerts & sound upon start
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTaskModal} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Task Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Monthly Tax Filing Review / Client Meeting"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800"
                />
              </div>

              {/* Date Input with Date Picker & DD/MM/YYYY */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date (DD/MM/YYYY) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="DD/MM/YYYY"
                    value={modalDateDisplay}
                    onChange={(e) => {
                      const val = e.target.value;
                      setModalDateDisplay(val);
                      const parsed = fromDMY(val);
                      if (parsed) {
                        setModalDate(parsed);
                      }
                    }}
                    onBlur={() => {
                      if (modalDate) {
                        setModalDateDisplay(toDMY(modalDate));
                      }
                    }}
                    className="w-full pl-3 pr-9 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800 bg-white"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                    <div className="relative p-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer">
                      <CalendarIcon className="w-4 h-4 pointer-events-none" />
                      <input
                        ref={datePickerRef}
                        type="date"
                        tabIndex={-1}
                        value={modalDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            setModalDate(e.target.value);
                            setModalDateDisplay(toDMY(e.target.value));
                          }
                        }}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        title="Choose date from calendar"
                      />
                    </div>
                  </div>
                </div>
                {modalDate && (
                  <p className="text-[10px] text-indigo-600 font-semibold mt-1">
                    {new Date(modalDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>

              {/* All-Day Schedule Checkbox */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={modalIsAllDay}
                    onChange={(e) => setModalIsAllDay(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>All-Day Task</span>
                </label>
              </div>

              {/* Time Slots (if not all day) */}
              {!modalIsAllDay && (
                <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Time Slot</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={modalStartTime}
                        onChange={(e) => setModalStartTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={modalEndTime}
                        onChange={(e) => setModalEndTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Priority / Importance Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Priority Highlight Tag <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div
                    onClick={() => setModalPriority("PRIORITY")}
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                      modalPriority === "PRIORITY"
                        ? "bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-500/20 font-bold shadow-2xs"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="text-xs font-bold">Priority</span>
                    </div>
                    <span className="text-[10px] text-rose-600 block">High SLA</span>
                  </div>

                  <div
                    onClick={() => setModalPriority("MEDIUM")}
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                      modalPriority === "MEDIUM"
                        ? "bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20 font-bold shadow-2xs"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-xs font-bold">Medium</span>
                    </div>
                    <span className="text-[10px] text-amber-600 block">Standard</span>
                  </div>

                  <div
                    onClick={() => setModalPriority("NORMAL")}
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                      modalPriority === "NORMAL"
                        ? "bg-sky-50 border-sky-500 text-sky-800 ring-2 ring-sky-500/20 font-bold shadow-2xs"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                      <span className="text-xs font-bold">Normal</span>
                    </div>
                    <span className="text-[10px] text-sky-600 block">Routine</span>
                  </div>
                </div>
              </div>

              {/* Category Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category / Tag</label>
                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                >
                  {TASK_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes / Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes & Details (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Key agenda points, instructions, or task context..."
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Mark Completed toggle (if editing) */}
              {editingTask && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={modalIsCompleted}
                      onChange={(e) => setModalIsCompleted(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Task Completed
                    </span>
                  </label>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                {editingTask ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(editingTask._id)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={taskSubmitting}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {taskSubmitting ? "Saving..." : editingTask ? "Update Task" : "Save Task"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Market Holidays Schedule Modal */}
      {isHolidayScheduleOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsHolidayScheduleOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-purple-100 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-50 via-indigo-50/60 to-slate-50 border-b border-purple-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-600/20">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Official Holidays & Observances</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                      {holidays.length} Scheduled Holidays
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Authorized trading & corporate holiday schedule
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHolidayScheduleOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Holiday Table */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <div className="overflow-hidden border border-slate-200 rounded-xl shadow-2xs">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3.5 py-3 text-left">Sr. No</th>
                      <th className="px-3.5 py-3 text-left">Date</th>
                      <th className="px-3.5 py-3 text-left">Day</th>
                      <th className="px-3.5 py-3 text-left">Description</th>
                      <th className="px-3.5 py-3 text-center">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {holidays.map((holiday, idx) => {
                      const d = new Date(holiday.date);
                      const formattedDate = d.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });

                      return (
                        <tr
                          key={holiday.date}
                          className={`hover:bg-purple-50/50 transition-colors ${
                            holiday.day === "Sunday"
                              ? "bg-amber-50/30"
                              : holiday.day === "Saturday"
                              ? "bg-indigo-50/30"
                              : ""
                          }`}
                        >
                          <td className="px-3.5 py-2.5 font-bold text-slate-500">{idx + 1}</td>
                          <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600 font-medium whitespace-nowrap">
                            {holiday.day}
                          </td>
                          <td className="px-3.5 py-2.5 font-bold text-slate-800">
                            {holiday.name}
                          </td>
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            {holiday.isWeekend ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Weekend Holiday
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                {holiday.category || "Scheduled Holiday"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Special Note Box */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Special Note on Diwali Laxmi Pujan:
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <strong>November 08, 2026</strong> shall be a trading holiday on account of Diwali Laxmi Pujan. Muhurat Trading will be conducted on that day. Timings of Muhurat Trading shall be notified subsequently through circular.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Calculated on Financial Year (April – March)
              </span>
              <button
                type="button"
                onClick={() => setIsHolidayScheduleOpen(false)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs shadow-purple-600/20 cursor-pointer"
              >
                Close Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCalendar;
