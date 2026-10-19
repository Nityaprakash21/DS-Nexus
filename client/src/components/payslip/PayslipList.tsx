import { useState } from "react";
import { format } from "date-fns";
import { Download, Printer, Trash2, Loader2, X } from "lucide-react";
import api from "../../api/axios";
import toast from "react-hot-toast";

interface PayslipListProps {
    payslips: any[];
    isAdmin?: boolean;
    onDeleteSuccess?: () => void;
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const PayslipList = ({ payslips, isAdmin, onDeleteSuccess }: PayslipListProps) => {
    const [targetPayslip, setTargetPayslip] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteConfirm = async () => {
        if (!targetPayslip) return;
        const id = targetPayslip._id || targetPayslip.id;
        try {
            setIsDeleting(true);
            await api.delete(`/payslips/${id}`);
            toast.success("Payslip deleted successfully");
            setTargetPayslip(null);
            if (onDeleteSuccess) {
                onDeleteSuccess();
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.error || "Failed to delete payslip");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table-modern">
                        <thead>
                            <tr>
                                {isAdmin && <th>Employee</th>}
                                <th>Period</th>
                                <th>Basic Salary</th>
                                <th>Total Earnings</th>
                                <th>Total Deductions</th>
                                <th>Net Salary</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payslips.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-400">
                                        No payslips found
                                    </td>
                                </tr>
                            ) : (
                                payslips.map((payslip: any) => {
                                    const id = payslip._id || payslip.id;
                                    const period = payslip.monthName 
                                        ? `${payslip.monthName} ${payslip.year}`
                                        : (payslip.month ? `${MONTH_NAMES[payslip.month - 1]} ${payslip.year}` : format(new Date(payslip.year, (payslip.month || 1) - 1), "MMMM yyyy"));
                                    
                                    const totalEarn = payslip.earnings?.total ?? ((payslip.basicSalary || 0) + (payslip.allowances || 0));
                                    const totalDed = payslip.deductionsDetail?.total ?? (payslip.deductions || 0);

                                    return (
                                        <tr key={id}>
                                            {isAdmin && (
                                                <td className="text-slate-900 font-medium">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span>
                                                            {payslip.employee?.firstName} {payslip.employee?.lastName}
                                                        </span>
                                                        {payslip.employee?.isDeleted && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300 shrink-0">
                                                                Deactivated
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                            <td className="text-slate-700 font-semibold">
                                                {period}
                                            </td>
                                            <td className="text-slate-500">
                                                ₹{payslip.basicSalary?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-emerald-700 font-medium">
                                                ₹{totalEarn?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-rose-600 font-medium">
                                                ₹{totalDed?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="font-bold text-slate-900">
                                                ₹{payslip.netSalary?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-center">
                                                <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 min-w-0">
                                                    {/* Download PDF Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => window.open(`${import.meta.env.BASE_URL}print/payslips/${id}?download=1`)}
                                                        className="inline-flex items-center justify-center w-full sm:w-auto px-2.5 py-1 text-xs font-semibold rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors border border-indigo-200 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                                                        title="Download Payslip as PDF"
                                                    >
                                                        <Download className="w-3 h-3 mr-1 text-indigo-600 shrink-0" />
                                                        Download PDF
                                                    </button>

                                                    {/* Print PDF / Preview Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => window.open(`${import.meta.env.BASE_URL}print/payslips/${id}`)}
                                                        className="inline-flex items-center justify-center w-full sm:w-auto px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                                                        title="Print or View Statement"
                                                    >
                                                        <Printer className="w-3 h-3 mr-1 text-slate-500 shrink-0" />
                                                        Print
                                                    </button>

                                                    {/* Delete Button (Super Admin Only) */}
                                                    {isAdmin && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setTargetPayslip(payslip)}
                                                            className="inline-flex items-center justify-center w-full sm:w-auto px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                                                            title="Delete Payslip (Super Admin only)"
                                                        >
                                                            <Trash2 className="w-3 h-3 mr-1 text-rose-600 shrink-0" />
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Super Admin Delete Confirmation Modal */}
            {targetPayslip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-scale-up space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Delete Payslip</h3>
                                    <p className="text-xs text-slate-500">Super Admin authorization required</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => !isDeleting && setTargetPayslip(null)}
                                disabled={isDeleting}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            Are you sure you want to permanently delete the payslip for{" "}
                            <span className="font-bold text-slate-900">
                                {targetPayslip.employee?.firstName} {targetPayslip.employee?.lastName}
                            </span>{" "}
                            for period{" "}
                            <span className="font-bold text-slate-900">
                                {targetPayslip.monthName 
                                    ? `${targetPayslip.monthName} ${targetPayslip.year}`
                                    : (targetPayslip.month ? `${MONTH_NAMES[targetPayslip.month - 1]} ${targetPayslip.year}` : format(new Date(targetPayslip.year, (targetPayslip.month || 1) - 1), "MMMM yyyy"))}
                            </span>
                            ? This record will be permanently deleted from payroll history.
                        </p>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center font-medium">
                            <span className="text-slate-500">Net Salary:</span>
                            <span className="font-bold text-slate-900">
                                ₹{targetPayslip.netSalary?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        <div className="flex items-center gap-2.5 pt-2">
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => setTargetPayslip(null)}
                                className="btn-secondary w-full py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={handleDeleteConfirm}
                                className="w-full py-2 text-xs font-semibold rounded-xl text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Confirm Delete
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

export default PayslipList;