// Centralized Attendance & Shift Rules Configuration
// All shift timing, buffer allowances, and geo-fencing standards reside here

export const ATTENDANCE_RULES = {
  // Official Shift Timing (in minutes from midnight IST)
  // 10:00 AM = 10 * 60 = 600
  SHIFT_START_MINUTES: 600,

  // Grace Period: 10:00 AM - 10:15 AM (615 minutes)
  // Clocking in within this window is marked PRESENT with no penalty
  GRACE_PERIOD_END_MINUTES: 615,

  // Late Arrival Buffer: 10:15 AM - 10:30 AM (630 minutes)
  // Allowed up to 5 times per calendar month
  LATE_BUFFER_CUTOFF_MINUTES: 630,

  // Official Shift Completion Time: 6:00 PM (18:00 = 1080 minutes)
  // Working days are only marked absent after this time
  SHIFT_END_MINUTES: 1080,

  // Allowed late arrivals per employee per month
  MAX_MONTHLY_LATE_BUFFER: 5,

  // Allowed attendance corrections per employee per month
  MAX_MONTHLY_CORRECTIONS: 10,

  // Default Office Geolocation Coordinates (Rourkela Office)
  DEFAULT_OFFICE_LATITUDE: 22.257667,
  DEFAULT_OFFICE_LONGITUDE: 84.885863,

  // Allowed Punch-in Radius in meters (Corporate office premises boundary: 80 meters)
  DEFAULT_OFFICE_RADIUS_METERS: 80,

  // Maximum GPS accuracy buffer in meters (accommodates indoor Wi-Fi/cellular triangulation up to 80m)
  GPS_ACCURACY_BUFFER_MAX_METERS: 80,

  // Minimum session duration between clock-in and clock-out to avoid accidental double-clicks (2 minutes)
  MIN_SESSION_DURATION_MS: 2 * 60 * 1000,

  // Rapid punch debounce buffer (5 seconds)
  RAPID_PUNCH_DEBOUNCE_MS: 5000,

  // Full day vs Half day minimum hours threshold
  FULL_DAY_MIN_HOURS: 6.0,
};
