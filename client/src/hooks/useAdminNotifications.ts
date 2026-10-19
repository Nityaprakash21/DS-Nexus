import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axios";
import { useAuth } from "../../context/AuthContext";

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

const READ_STORAGE_KEY = "admin_read_reminder_ids_v2";

// Helper: Format Date to YYYY-MM-DD
export const getLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper: Get reminder date string in YYYY-MM-DD (safe against timezone offsets)
export const getReminderDateString = (dateVal: string | Date): string => {
  if (!dateVal) return "";
  // If it's already a pure YYYY-MM-DD string without time/timezone component
  if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
    return dateVal.trim();
  }
  // Otherwise parse as Date and convert to user's local YYYY-MM-DD
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  return getLocalDateString(d);
};

// Check if task has reached its start date ("on the very first date of the task to be started")
export const isReminderStarted = (reminder: AdminReminderItem): boolean => {
  const todayStr = getLocalDateString();
  const reminderDateStr = getReminderDateString(reminder.date);
  return reminderDateStr <= todayStr;
};

// Helper: Format to DD/MM/YYYY
export const formatToDMY = (dateStr: string): string => {
  if (!dateStr) return "";
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const [y, m, d] = dateStr.trim().split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Play audio alert
export const playAlertSound = (priority: "PRIORITY" | "MEDIUM" | "NORMAL") => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (priority === "PRIORITY") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.frequency.setValueAtTime(659, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // AudioContext blocked by policy prior to interaction - fail silently
  }
};

// Immediate forced notification dispatch - executes at the exact instant a task is created or started
export const dispatchInstantReminderNotification = (reminder: AdminReminderItem) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  const trigger = () => {
    const priorityBadge =
      reminder.priority === "PRIORITY"
        ? "🔴 [PRIORITY TASK]"
        : reminder.priority === "MEDIUM"
        ? "🟡 [MEDIUM TASK]"
        : "🔵 [TASK REMINDER]";

    const title = `${priorityBadge} ${reminder.title}`;
    const timeStr = reminder.isAllDay
      ? "All-Day Schedule"
      : reminder.startTime
      ? `Scheduled at ${reminder.startTime}${reminder.endTime ? " – " + reminder.endTime : ""}`
      : "Scheduled Task";

    const dateFormatted = formatToDMY(reminder.date);
    const body = `Started: ${dateFormatted} | ${timeStr}\n${reminder.description || "Active reminder. Tap to open and read task."}`;

    // 1. Try via active Service Worker for native Android status bar tray pinning
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title,
        options: {
          body,
          tag: `task-${reminder._id}`,
          priority: reminder.priority,
          reminderId: reminder._id,
          requireInteraction: true,
          renotify: true,
          vibrate: [300, 100, 300, 100, 300],
          url: `/dashboard?openReminder=${encodeURIComponent(reminder._id)}`,
        },
      });
    } else {
      // 2. Direct Notification API fallback
      try {
        new Notification(title, {
          body,
          icon: "/pwa-192x192.png",
          badge: "/favicon.png",
          tag: `task-${reminder._id}`,
          requireInteraction: true,
          renotify: true,
        });
      } catch (err) {
        console.warn("Direct Notification fallback error:", err);
      }
    }

    // Audible alert immediately
    playAlertSound(reminder.priority);
  };

  if (Notification.permission === "granted") {
    trigger();
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") trigger();
    });
  }
};

export const useAdminNotifications = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [reminders, setReminders] = useState<AdminReminderItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(READ_STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const [permissionState, setPermissionState] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "denied";
  });

  const initialCheckDone = useRef(false);

  // Request native permission proactively
  const requestNativePermission = useCallback(async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        setPermissionState(permission);
        return permission;
      } catch (err) {
        console.error("Failed to request notification permission:", err);
      }
    }
    return "denied";
  }, []);

  const dispatchNativeNotification = useCallback((reminder: AdminReminderItem) => {
    dispatchInstantReminderNotification(reminder);
  }, []);

  // Dismiss native notification when marked as read
  const closeNativeNotification = useCallback((id: string) => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "CLOSE_NOTIFICATION",
        tag: `task-${id}`,
      });
    }
  }, []);

  // Fetch reminders for user
  const fetchReminders = useCallback(async () => {
    if (!user) return;
    try {
      const now = new Date();
      const res = await api.get("/admin/reminders", {
        params: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
      });
      const items: AdminReminderItem[] = res.data?.data || [];
      setReminders(items);

      // Identify tasks that have reached their start date AND have not been opened & read
      const unreadStartedTasks = items.filter(
        (r) => !r.isCompleted && !r.isRead && !readIds.has(r._id) && isReminderStarted(r)
      );

      // Force notification on all started unread tasks despite their importance tag
      unreadStartedTasks.forEach((task) => {
        dispatchNativeNotification(task);
      });
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  }, [user, readIds, dispatchNativeNotification]);

  // Mark single reminder as opened and read
  const markAsRead = useCallback(
    async (id: string) => {
      // 1. Immediately update local readIds set and persistence
      setReadIds((prev) => {
        const updated = new Set(prev);
        updated.add(id);
        try {
          localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(updated)));
        } catch (e) {
          console.error("Error saving read IDs:", e);
        }
        return updated;
      });

      // 2. Update local state
      setReminders((prev) =>
        prev.map((r) => (r._id === id ? { ...r, isRead: true, readAt: new Date().toISOString() } : r))
      );

      // 3. Dismiss native pinned notification from Android tray
      closeNativeNotification(id);

      // 4. Sync read status with backend API
      try {
        await api.patch(`/admin/reminders/${id}/read`);
      } catch (err) {
        console.error("Failed to sync markAsRead to backend:", err);
      }
    },
    [closeNativeNotification]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    setReadIds((prev) => {
      const updated = new Set(prev);
      reminders.forEach((r) => updated.add(r._id));
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(updated)));
      } catch (e) {
        console.error("Error saving read IDs:", e);
      }
      return updated;
    });

    setReminders((prev) =>
      prev.map((r) => ({ ...r, isRead: true, readAt: new Date().toISOString() }))
    );

    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "CLOSE_ALL_NOTIFICATIONS",
      });
    }

    try {
      await api.patch("/admin/reminders/read-all");
    } catch (err) {
      console.error("Failed to sync markAllAsRead to backend:", err);
    }
  }, [reminders]);

  // Initial mount, permission request & 25s interval for continuous forced alert
  useEffect(() => {
    if (!user) return;

    fetchReminders();

    // Auto-request native permission if default
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default" && !initialCheckDone.current) {
        initialCheckDone.current = true;
        requestNativePermission();
      }
    }

    // Listen to messages from Service Worker (e.g. user clicked native notification)
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "REMINDER_OPENED" && event.data.reminderId) {
        markAsRead(event.data.reminderId);
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    }

    // Check URL search params for ?openReminder=...
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const openReminderId = params.get("openReminder");
      if (openReminderId) {
        markAsRead(openReminderId);
        // Clean URL query param without reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }

    // Listen for instant reminder creation within client app (e.g. task added on start day)
    const handleReminderCreated = (event: Event) => {
      const customEvent = event as CustomEvent<AdminReminderItem>;
      const createdItem = customEvent.detail;
      if (
        createdItem &&
        isReminderStarted(createdItem) &&
        !createdItem.isCompleted &&
        !createdItem.isRead
      ) {
        setReminders((prev) => [
          createdItem,
          ...prev.filter((r) => r._id !== createdItem._id),
        ]);
        dispatchInstantReminderNotification(createdItem);
      }
    };

    window.addEventListener("ADMIN_REMINDER_CREATED", handleReminderCreated);

    // Continuous liveness interval: check every 25 seconds
    const interval = setInterval(fetchReminders, 25000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("ADMIN_REMINDER_CREATED", handleReminderCreated);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
      }
    };
  }, [user, fetchReminders, markAsRead, requestNativePermission]);

  // Compute unread reminders that have started
  const unreadStartedReminders = reminders.filter(
    (r) => !r.isCompleted && !r.isRead && !readIds.has(r._id) && isReminderStarted(r)
  );

  const unreadCount = unreadStartedReminders.length;
  const hasUnread = unreadCount > 0;

  const highestPriority: "PRIORITY" | "MEDIUM" | "NORMAL" = unreadStartedReminders.some(
    (r) => r.priority === "PRIORITY"
  )
    ? "PRIORITY"
    : unreadStartedReminders.some((r) => r.priority === "MEDIUM")
    ? "MEDIUM"
    : "NORMAL";

  return {
    isAdmin,
    reminders,
    unreadReminders: unreadStartedReminders,
    unreadStartedReminders,
    unreadCount,
    hasUnread,
    highestPriority,
    permissionState,
    requestNativePermission,
    markAsRead,
    markAllAsRead,
    refresh: fetchReminders,
    playAlertSound,
  };
};
