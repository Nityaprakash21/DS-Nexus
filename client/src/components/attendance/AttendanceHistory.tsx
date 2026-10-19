// @ts-ignore
import { getDayTypeDisplay, getWorkingHoursDisplay } from "../../assets/assets"
import { format } from "date-fns"
import { AlertTriangle, Clock } from "lucide-react"

interface AttendanceHistoryProps {
    history: any[];
    onOpenCorrection?: (dateStr: string) => void;
    onOpenLeave?: (dateStr: string) => void;
}

const AttendanceHistory = ({ history = [], onOpenCorrection, onOpenLeave }: AttendanceHistoryProps) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
        <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-slate-900">Recent Attendance Activity</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Daily punch logs, shift duration, and attendance verdicts</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    {history.length} Record{history.length !== 1 ? "s" : ""}
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="table-modern w-full min-w-[900px]">
                    <thead>
                        <tr>
                            <th className="px-6 py-4 whitespace-nowrap">Date</th>
                            <th className="px-6 py-4 whitespace-nowrap">First In</th>
                            <th className="px-6 py-4 whitespace-nowrap">Last Out</th>
                            <th className="px-6 py-4 whitespace-nowrap">Working Hours</th>
                            <th className="px-6 py-4 whitespace-nowrap">Day Type</th>
                            <th className="px-6 py-4 whitespace-nowrap">Status & Official Verdict</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-12 text-slate-400">
                                    No records found
                                </td>
                            </tr>
                        ) : (
                            history.map((record: any) => {
                                const dayType = getDayTypeDisplay(record)
                                const isAbsent = record.status === "ABSENT" || record.requiresCorrection

                                const recordDate = new Date(record.date);
                                recordDate.setHours(0, 0, 0, 0);
                                const isPastDay = recordDate.getTime() < today.getTime();
                                const hasValidOut = Boolean(
                                    (record.checkOut && record.currentStatus !== "IN" && (!record.punches?.length || record.punches[record.punches.length - 1]?.type !== "IN")) ||
                                    (record.punches && record.punches.length > 0 && record.punches[record.punches.length - 1].type === "OUT") ||
                                    (record.status === "PRESENT" && typeof record.workingHours === "number" && record.workingHours > 0)
                                );
                                const isMissingPunch = Boolean(
                                    isPastDay &&
                                    (record.checkIn || (record.punches && record.punches.length > 0)) &&
                                    !hasValidOut
                                );

                                const firstInTime = (record.punches && record.punches.length > 0)
                                    ? (record.punches.find((p: any) => p.type === "IN")?.time || record.checkIn)
                                    : record.checkIn;

                                const checkInDate = firstInTime ? new Date(firstInTime) : null;
                                const istMinutes = checkInDate && !isNaN(checkInDate.getTime())
                                    ? ((checkInDate.getUTCHours() * 60 + checkInDate.getUTCMinutes() + 330) % 1440)
                                    : null;
                                const isOnTime = Boolean(
                                    (record.verdict && /on time/i.test(record.verdict)) ||
                                    (istMinutes !== null && istMinutes <= 615)
                                );
                                const isLateBufferWindow = Boolean(istMinutes !== null && istMinutes > 615 && istMinutes <= 630);
                                const isLate = !isOnTime && (
                                    record.status === "LATE" ||
                                    Boolean(record.isLateBuffer) ||
                                    isLateBufferWindow ||
                                    (Boolean(record.wasLate) && !/after 10:30/i.test(record.verdict || "")) ||
                                    (/late arrival|late buffer/i.test(record.verdict || "") && !/after 10:30/i.test(record.verdict || ""))
                                );

                                const lastOutTime = (record.punches && record.punches.length > 0)
                                    ? (() => {
                                        for (let i = record.punches.length - 1; i >= 0; i--) {
                                            if (record.punches[i].type === "OUT") return record.punches[i].time;
                                        }
                                        return record.checkOut;
                                    })()
                                    : record.checkOut;

                                const sessionCount = record.punches && record.punches.length > 2
                                    ? Math.floor(record.punches.length / 2)
                                    : 0;

                                return (
                                    <tr
                                        key={record._id || record.id}
                                        className={
                                            isMissingPunch
                                                ? "bg-amber-50/50 hover:bg-amber-100/40 transition-colors"
                                                : isLate
                                                ? "bg-amber-50/40 hover:bg-amber-100/30 transition-colors"
                                                : "hover:bg-slate-50/60 transition-colors"
                                        }
                                    >
                                        <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                                            <span className="whitespace-nowrap inline-block">{format(new Date(record.date), 'MMM dd, yyyy')}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-semibold whitespace-nowrap font-mono">
                                            <span className="whitespace-nowrap inline-block">{firstInTime ? format(new Date(firstInTime), 'hh:mm a') : "-"}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-semibold whitespace-nowrap font-mono">
                                            {lastOutTime ? (
                                                <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                                    <span className="whitespace-nowrap">{format(new Date(lastOutTime), 'hh:mm a')}</span>
                                                    {sessionCount > 1 && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-sans whitespace-nowrap shrink-0">
                                                            {sessionCount} sessions
                                                        </span>
                                                    )}
                                                </div>
                                            ) : isMissingPunch ? (
                                                <span className="inline-flex items-center gap-1 text-amber-800 font-bold text-xs bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300 whitespace-nowrap shrink-0">
                                                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                                    Missing (Locked)
                                                </span>
                                            ) : record.checkIn ? (
                                                <span className="text-emerald-600 font-medium text-xs whitespace-nowrap">Active</span>
                                            ) : "-"}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap font-mono">
                                            {isMissingPunch && !record.workingHours ? (
                                                <span className="text-amber-700 font-semibold text-xs whitespace-nowrap">Incomplete</span>
                                            ) : (
                                                <span className="whitespace-nowrap inline-block">{getWorkingHoursDisplay(record)}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {dayType.label !== "-" ? <span className={`badge whitespace-nowrap ${dayType.className}`}>{dayType.label}</span> : "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {isMissingPunch ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-400 shadow-2xs">
                                                            <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                                                            Missing Punch
                                                        </span>
                                                    ) : record.status === "PRESENT" && isLate ? (
                                                        <span className="badge badge-warning font-bold inline-flex items-center gap-1" title="Late arrival recorded, marked present">
                                                            <Clock className="w-3 h-3 text-amber-700" />
                                                            LATE (PRESENT)
                                                        </span>
                                                    ) : (
                                                        <span className={`badge ${record.status === "PRESENT" ? "badge-success" : isLate ? "badge-warning" : "badge-danger"}`}>
                                                            {record.status}
                                                        </span>
                                                    )}
                                                    {record.requiresCorrection && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                                            Correction Needed (LWP)
                                                        </span>
                                                    )}
                                                </div>
                                                {record.verdict && (
                                                    <p className={`text-[11px] leading-tight ${isAbsent ? "text-rose-600 font-medium" : isLate ? "text-amber-700 font-medium" : "text-slate-500"}`}>
                                                        {record.verdict}
                                                    </p>
                                                )}
                                                {record.requiresCorrection && (onOpenCorrection || onOpenLeave) && (
                                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                        {isPastDay ? (
                                                            onOpenCorrection && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const d = new Date(record.date);
                                                                        const y = d.getFullYear();
                                                                        const m = String(d.getMonth() + 1).padStart(2, "0");
                                                                        const day = String(d.getDate()).padStart(2, "0");
                                                                        onOpenCorrection(`${y}-${m}-${day}`);
                                                                    }}
                                                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-colors cursor-pointer"
                                                                >
                                                                    Apply Correction
                                                                </button>
                                                            )
                                                        ) : (
                                                            <span
                                                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200"
                                                                title="Attendance correction for today can only be applied from tomorrow once shift concludes"
                                                            >
                                                                Correction Opens Tomorrow
                                                            </span>
                                                        )}
                                                        {onOpenLeave && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const d = new Date(record.date);
                                                                    const y = d.getFullYear();
                                                                    const m = String(d.getMonth() + 1).padStart(2, "0");
                                                                    const day = String(d.getDate()).padStart(2, "0");
                                                                    onOpenLeave(`${y}-${m}-${day}`);
                                                                }}
                                                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer"
                                                            >
                                                                Apply Leave (Sick/Casual)
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div >
    )
}
export default AttendanceHistory