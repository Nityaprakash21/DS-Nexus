import { format } from "date-fns"
import { Check, Edit2, Loader2, X } from "lucide-react"
import { useState } from "react"
import api from "../../api/axios"
import toast from "react-hot-toast"
import EditLeaveModal from "./EditLeaveModal"

interface LeaveItem {
    _id?: string;
    id?: string;
    type: string;
    startDate: string | Date;
    endDate: string | Date;
    reason: string;
    status: string;
    days?: number;
    employee?: {
        firstName?: string;
        lastName?: string;
        employeeCode?: string;
        isDeleted?: boolean;
    };
}

interface LeaveHistoryProps {
    leaves: LeaveItem[];
    isAdmin: boolean;
    canApprove?: boolean;
    onUpdate: () => void;
}

const LeaveHistory = ({ leaves, isAdmin, canApprove = false, onUpdate }: LeaveHistoryProps) => {

    const [processing, setProcessing] = useState<string | null>(null);
    const [editingLeave, setEditingLeave] = useState<LeaveItem | null>(null);
    const showApprovalActions = isAdmin || canApprove;

    const handleStatusUpdate = async (id: string, status: string) => {
        setProcessing(id)
        try {
            await api.patch(`/leave/${id}`, { status })
            onUpdate();
            toast.success(`Leave application ${status.toLowerCase()} successfully!`);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || "Failed to update leave status");
        } finally {
            setProcessing(null);
        }
    }

    return (
        <div className="card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="table-modern">
                    <thead>
                        <tr>
                            {showApprovalActions && <th>Employee</th>}
                            <th>Type</th>
                            <th>Dates</th>
                            <th>Duration</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th className="text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaves.length === 0 ? (
                            <tr>
                                <td colSpan={showApprovalActions ? 7 : 6} className="text-center py-12 text-slate-400">
                                    No leave applications found
                                </td>
                            </tr>
                        ) : (
                            leaves.map((leave) => {
                                const durationDays = leave.days || (
                                    Math.round(Math.max(0, new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
                                );
                                return (
                                    <tr key={leave._id || leave.id}>
                                        {showApprovalActions && (
                                             <td className="text-slate-900">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {leave.employee?.employeeCode && (
                                                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded shrink-0">
                                                            #{leave.employee.employeeCode}
                                                        </span>
                                                    )}
                                                    <span className="font-semibold truncate">
                                                        {leave.employee?.firstName} {leave.employee?.lastName}
                                                    </span>
                                                    {leave.employee?.isDeleted && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300 shrink-0">
                                                            Deactivated
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        <td>
                                            <span className="badge bg-slate-100 text-slate-600 font-semibold">{leave.type}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {format(new Date(leave.startDate), 'MMM dd, yyyy')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono">
                                                {durationDays} day{durationDays > 1 ? 's' : ''}
                                            </span>
                                        </td>
                                        <td className="max-w-xs truncate text-slate-500" title={leave.reason}>
                                            {leave.reason}
                                        </td>
                                        <td>
                                            <span className={`badge ${leave.status === "APPROVED" ? "badge-success" : leave.status === "REJECTED" ? "badge-danger" : "badge-warning"}`}>
                                                {leave.status}
                                            </span>
                                        </td>
                                        <td className="text-center">
                                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingLeave(leave)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/80 transition-colors shadow-2xs cursor-pointer"
                                                    title="Rectify / Edit Leave Application"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                    <span>Edit</span>
                                                </button>

                                                {showApprovalActions && leave.status === "PENDING" && (
                                                    <>
                                                        <button
                                                            onClick={() => handleStatusUpdate((leave._id || leave.id)!, "APPROVED")}
                                                            disabled={!!processing}
                                                            title="Approve Leave"
                                                            className="p-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                                                        >
                                                            {processing === (leave._id || leave.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusUpdate((leave._id || leave.id)!, "REJECTED")}
                                                            disabled={!!processing}
                                                            title="Reject Leave"
                                                            className="p-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                                                        >
                                                            {processing === (leave._id || leave.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </>
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

            <EditLeaveModal
                open={!!editingLeave}
                leave={editingLeave}
                onClose={() => setEditingLeave(null)}
                onSuccess={() => {
                    setEditingLeave(null);
                    onUpdate();
                }}
            />
        </div>
    )
}

export default LeaveHistory