import { useState, useRef, useEffect } from "react";
import {
  Bell,
  CheckCircle2,
  Clock,
  Calendar,
  X,
  ExternalLink,
  Check,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminNotifications, formatToDMY } from "../../hooks/useAdminNotifications";
import { useAuth } from "../../../context/AuthContext";

// Helper: format time slot
const formatTimeSlot = (startTime?: string | null, endTime?: string | null, isAllDay?: boolean) => {
  if (isAllDay) return "All-Day Task";
  if (!startTime) return "Time Unset";
  const formatTime = (t: string) => {
    const [hStr, mStr] = t.split(":");
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${mStr || "00"} ${ampm}`;
  };
  return `${formatTime(startTime)}${endTime ? " – " + formatTime(endTime) : ""}`;
};

export const AdminNotificationBell = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    unreadReminders,
    unreadCount,
    hasUnread,
    highestPriority,
    permissionState,
    requestNativePermission,
    markAsRead,
    markAllAsRead,
    playAlertSound,
  } = useAdminNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const isPriorityHigh = highestPriority === "PRIORITY";
  const isPriorityMedium = highestPriority === "MEDIUM";

  const handleOpenDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen && hasUnread && highestPriority) {
      playAlertSound(highestPriority);
    }
  };

  const handleViewTaskInCalendar = (reminderId: string) => {
    markAsRead(reminderId);
    setIsOpen(false);
    navigate("/dashboard");
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Continuous Pulsating Highlight Bell Button */}
      <button
        type="button"
        onClick={handleOpenDropdown}
        aria-label="Admin Task Notifications"
        className={`relative p-2.5 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center ${
          hasUnread
            ? isPriorityHigh
              ? "bg-rose-50 text-rose-700 ring-2 ring-rose-500/80 shadow-lg shadow-rose-500/30 hover:bg-rose-100"
              : isPriorityMedium
              ? "bg-amber-50 text-amber-700 ring-2 ring-amber-500/80 shadow-md shadow-amber-500/25 hover:bg-amber-100"
              : "bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/80 shadow-md shadow-indigo-500/25 hover:bg-indigo-100"
            : "bg-white/80 hover:bg-slate-100 text-slate-600 border border-slate-200/80 hover:text-slate-900 shadow-2xs"
        }`}
      >
        {/* Continuous Pulsating Ping Ring (Persists until user opens and reads it!) */}
        {hasUnread && (
          <span
            className={`absolute -inset-1 rounded-xl animate-ping opacity-60 pointer-events-none ${
              isPriorityHigh
                ? "bg-rose-500"
                : isPriorityMedium
                ? "bg-amber-500"
                : "bg-indigo-500"
            }`}
          />
        )}

        {/* Bell Icon with Gentle Ring Animation when unread */}
        <Bell
          className={`w-5 h-5 relative z-10 transition-transform ${
            hasUnread ? "animate-bounce" : ""
          }`}
        />

        {/* Unread Badge Counter */}
        {hasUnread && (
          <span
            className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-md z-20 ${
              isPriorityHigh
                ? "bg-rose-600 ring-2 ring-white"
                : isPriorityMedium
                ? "bg-amber-600 ring-2 ring-white"
                : "bg-indigo-600 ring-2 ring-white"
            }`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200/90 shadow-2xl z-50 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                  isPriorityHigh
                    ? "bg-rose-100 text-rose-700"
                    : isPriorityMedium
                    ? "bg-amber-100 text-amber-700"
                    : "bg-indigo-50 text-indigo-600"
                }`}
              >
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Task Notifications</h3>
                <p className="text-[11px] text-slate-500">
                  {unreadCount} unread reminder{unreadCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {hasUnread && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Android Native Push Status Bar Banner */}
          {permissionState !== "granted" && (
            <div className="p-3 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <p className="text-[11px] font-medium text-indigo-950 leading-tight">
                  Enable device native push notifications
                </p>
              </div>
              <button
                type="button"
                onClick={requestNativePermission}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shrink-0 transition-colors cursor-pointer shadow-2xs"
              >
                Enable
              </button>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {unreadReminders.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-800">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No active unread task reminders. Continuous highlight is off.
                </p>
              </div>
            ) : (
              unreadReminders.map((r) => {
                const isItemPriority = r.priority === "PRIORITY";
                const isItemMedium = r.priority === "MEDIUM";

                return (
                  <div
                    key={r._id}
                    className={`p-3.5 transition-colors flex items-start justify-between gap-3 ${
                      isItemPriority
                        ? "bg-rose-50/40 hover:bg-rose-50/70"
                        : isItemMedium
                        ? "bg-amber-50/30 hover:bg-amber-50/60"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      {/* Priority Pill & Date */}
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${
                            isItemPriority
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : isItemMedium
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-sky-100 text-sky-800 border-sky-300"
                          }`}
                        >
                          {r.priority}
                        </span>

                        <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatToDMY(r.date)}
                        </span>

                        <span className="text-[10px] font-semibold text-indigo-600 flex items-center gap-0.5">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          {formatTimeSlot(r.startTime, r.endTime, r.isAllDay)}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <p className="text-xs font-bold text-slate-900 truncate">{r.title}</p>
                      {r.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                          {r.description}
                        </p>
                      )}
                    </div>

                    {/* Actions: Mark Read & View */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => markAsRead(r._id)}
                        title="Mark as read"
                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewTaskInCalendar(r._id)}
                        title="View in Executive Schedule"
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate("/dashboard");
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Go to Executive Schedule</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationBell;
