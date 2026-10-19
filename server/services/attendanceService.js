import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import AttendanceCorrection from "../models/AttendanceCorrection.js";
import Holiday from "../models/Holiday.js";
import { MARKET_HOLIDAYS } from "../constants/marketHolidays.js";
import { ATTENDANCE_RULES } from "../constants/attendanceRules.js";
import cache from "../utils/cache.js";

// Helper: Extract hour, minute and minutesFromMidnight in IST (Asia/Kolkata)
export const getISTTime = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  let hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  if (hour === 24) hour = 0;
  hour = hour % 24;
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return { hour, minute, minutesFromMidnight: hour * 60 + minute };
};

// Helper: Format a Date to YYYY-MM-DD in IST (Asia/Kolkata)
export const getISTDateString = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
};

// Helper: Get Date object representing 00:00:00.000 IST for a date
export const getISTMidnightDate = (date = new Date()) => {
  const dStr = getISTDateString(date);
  return new Date(`${dStr}T00:00:00.000+05:30`);
};

// Helper: Calculate distance between two GPS coordinates in meters using Haversine formula
export const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const toRad = (val) => (val * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
};

// Helper: Determine clock-in punch status based on shift rules
export const evaluatePunchStatus = async (now, employeeId, todayISTMidnight, existingAttendanceId = null) => {
  const { minutesFromMidnight } = getISTTime(now);

  if (minutesFromMidnight <= ATTENDANCE_RULES.GRACE_PERIOD_END_MINUTES) {
    return {
      status: "PRESENT",
      isLateBuffer: false,
      wasLate: false,
      lateCountThisMonth: 0,
      requiresCorrection: false,
      verdict:
        minutesFromMidnight <= ATTENDANCE_RULES.SHIFT_START_MINUTES
          ? "On Time (Official Shift: 10:00 AM - 6:00 PM)"
          : "On Time (Within 10:15 AM grace period)",
      assignedDayType: null,
    };
  }

  if (minutesFromMidnight <= ATTENDANCE_RULES.LATE_BUFFER_CUTOFF_MINUTES) {
    const startOfMonth = new Date(todayISTMidnight.getFullYear(), todayISTMidnight.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(todayISTMidnight.getFullYear(), todayISTMidnight.getMonth() + 1, 0, 23, 59, 59, 999);

    const currentMonthLateCount = await Attendance.countDocuments({
      employeeId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
      $or: [{ isLateBuffer: true }, { status: "LATE" }],
      ...(existingAttendanceId ? { _id: { $ne: existingAttendanceId } } : {}),
    });

    if (currentMonthLateCount < ATTENDANCE_RULES.MAX_MONTHLY_LATE_BUFFER) {
      const lateCountThisMonth = currentMonthLateCount + 1;
      return {
        status: "LATE",
        isLateBuffer: true,
        wasLate: true,
        lateCountThisMonth,
        requiresCorrection: false,
        verdict: `Late Arrival (${lateCountThisMonth}/${ATTENDANCE_RULES.MAX_MONTHLY_LATE_BUFFER} allowed monthly late buffer used: 10:15 AM - 10:30 AM)`,
        assignedDayType: null,
      };
    }

    const lateCountThisMonth = currentMonthLateCount + 1;
    return {
      status: "ABSENT",
      isLateBuffer: true,
      wasLate: true,
      lateCountThisMonth,
      requiresCorrection: true,
      verdict: `Marked Absent (Exceeded 5 monthly late arrival quota: ${lateCountThisMonth}/5 used). Regularize via Attendance Correction (max 10/month) or Apply Leave (Sick / Casual leave only).`,
      assignedDayType: "Absent",
    };
  }

  return {
    status: "ABSENT",
    isLateBuffer: false,
    wasLate: false,
    lateCountThisMonth: 0,
    requiresCorrection: true,
    verdict:
      "Marked Absent (Clocked in after 10:30 AM). Regularize via Attendance Correction (max 10/month) or Apply Leave (Sick / Casual leave only).",
    assignedDayType: "Absent",
  };
};

// Helper: Calculate total working hours from punch intervals
export const calculateWorkingHoursFromPunches = (punches, checkIn, now) => {
  let totalWorkMs = 0;
  let lastInTime = null;

  if (punches && punches.length > 0) {
    for (const p of punches) {
      const pt = new Date(p.time).getTime();
      if (p.type === "IN") {
        lastInTime = pt;
      } else if (p.type === "OUT" && lastInTime !== null) {
        totalWorkMs += Math.max(0, pt - lastInTime);
        lastInTime = null;
      }
    }
  }

  const firstInTime = checkIn ? new Date(checkIn).getTime() : now.getTime();
  const diffMs = totalWorkMs > 0 ? totalWorkMs : Math.max(0, now.getTime() - firstInTime);
  const diffHours = Math.min(24, diffMs / (1000 * 60 * 60));
  const workingHours = parseFloat(diffHours.toFixed(2));
  const dayType = workingHours >= ATTENDANCE_RULES.FULL_DAY_MIN_HOURS ? "Full Day" : "Half Day";

  return { workingHours, dayType };
};

// Helper: Lock past unclosed punches (00:00 midnight lock)
export const lockPastUnclosedPunches = async (employeeId, todayISTMidnight) => {
  try {
    const unclosedPastRecords = await Attendance.find({
      employeeId,
      date: { $lt: todayISTMidnight },
      $or: [{ currentStatus: "IN" }, { checkIn: { $ne: null }, checkOut: null }],
    });

    for (const rec of unclosedPastRecords) {
      const effectiveDateStr = getISTDateString(new Date(rec.date));
      const autoOutTime = new Date(`${effectiveDateStr}T18:00:00.000+05:30`);
      rec.checkOut = autoOutTime;
      rec.currentStatus = "OUT";

      if (!rec.punches) rec.punches = [];
      rec.punches.push({
        type: "OUT",
        time: autoOutTime,
        latitude: null,
        longitude: null,
        distanceMeters: null,
        accuracyMeters: null,
        locationVerified: false,
      });

      const { workingHours, dayType } = calculateWorkingHoursFromPunches(rec.punches, rec.checkIn, autoOutTime);
      rec.workingHours = workingHours;
      rec.dayType = dayType;
      rec.verdict = (rec.verdict || "") + " (Auto closed at 6:00 PM shift end)";
      await rec.save();
    }
  } catch (err) {
    console.error("Error locking past unclosed punches:", err);
  }
};

// Helper: Fetch cached holiday dates
export const getCachedHolidayDates = async () => {
  return cache.getOrSet(
    "system:holidays:dates",
    async () => {
      const dbHolidays = await Holiday.find().lean();
      const holidayList = dbHolidays.length > 0 ? dbHolidays : MARKET_HOLIDAYS;
      return new Set(holidayList.map((h) => h.date));
    },
    600 // 10 minutes cache
  );
};

// Helper: Reconcile unexcused absent days safely and idempotently
export const reconcileAbsentDays = async (employeeId, startDate, endDate) => {
  try {
    const employee = await Employee.findById(employeeId);
    if (!employee) return;

    const now = new Date();
    const { minutesFromMidnight } = getISTTime(now);
    const todayISTStr = getISTDateString(now);
    const todayISTMidnight = getISTMidnightDate(now);

    // Lock any unclosed punches from past days
    await lockPastUnclosedPunches(employeeId, todayISTMidnight);

    const isTodayShiftCompleted = minutesFromMidnight >= ATTENDANCE_RULES.SHIFT_END_MINUTES;

    const normStart = getISTMidnightDate(new Date(startDate));
    const normEnd = new Date(getISTMidnightDate(new Date(endDate)).getTime() + 24 * 60 * 60 * 1000 - 1);

    const attendances = await Attendance.find({
      employeeId,
      date: { $gte: normStart, $lte: normEnd },
    });
    const attendanceMap = new Map();
    attendances.forEach((a) => {
      const dStr = getISTDateString(new Date(a.date));
      attendanceMap.set(dStr, a);
    });

    const [leaves, corrections, holidayDates] = await Promise.all([
      LeaveApplication.find({
        employeeId,
        status: { $ne: "REJECTED" },
        startDate: { $lte: normEnd },
        endDate: { $gte: normStart },
      }).lean(),
      AttendanceCorrection.find({
        employeeId,
        status: { $ne: "REJECTED" },
        date: { $gte: normStart, $lte: normEnd },
      }).lean(),
      getCachedHolidayDates(),
    ]);

    let cursor = new Date(normStart);
    const limitDate = new Date(normEnd);

    const joinDate = employee.joinDate ? new Date(employee.joinDate) : null;
    const joinDateStr = joinDate ? getISTDateString(joinDate) : null;

    const isDeactivated = Boolean(employee.isDeleted || employee.employmentStatus === "INACTIVE");
    const deactDate = employee.deactivationDate || (isDeactivated ? employee.updatedAt : null);
    const deactDateStr = deactDate ? getISTDateString(new Date(deactDate)) : null;

    while (cursor <= limitDate) {
      const dStr = getISTDateString(cursor);
      const dayOfWeek = cursor.getDay();
      const isSunday = dayOfWeek === 0;
      const isHoliday = holidayDates.has(dStr);

      const isToday = dStr === todayISTStr;
      const isPastDay = dStr < todayISTStr;
      const isCompleted = isPastDay || (isToday && isTodayShiftCompleted);
      const isAfterJoin = !joinDateStr || dStr >= joinDateStr;
      const isBeforeDeactivation = !isDeactivated || !deactDateStr || dStr < deactDateStr;

      const existingRec = attendanceMap.get(dStr);
      const hasPunches = Boolean(
        existingRec && (existingRec.checkIn || existingRec.checkOut || (existingRec.punches && existingRec.punches.length > 0))
      );

      // Clean unpunched phantom absent records if on or after deactivation date
      if (!isBeforeDeactivation && existingRec && existingRec.status === "ABSENT" && !hasPunches) {
        await Attendance.findByIdAndDelete(existingRec._id);
        attendanceMap.delete(dStr);
      }

      const matchingLeave = leaves.find((l) => {
        const sStr = getISTDateString(new Date(l.startDate));
        const eStr = getISTDateString(new Date(l.endDate));
        return dStr >= sStr && dStr <= eStr;
      });

      const matchingCorrection = corrections.find((c) => {
        const cdStr = getISTDateString(new Date(c.date));
        return dStr === cdStr;
      });

      const hasLeave = Boolean(matchingLeave);
      const hasCorrection = Boolean(matchingCorrection);

      // Clean premature absent records if leave/correction or shift active
      if ((isToday && !isTodayShiftCompleted) || hasLeave || hasCorrection) {
        if (existingRec && existingRec.status === "ABSENT" && !hasPunches) {
          await Attendance.findByIdAndDelete(existingRec._id);
          attendanceMap.delete(dStr);
        } else if (existingRec && existingRec.status === "ABSENT" && hasPunches) {
          if (matchingLeave && matchingLeave.status === "APPROVED") {
            existingRec.status = "PRESENT";
            const isLateBuf = Boolean(existingRec.isLateBuffer || existingRec.wasLate);
            if (isLateBuf) {
              existingRec.isLateBuffer = true;
              existingRec.wasLate = true;
            }
            existingRec.requiresCorrection = false;
            existingRec.verdict = `Regularized via Approved ${
              matchingLeave.type === "SICK" ? "Sick" : "Casual"
            } Leave${isLateBuf ? " (Late Arrival Recorded)" : ""}`;
            if (!existingRec.dayType || existingRec.dayType === "Absent") {
              existingRec.dayType = "Full Day";
            }
            await existingRec.save();
          } else if (matchingLeave && matchingLeave.status === "PENDING") {
            existingRec.requiresCorrection = false;
            existingRec.verdict = `Leave Application Pending (${
              matchingLeave.type === "SICK" ? "Sick" : "Casual"
            } Leave) - Awaiting Approval`;
            await existingRec.save();
          } else if (matchingCorrection && matchingCorrection.status === "PENDING") {
            existingRec.requiresCorrection = false;
            existingRec.verdict = "Attendance Correction Pending - Awaiting Approval";
            await existingRec.save();
          }
        }
      }

      // Only generate absent records for completed workdays before employee deactivation
      if (isCompleted && isAfterJoin && isBeforeDeactivation && !isSunday && !isHoliday) {
        if (!hasPunches && !hasLeave && !hasCorrection) {
          if (!existingRec) {
            try {
              const newAbsent = await Attendance.create({
                employeeId,
                date: getISTMidnightDate(cursor),
                status: "ABSENT",
                requiresCorrection: true,
                verdict:
                  "Marked Absent: Shift and punch window completed with no check-in, leave application, or attendance correction.",
                checkIn: null,
                checkOut: null,
                currentStatus: null,
                punches: [],
                workingHours: 0,
                dayType: "Absent",
              });
              attendanceMap.set(dStr, newAbsent);
            } catch (createErr) {
              if (createErr.code === 11000) {
                const dup = await Attendance.findOne({
                  employeeId,
                  date: getISTMidnightDate(cursor),
                });
                if (dup) attendanceMap.set(dStr, dup);
              } else {
                console.error("Error creating absent record:", createErr);
              }
            }
          } else if (existingRec.status !== "ABSENT" && !hasPunches) {
            existingRec.status = "ABSENT";
            existingRec.requiresCorrection = true;
            existingRec.verdict =
              "Marked Absent: Shift and punch window completed with no check-in, leave application, or attendance correction.";
            await existingRec.save();
          }
        }
      }

      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
  } catch (err) {
    console.error("Error reconciling absent days:", err);
  }
};
