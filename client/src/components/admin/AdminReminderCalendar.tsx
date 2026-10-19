import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  X,
  AlertCircle,
  Sparkles,
  Calendar as CalendarIcon,
  Tag,
  Check,
} from "lucide-react";
import api from "../../api/axios";
import {
  dispatchInstantReminderNotification,
  isReminderStarted,
  getReminderDateString,
  formatToDMY,
} from "../../hooks/useAdminNotifications";

export interface AdminReminderItem {
  _id: string;
  title: string;
  description?: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay?: boolean;
  priority: "PRIORITY" | "MEDIUM" | "NORMAL";
  category?: string;
  isCompleted?: boolean;
  isRead?: boolean;
  readAt?: string | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const CATEGORIES = [
  "General", "Meeting", "Review", "Deadline", "Payroll", "Operations", "Personal"
];

// Helper: Convert YYYY-MM-DD -> DD/MM/YYYY
const toDMY = formatToDMY;

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

const AdminReminderCalendar = () => {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [reminders, setReminders] = useState<AdminReminderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | "PRIORITY" | "MEDIUM" | "NORMAL">("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingReminder, setEditingReminder] = useState<AdminReminderItem | null>(null);
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
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Day inspection modal (when clicking on a date or "+N more")
  const [viewingDayDetail, setViewingDayDetail] = useState<{
    dateStr: string;
    dayName: string;
    items: AdminReminderItem[];
  } | null>(null);

  // Fetch reminders for the current month
  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/reminders", {
        params: {
          year: selectedYear,
          month: selectedMonth,
        },
      });
      setReminders(res.data?.data || []);
    } catch (err) {
      console.error("Error fetching admin reminders:", err);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchReminders();
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

  // Open modal to create new reminder
  const handleOpenCreateModal = (dateStr?: string) => {
    const targetDate =
      dateStr ||
      `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(
        Math.min(today.getDate(), 28)
      ).padStart(2, "0")}`;

    setEditingReminder(null);
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
    setIsModalOpen(true);
  };

  // Open modal to edit existing reminder - automatically marks it as opened & read
  const handleOpenEditModal = (reminder: AdminReminderItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Mark as read immediately when admin opens to read it
    if (!reminder.isRead) {
      api.patch(`/admin/reminders/${reminder._id}/read`).catch(() => {});
      setReminders((prev) =>
        prev.map((item) =>
          item._id === reminder._id
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item
        )
      );
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CLOSE_NOTIFICATION",
          tag: `task-${reminder._id}`,
        });
      }
    }

    const dateStr = getReminderDateString(reminder.date);

    setEditingReminder({
      ...reminder,
      isRead: true,
      readAt: reminder.readAt || new Date().toISOString(),
    });
    setModalDate(dateStr);
    setModalDateDisplay(toDMY(dateStr));
    setModalTitle(reminder.title);
    setModalDescription(reminder.description || "");
    setModalStartTime(reminder.startTime || "10:00");
    setModalEndTime(reminder.endTime || "11:00");
    setModalIsAllDay(Boolean(reminder.isAllDay));
    setModalPriority(reminder.priority || "NORMAL");
    setModalCategory(reminder.category || "General");
    setModalIsCompleted(Boolean(reminder.isCompleted));
    setModalError("");
    setIsModalOpen(true);
  };

  // Submit modal (Create or Update)
  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      setModalError("Please provide a title for the reminder.");
      return;
    }
    const finalDate = modalDate || fromDMY(modalDateDisplay);
    if (!finalDate) {
      setModalError("Please select or enter a valid date in DD/MM/YYYY format.");
      return;
    }

    setSubmitting(true);
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

      let savedReminder: AdminReminderItem | null = null;
      if (editingReminder) {
        const res = await api.put(`/admin/reminders/${editingReminder._id}`, payload);
        savedReminder = res.data?.data;
      } else {
        const res = await api.post("/admin/reminders", payload);
        savedReminder = res.data?.data;
      }

      // If added on the same day of the start (e.g. starts 8 Sept, added 8 Sept)
      // or already started, force notification at that very instant time!
      if (
        savedReminder &&
        isReminderStarted(savedReminder) &&
        !savedReminder.isCompleted &&
        !savedReminder.isRead
      ) {
        dispatchInstantReminderNotification(savedReminder);
        window.dispatchEvent(
          new CustomEvent("ADMIN_REMINDER_CREATED", { detail: savedReminder })
        );
      }

      setIsModalOpen(false);
      if (viewingDayDetail) setViewingDayDetail(null);
      await fetchReminders();
    } catch (err: any) {
      console.error("Failed to save reminder:", err);
      setModalError(err.response?.data?.error || "Failed to save reminder. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete reminder
  const handleDeleteReminder = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this reminder?")) return;

    try {
      await api.delete(`/admin/reminders/${id}`);
      setIsModalOpen(false);
      if (viewingDayDetail) setViewingDayDetail(null);
      await fetchReminders();
    } catch (err) {
      console.error("Failed to delete reminder:", err);
      alert("Failed to delete reminder. Please try again.");
    }
  };

  // Toggle completion status quickly
  const handleToggleComplete = async (reminder: AdminReminderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.put(`/admin/reminders/${reminder._id}`, {
        isCompleted: !reminder.isCompleted,
      });
      fetchReminders();
    } catch (err) {
      console.error("Failed to toggle reminder status", err);
    }
  };

  // Format 24h time to 12h display
  const formatTimeSlot = (startTime?: string | null, endTime?: string | null, isAllDay?: boolean) => {
    if (isAllDay) return "All Day";
    if (!startTime) return "Time unset";

    const formatSingleTime = (timeStr: string) => {
      const [hStr, mStr] = timeStr.split(":");
      let h = parseInt(hStr, 10);
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${mStr || "00"} ${ampm}`;
    };

    const startFormatted = formatSingleTime(startTime);
    if (!endTime) return startFormatted;
    const endFormatted = formatSingleTime(endTime);
    return `${startFormatted} – ${endFormatted}`;
  };

  // Map of reminders by date string (YYYY-MM-DD)
  const remindersByDateMap = useMemo(() => {
    const map = new Map<string, AdminReminderItem[]>();
    reminders.forEach((r) => {
      if (priorityFilter !== "ALL" && r.priority !== priorityFilter) return;
      const dateStr = getReminderDateString(r.date);
      if (!dateStr) return;
      const list = map.get(dateStr) || [];
      list.push(r);
      map.set(dateStr, list);
    });
    return map;
  }, [reminders, priorityFilter]);

  // Counts by priority
  const priorityCounts = useMemo(() => {
    return {
      all: reminders.length,
      priority: reminders.filter((r) => r.priority === "PRIORITY").length,
      medium: reminders.filter((r) => r.priority === "MEDIUM").length,
      normal: reminders.filter((r) => r.priority === "NORMAL").length,
    };
  }, [reminders]);

  // Calendar logic calculation
  const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ...
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  const gridCells = [];
  // Previous month padding
  for (let i = 0; i < startingDayOfWeek; i++) {
    gridCells.push({ isPadding: true, key: `pad-prev-${i}` });
  }

  // Days in month
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDateObj = new Date(selectedYear, selectedMonth - 1, day);
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
    const dayReminders = remindersByDateMap.get(dateStr) || [];
    const isToday =
      day === today.getDate() &&
      selectedMonth === today.getMonth() + 1 &&
      selectedYear === today.getFullYear();
    const dayOfWeek = currentDateObj.getDay();
    const isWeekend = dayOfWeek === 0;

    gridCells.push({
      isPadding: false,
      day,
      dateObj: currentDateObj,
      dateStr,
      reminders: dayReminders,
      isToday,
      isWeekend,
      dayName: currentDateObj.toLocaleDateString("en-US", { weekday: "short" }),
      key: `day-${day}`,
    });
  }

  // Next month padding
  const remainingSlots = (7 - (gridCells.length % 7)) % 7;
  for (let i = 0; i < remainingSlots; i++) {
    gridCells.push({ isPadding: true, key: `pad-next-${i}` });
  }

  const yearOptions = [];
  const currentYr = today.getFullYear();
  for (let y = currentYr - 2; y <= currentYr + 2; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden mt-6">
      {/* Calendar Top Controls Header */}
      <div className="p-5 bg-slate-50/70 border-b border-slate-200/80 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0 shadow-2xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">Executive Schedule & Reminders</h2>
                {priorityCounts.all > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    {priorityCounts.all} Active Task{priorityCounts.all === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 shadow-2xs">
                    <CalendarIcon className="w-3 h-3 text-slate-400" />
                    No records
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Admin operational calendar for time-slotted reminders, meetings & priority tasks
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Reminder
          </button>
        </div>

        {/* Filters & Month Navigation Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-200/60">
          {/* Priority Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" /> Priority:
            </span>
            <button
              onClick={() => setPriorityFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                priorityFilter === "ALL"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              All ({priorityCounts.all})
            </button>
            <button
              onClick={() => setPriorityFilter("PRIORITY")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                priorityFilter === "PRIORITY"
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Priority ({priorityCounts.priority})
            </button>
            <button
              onClick={() => setPriorityFilter("MEDIUM")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                priorityFilter === "MEDIUM"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Medium ({priorityCounts.medium})
            </button>
            <button
              onClick={() => setPriorityFilter("NORMAL")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                priorityFilter === "NORMAL"
                  ? "bg-sky-600 text-white shadow-2xs"
                  : "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              Normal ({priorityCounts.normal})
            </button>
          </div>

          {/* Right Month/Year Picker Controls */}
          <div className="flex items-center gap-2">
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

            <button
              onClick={handleToday}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-2xs cursor-pointer shrink-0"
            >
              Today
            </button>

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

      {/* Calendar Grid */}
      <div className="p-4 sm:p-6 overflow-x-auto">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium text-slate-500 mt-2">Loading schedule & reminders...</p>
          </div>
        ) : (
          <div className="min-w-[720px]">
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

            {/* Grid Cells */}
            <div className="grid grid-cols-7 gap-2">
              {gridCells.map((cell) => {
                if (cell.isPadding) {
                  return (
                    <div
                      key={cell.key}
                      className="min-h-[120px] p-2 rounded-xl bg-slate-50/40 border border-dashed border-slate-200/50 opacity-40 pointer-events-none"
                    />
                  );
                }

                const remList = cell.reminders || [];
                const displayCount = 3;
                const overflowCount = remList.length - displayCount;

                return (
                  <div
                    key={cell.key}
                    onClick={() => handleOpenCreateModal(cell.dateStr)}
                    className={`min-h-[120px] p-1.5 sm:p-2 rounded-xl border transition-all duration-200 flex flex-col justify-between cursor-pointer group hover:shadow-md relative overflow-hidden max-w-full ${
                      cell.isToday
                        ? "bg-indigo-50/30 border-indigo-300 ring-2 ring-indigo-500/20"
                        : cell.isWeekend
                        ? "bg-slate-50/50 border-slate-200/70"
                        : "bg-white border-slate-200 hover:border-indigo-200"
                    }`}
                  >
                    {/* Top Row: Date Number & Hover Add Trigger */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-bold flex items-center justify-center w-6 h-6 rounded-lg ${
                          cell.isToday
                            ? "bg-indigo-600 text-white shadow-xs"
                            : cell.isWeekend
                            ? "text-slate-400"
                            : "text-slate-800 group-hover:text-indigo-600"
                        }`}
                      >
                        {cell.day}
                      </span>

                      {/* Quick Add Button on Hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCreateModal(cell.dateStr);
                        }}
                        title="Add task on this date"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-opacity cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Middle: Scheduled Task Chips or Default 'No records' */}
                    <div className="space-y-1.5 flex-1 flex flex-col justify-start">
                      {remList.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-2 text-center min-h-[44px]">
                          <span
                            title="No records"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100/90 text-slate-400 border border-slate-200/60 shadow-2xs group-hover:border-indigo-200 group-hover:text-slate-500 transition-colors"
                          >
                            No records
                          </span>
                        </div>
                      ) : (
                        remList.slice(0, displayCount).map((r) => {
                        const isPriority = r.priority === "PRIORITY";
                        const isMedium = r.priority === "MEDIUM";

                        // Check if task has reached start date and is unread
                        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                        const rDate = new Date(r.date);
                        const rDateStr = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, "0")}-${String(rDate.getDate()).padStart(2, "0")}`;
                        const isStarted = rDateStr <= todayStr;
                        const isUnreadAlert = isStarted && !r.isCompleted && !r.isRead;

                        return (
                          <div
                            key={r._id}
                            onClick={(e) => handleOpenEditModal(r, e)}
                            title={isUnreadAlert ? "Continuous alert: Task started and unread. Click to open and read." : undefined}
                            className={`p-1.5 rounded-lg border text-left transition-all duration-150 cursor-pointer shadow-2xs hover:scale-[1.02] relative ${
                              r.isCompleted
                                ? "bg-slate-100/80 border-slate-200 opacity-60 text-slate-500"
                                : isUnreadAlert
                                ? "bg-amber-50/95 border-amber-300 ring-2 ring-amber-400 text-amber-950 shadow-xs"
                                : isPriority
                                ? "bg-rose-50/90 border-rose-200/90 hover:bg-rose-100/90 text-rose-900 ring-1 ring-rose-500/10"
                                : isMedium
                                ? "bg-amber-50/90 border-amber-200/90 hover:bg-amber-100/90 text-amber-900 ring-1 ring-amber-500/10"
                                : "bg-sky-50/90 border-sky-200/90 hover:bg-sky-100/90 text-sky-900 ring-1 ring-sky-500/10"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`text-[9px] font-bold flex items-center gap-0.5 truncate ${
                                  isUnreadAlert
                                    ? "text-amber-800 font-extrabold"
                                    : isPriority
                                    ? "text-rose-700"
                                    : isMedium
                                    ? "text-amber-700"
                                    : "text-sky-700"
                                }`}
                              >
                                <Clock className="w-2.5 h-2.5 shrink-0" />
                                {formatTimeSlot(r.startTime, r.endTime, r.isAllDay)}
                              </span>

                              {isUnreadAlert ? (
                                <span className="relative flex h-2 w-2 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                              ) : (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    isPriority
                                      ? "bg-rose-500"
                                      : isMedium
                                      ? "bg-amber-500"
                                      : "bg-sky-500"
                                  }`}
                                />
                              )}
                            </div>
                            <p
                              className={`text-[10px] font-semibold truncate leading-tight mt-0.5 ${
                                r.isCompleted ? "line-through text-slate-400" : ""
                              }`}
                            >
                              {r.title}
                            </p>
                          </div>
                        );
                      })
                    )}

                      {/* Overflow indicator if > 3 reminders */}
                      {overflowCount > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingDayDetail({
                              dateStr: cell.dateStr!,
                              dayName: cell.dayName!,
                              items: remList,
                            });
                          }}
                          className="w-full text-center py-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                        >
                          +{overflowCount} more
                        </button>
                      )}
                    </div>

                    {/* Bottom: Empty hint if no tasks */}
                    {remList.length === 0 && (
                      <div className="pt-1 text-center">
                        <span className="text-[10px] text-slate-300 italic group-hover:text-indigo-600 transition-colors">
                          + Add slot
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reminder Create & Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingReminder ? "Edit Reminder Task" : "Schedule New Reminder"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingReminder ? "Update time slot or priority tag" : "Add task with time slot and priority tag"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitModal} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Read / Unread Status Badge (if viewing existing reminder) */}
              {editingReminder && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600">Notification Status:</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Check className="w-3 h-3" /> Opened & Read
                  </span>
                </div>
              )}

              {/* Task Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task / Reminder Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Executive Board Meeting, Payroll Finalization"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Date (DD/MM/YYYY) & All-Day Toggle */}
              <div className="grid grid-cols-2 gap-3 items-end">
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

                <div className="pb-3">
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
              </div>

              {/* Time Slots (Start Time & End Time) */}
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

              {/* Priority Tag Option Selector (Priority, Medium, Normal) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Priority Highlight Tag <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Priority (Red) */}
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
                    <span className="text-[10px] text-rose-600 block">High / Urgent</span>
                  </div>

                  {/* Medium (Amber) */}
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

                  {/* Normal (Sky) */}
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
                  {CATEGORIES.map((cat) => (
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
                  placeholder="Key agenda points, meeting link, or reminder context..."
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Mark as completed toggle (if editing) */}
              {editingReminder && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={modalIsCompleted}
                      onChange={(e) => setModalIsCompleted(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Task Completed
                    </span>
                  </label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                {editingReminder ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteReminder(editingReminder._id)}
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
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {submitting ? "Saving..." : editingReminder ? "Update Task" : "Save Reminder"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day Schedule Inspection Modal (when "+N more" is clicked) */}
      {viewingDayDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
          onClick={() => setViewingDayDetail(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {new Date(viewingDayDetail.dateStr).toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <p className="text-xs text-slate-500">
                  {viewingDayDetail.items.length} Task{viewingDayDetail.items.length === 1 ? "" : "s"} scheduled for this day
                </p>
              </div>
              <button
                onClick={() => setViewingDayDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {viewingDayDetail.items.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-slate-600">No records</p>
                  <p className="text-[11px] text-slate-400">No tasks or reminders scheduled for this date.</p>
                </div>
              ) : (
                viewingDayDetail.items.map((r) => {
                const isPriority = r.priority === "PRIORITY";
                const isMedium = r.priority === "MEDIUM";

                return (
                  <div
                    key={r._id}
                    onClick={() => {
                      setViewingDayDetail(null);
                      handleOpenEditModal(r);
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all hover:shadow-xs ${
                      r.isCompleted
                        ? "bg-slate-50 border-slate-200 text-slate-500 opacity-70"
                        : isPriority
                        ? "bg-rose-50/70 border-rose-200 hover:bg-rose-50"
                        : isMedium
                        ? "bg-amber-50/70 border-amber-200 hover:bg-amber-50"
                        : "bg-sky-50/70 border-sky-200 hover:bg-sky-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                            isPriority
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : isMedium
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-sky-100 text-sky-800 border-sky-300"
                          }`}
                        >
                          {r.priority}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatTimeSlot(r.startTime, r.endTime, r.isAllDay)}
                        </span>
                      </div>
                      <p
                        className={`text-xs font-bold text-slate-900 truncate ${
                          r.isCompleted ? "line-through text-slate-400" : ""
                        }`}
                      >
                        {r.title}
                      </p>
                      {r.description && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{r.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleToggleComplete(r, e)}
                        title={r.isCompleted ? "Mark incomplete" : "Mark complete"}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          r.isCompleted
                            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                            : "bg-white text-slate-400 border-slate-200 hover:text-emerald-600"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  const targetDate = viewingDayDetail.dateStr;
                  setViewingDayDetail(null);
                  handleOpenCreateModal(targetDate);
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add to this day
              </button>
              <button
                onClick={() => setViewingDayDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 transition-colors shadow-2xs cursor-pointer"
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

export default AdminReminderCalendar;
