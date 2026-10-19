import { useState, useEffect } from "react";
import {
  Loader2,
  LogIn,
  LogOut,
  Clock,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  MapPin,
  Navigation,
  AlertCircle,
  RefreshCw,
  CalendarDays,
} from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

interface PunchItem {
  type: "IN" | "OUT";
  time: string | Date;
}

interface LateAllowanceInfo {
  used: number;
  max: number;
  remaining: number;
  monthName?: string;
}

interface TodayRecord {
  _id?: string;
  checkIn?: string | Date;
  checkOut?: string | Date | null;
  currentStatus?: "IN" | "OUT";
  punches?: PunchItem[];
  status?: "PRESENT" | "LATE" | "ABSENT";
  isLateBuffer?: boolean;
  lateCountThisMonth?: number;
  verdict?: string | null;
  requiresCorrection?: boolean;
  workingHours?: number | null;
  dayType?: string | null;
}

interface CheckInButtonProps {
  todayRecord?: TodayRecord | null;
  lateAllowance?: LateAllowanceInfo | null;
  isLocationExempt?: boolean;
  onAction: () => void;
  onOpenCorrection?: (date?: string) => void;
  onOpenLeave?: (date?: string) => void;
}

const CheckInButton = ({
  todayRecord,
  lateAllowance,
  isLocationExempt = false,
  onAction,
  onOpenLeave
}: CheckInButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Location geofencing state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showOutOfRangeModal, setShowOutOfRangeModal] = useState(false);
  const [outOfRangeData, setOutOfRangeData] = useState<{ distance: number; allowedRadius: number } | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationErrorMsg, setLocationErrorMsg] = useState<string | null>(null);

  // Keep live time ticking every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine current status:
  // "IN" = actively working
  // "OUT" = currently punched out (on break or ended previous session)
  // "NOT_STARTED" = hasn't clocked in yet today
  const currentStatus: "IN" | "OUT" | "NOT_STARTED" = todayRecord?.currentStatus
    ? todayRecord.currentStatus
    : todayRecord?.checkIn && !todayRecord?.checkOut
    ? "IN"
    : todayRecord?.checkIn && todayRecord?.checkOut
    ? "OUT"
    : "NOT_STARTED";

  const isClockedIn = currentStatus === "IN";
  const hasPunchedToday = !!todayRecord?.checkIn;
  const isCurrentTimeAfterShift = new Date().getHours() >= 18;
  const isAbsentToday = (todayRecord?.status === "ABSENT" || todayRecord?.requiresCorrection) && (hasPunchedToday || isCurrentTimeAfterShift);

  // Punch count
  const punchesCount = todayRecord?.punches?.length ?? (todayRecord?.checkOut ? 2 : todayRecord?.checkIn ? 1 : 0);

  const formatTime = (dateInput?: string | Date | null) => {
    if (!dateInput) return "—";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatWorkingHours = (hours?: number | null) => {
    if (hours == null || hours < 0 || hours > 24) return "—";
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    if (hrs === 0 && mins === 0) return "0 hrs";
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const getDeviceCoordinates = (): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("Geolocation is not supported by your browser or device."));
      }

      let bestPos: GeolocationPosition | null = null;
      let watchId: number | null = null;
      let timer: any = null;
      let isSettled = false;

      const finish = (pos: GeolocationPosition | null, err?: Error) => {
        if (isSettled) return;
        isSettled = true;

        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }

        if (pos) {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        } else {
          reject(err || new Error("Location access failed. Please ensure GPS is enabled."));
        }
      };

      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            // Track the most accurate position update received
            if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
              bestPos = pos;
            }
            // If phone GNSS acquires high precision (<= 25m), resolve immediately
            if (pos.coords.accuracy <= 25) {
              finish(pos);
            }
          },
          (err) => {
            if (bestPos) {
              finish(bestPos);
            } else {
              let msg = "Location access failed.";
              if (err.code === err.PERMISSION_DENIED) {
                msg = "Location permission was denied. Please allow location access in your browser to verify office presence.";
              } else if (err.code === err.POSITION_UNAVAILABLE) {
                msg = "GPS location is currently unavailable. Please turn on device location/GPS and try again.";
              } else if (err.code === err.TIMEOUT) {
                msg = "Location request timed out. Please ensure device GPS is turned on and try again.";
              }
              finish(null, new Error(msg));
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 0,
          }
        );

        // Give phone GNSS receiver up to 3 seconds to warm up and lock onto satellites
        timer = setTimeout(() => {
          if (bestPos) {
            finish(bestPos);
          } else {
            // One-shot fallback if watchPosition did not emit
            navigator.geolocation.getCurrentPosition(
              (p) => finish(p),
              (e) => finish(null, new Error(e.message || "Unable to acquire GPS fix.")),
              { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
            );
          }
        }, 3000);
      } catch (_) {
        navigator.geolocation.getCurrentPosition(
          (p) =>
            resolve({
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
              accuracy: p.coords.accuracy,
            }),
          (err) => reject(new Error(err.message || "Location access failed")),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    });
  };

  const performAttendance = async (action: "CLOCK_IN" | "CLOCK_OUT") => {
    if (loading || cooldown || detectingLocation) return;

    const payload: Record<string, any> = { action };
    if (todayRecord?._id) {
      payload.attendanceId = todayRecord._id;
    }

    // Enforce GPS location capture for CLOCK_IN (unless employee is location-exempt)
    if (action === "CLOCK_IN" && !isLocationExempt) {
      setDetectingLocation(true);
      setLocationErrorMsg(null);
      try {
        const coords = await getDeviceCoordinates();
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
        payload.accuracy = coords.accuracy;
      } catch (locErr: any) {
        setDetectingLocation(false);
        setLocationErrorMsg(locErr.message || "Location access is needed to clock in.");
        setShowLocationModal(true);
        return;
      } finally {
        setDetectingLocation(false);
      }
    } else {
      // Optional GPS capture for CLOCK_OUT or location-exempt employee (silently captures if available)
      try {
        const coords = await getDeviceCoordinates();
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
        payload.accuracy = coords.accuracy;
      } catch (_) {
        // Silently allow punch if GPS unavailable or denied
      }
    }

    setLoading(true);
    try {
      const res = await api.post("/attendance", payload);
      const message = res.data?.message || (action === "CLOCK_OUT" ? "Clocked out successfully!" : "Clocked in successfully!");
      toast.success(message);
      setShowConfirmModal(false);
      setShowLocationModal(false);
      setShowOutOfRangeModal(false);
      await onAction();
      setCooldown(true);
      setTimeout(() => setCooldown(false), 3000);
    } catch (error: any) {
      const errData = error?.response?.data;
      if (errData?.code === "LOCATION_REQUIRED") {
        setLocationErrorMsg(errData.error || "Location is needed to clock in.");
        setShowLocationModal(true);
      } else if (errData?.code === "OUT_OF_OFFICE_RANGE") {
        setOutOfRangeData({
          distance: errData.distance,
          allowedRadius: errData.allowedRadius || 80,
        });
        setShowOutOfRangeModal(true);
      } else {
        toast.error(errData?.error || error?.message || "Operation failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = () => {
    if (loading || cooldown) return;
    if (isClockedIn) {
      // Require explicit confirmation before clocking out to eliminate accidental touch/double-click clock-outs
      setShowConfirmModal(true);
    } else {
      performAttendance("CLOCK_IN");
    }
  };

  return (
    <>
      {/* Critical Attendance Verdict Alert: Absent / Correction Required */}
      {isAbsentToday && (
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-2xs">
                  Today Marked Absent
                </span>
                <span className="text-xs font-semibold text-rose-700">
                  Correction Opens Tomorrow
                </span>
              </div>
              <p className="text-xs text-slate-700 font-medium mt-1">
                {todayRecord?.verdict || "You clocked in after 10:30 AM or exceeded your 5 monthly late allowances."}{" "}
                <span className="text-rose-600 font-semibold block sm:inline mt-0.5 sm:mt-0">
                  Per company policy, attendance correction for today can only be applied from tomorrow (the next day) once the shift concludes.
                </span>
              </p>
            </div>
          </div>

          <div className="self-start sm:self-auto shrink-0 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-rose-100/90 border border-rose-200 text-rose-800 shadow-2xs">
            <Clock className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Correction Available Tomorrow</span>
          </div>
        </div>
      )}

      {/* Top Status & Attendance Metrics Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md">
        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left Info: Live Clock & Status Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                isAbsentToday
                  ? "bg-rose-50 text-rose-600 border border-rose-200"
                  : isClockedIn
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : hasPunchedToday
                  ? "bg-amber-50 text-amber-600 border border-amber-200"
                  : "bg-indigo-50 text-indigo-600 border border-indigo-200"
              }`}
            >
              <Clock className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                  {currentTime.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>

                {/* Status Badge with Glowing Dot */}
                {isClockedIn ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    Currently Clocked In
                  </span>
                ) : hasPunchedToday ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    Clocked Out (Break / Paused)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                    Not Checked In Today
                  </span>
                )}

                {/* Monthly Late Quota Tracker Pill */}
                {lateAllowance && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                      lateAllowance.used >= 5
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : lateAllowance.used >= 3
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                    title="10:15 AM – 10:30 AM late buffer allowed only 5 times per month"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    Late Buffer: {lateAllowance.used} / {lateAllowance.max} used this month
                  </span>
                )}

                {/* Office GPS Geofence or Location Exempt Pill */}
                {isLocationExempt ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
                    title="Location-independent clock-in enabled (Office geofence bypassed)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Location Exempt
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                    title="Office GPS Location: 22.257667° N, 84.885863° E (5m Perimeter Enforced)"
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    Office Geofence (5m)
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <span>{currentTime.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</span>
                <span>•</span>
                <span className="text-slate-600 font-medium">
                  {punchesCount > 0 ? `${punchesCount} punch${punchesCount > 1 ? "es" : ""} recorded today` : "No punches logged yet"}
                </span>
                {todayRecord?.verdict && (
                  <>
                    <span>•</span>
                    <span className={`font-semibold ${isAbsentToday ? "text-rose-600" : "text-slate-700"}`}>
                      {todayRecord.verdict}
                    </span>
                  </>
                )}
              </p>

              {isAbsentToday && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-800 shadow-2xs"
                    title="Per company policy, attendance correction for today can only be applied from tomorrow (the next day) once the shift concludes."
                  >
                    <Clock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Correction Opens Tomorrow</span>
                  </div>
                  {onOpenLeave && (
                    <button
                      type="button"
                      onClick={() => onOpenLeave(new Date().toISOString().split("T")[0])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all cursor-pointer"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>Apply Leave (Sick / Casual)</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Stats: First In, Last Out & Final Work Duration */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-[125px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">First In (Official)</span>
              <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                {formatTime(todayRecord?.checkIn)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-[125px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Last Out (Official)</span>
              <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                {formatTime(todayRecord?.checkOut)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 col-span-2 sm:col-span-1 min-w-[125px]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Final Work Duration</span>
              <span className="text-sm font-bold text-indigo-600 mt-0.5 block">
                {todayRecord?.workingHours != null && todayRecord.workingHours >= 0 && todayRecord.workingHours <= 24
                  ? formatWorkingHours(todayRecord.workingHours)
                  : isClockedIn
                  ? "Tracking..."
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Policy Note Footer */}
        <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-start sm:items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-[11px] leading-relaxed text-slate-600">
              <strong>Official Hours:</strong> 10:00 AM – 6:00 PM • <strong>Grace Period:</strong> 10:00 – 10:15 AM (Allowed) • <strong>Late Buffer:</strong> 10:15 – 10:30 AM (Max 5/mo) • <strong>After 10:30 AM:</strong> Marked Absent (Apply for correction or Leave Without Pay).
            </span>
          </div>
        </div>
      </div>

      {/* Fixed Bottom-Right Clock In / Clock Out Floating Button */}
      <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-30">
        <button
          onClick={handleButtonClick}
          disabled={loading || cooldown || detectingLocation}
          className={`px-5 py-3.5 sm:px-6 sm:py-4 rounded-2xl text-white font-bold text-sm shadow-xl transition-all duration-200 flex items-center gap-3.5 cursor-pointer active:scale-95 group ${
            loading || cooldown || detectingLocation
              ? "bg-slate-500 cursor-not-allowed opacity-80"
              : isClockedIn
              ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
              : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30"
          }`}
        >
          {detectingLocation ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Verifying GPS...</span>
            </>
          ) : loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Recording...</span>
            </>
          ) : cooldown ? (
            <>
              <Clock className="w-5 h-5 animate-pulse text-slate-200" />
              <span>Updated</span>
            </>
          ) : isClockedIn ? (
            <>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:rotate-12 transition-transform">
                <LogOut className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-extrabold leading-tight">Clock Out</span>
                <span className="text-[10px] font-medium text-rose-100/90 block">Click to confirm exit</span>
              </div>
            </>
          ) : hasPunchedToday ? (
            <>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:-rotate-12 transition-transform">
                <LogIn className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-extrabold leading-tight">Clock In Again</span>
                <span className="text-[10px] font-medium text-indigo-100/90 block">Resume Session</span>
              </div>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:-rotate-12 transition-transform">
                <LogIn className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-extrabold leading-tight">Clock In</span>
                <span className="text-[10px] font-medium text-indigo-100/90 block">Office GPS Verified</span>
              </div>
            </>
          )}
        </button>
      </div>

      {/* Clock Out Confirmation Modal: 100% Prevents Accidental Touch / Double-Click Clock-Outs */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
              <LogOut className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">Confirm Clock-Out</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Are you sure you want to end your active session and record your clock-out for today?
            </p>

            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-500">First In Recorded:</span>
                <span className="font-bold text-slate-800 font-mono">{formatTime(todayRecord?.checkIn)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-slate-500">Punches Logged:</span>
                <span className="font-bold text-indigo-600 font-mono">{punchesCount}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                <span className="font-semibold text-slate-700">Current Clock-Out Time:</span>
                <span className="font-extrabold text-slate-900 font-mono text-xs sm:text-sm">
                  {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Keep Working
              </button>
              <button
                type="button"
                onClick={() => performAttendance("CLOCK_OUT")}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                <span>{loading ? "Recording..." : "Yes, Clock Out"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Permission Required Error Modal */}
      {showLocationModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowLocationModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 shadow-2xs">
              <MapPin className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">Location Access Needed</h3>
            <p className="text-xs text-slate-500 mt-1">
              To clock in, DS-Nexus must verify that you are physically present at the office premises.
            </p>

            {locationErrorMsg && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200/90 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{locationErrorMsg}</p>
              </div>
            )}

            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-2">
              <span className="font-bold text-slate-800 block">How to enable location:</span>
              <ol className="list-decimal list-inside space-y-1 text-slate-600">
                <li>Turn ON Location/GPS on your device.</li>
                <li>When prompted by your browser, tap <strong>Allow</strong>.</li>
                <li>If blocked, tap the lock/settings icon near the website URL to reset permission.</li>
              </ol>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLocationModal(false);
                  performAttendance("CLOCK_IN");
                }}
                disabled={detectingLocation || loading}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2"
              >
                {detectingLocation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Detecting Location...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Turn On & Try Again</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Out of Office Perimeter Error Modal */}
      {showOutOfRangeModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowOutOfRangeModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-200 shadow-2xs">
              <Navigation className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">Out of Office Perimeter</h3>
            <p className="text-xs text-slate-500 mt-1">
              Your punch-in was rejected because your GPS coordinates were detected outside the authorized office boundary.
            </p>

            {outOfRangeData && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Your Current Distance:</span>
                  <span className="font-extrabold text-rose-600 text-sm font-mono">
                    {outOfRangeData.distance} meters away
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500">Allowed Office Radius:</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    Within {outOfRangeData.allowedRadius} meters
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Office Geofence: 22.257667° N, 84.885863° E</span>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-600 mt-3 bg-amber-50 p-3 rounded-xl border border-amber-200/70 leading-relaxed">
              Please ensure you are physically inside the office premises. If you are already at your desk, step closer to a window or open area to enhance satellite accuracy, then tap Retry.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowOutOfRangeModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOutOfRangeModal(false);
                  performAttendance("CLOCK_IN");
                }}
                disabled={detectingLocation || loading}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2"
              >
                {detectingLocation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying GPS...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry Location</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CheckInButton;