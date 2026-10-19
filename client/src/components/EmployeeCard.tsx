import { PencilIcon, Trash2Icon } from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

export interface EmployeeData {
  id: string;
  _id?: string;
  employeeCode?: string;
  firstName: string;
  lastName: string;
  position?: string;
  department?: string;
  email?: string;
  phone?: string;
  isDeleted?: boolean;
  employmentStatus?: string;
  [key: string]: any;
}

interface EmployeeCardProps {
  employee: EmployeeData;
  onDelete: () => void;
  onEdit: (employee: EmployeeData) => void;
}

const EmployeeCard = ({ employee, onDelete, onEdit }: EmployeeCardProps) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${employee.firstName} ${employee.lastName}?`))
      return;
    try {
      await api.delete(`/employees/${employee.id}`);
      onDelete();
      toast.success("Employee deleted successfully");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to delete employee");
    }
  };

  return (
    <div
      className={`group relative card card-hover overflow-hidden transition-all duration-200 flex flex-col justify-between ${
        employee.isDeleted ? "opacity-65 grayscale bg-slate-100/80 border-slate-300 select-none" : ""
      }`}
    >
      {/* Top Media / Avatar Area */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-50">
        <div className="w-full h-full flex items-center justify-center p-4">
          <div className="w-20 h-20 rounded-full bg-linear-to-br from-indigo-100 to-slate-100 flex items-center justify-center shadow-inner">
            <span className="text-2xl font-semibold text-indigo-500">
              {employee.firstName ? employee.firstName[0] : ""}
              {employee.lastName ? employee.lastName[0].toLowerCase() : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Badges: Department, Location Exempt & Deleted */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap z-10 max-w-[65%]">
        <span className="bg-white/95 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-slate-700 rounded-lg shadow-sm border border-slate-100">
          {employee.department || "Remote"}
        </span>
        {(employee.isLocationExempt || employee.employeeCode === "202602") && (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-bold rounded-md shadow-2xs">
            Location Exempt
          </span>
        )}
        {employee.isDeleted && (
          <span className="bg-rose-600 text-white px-2 py-0.5 text-xs font-bold rounded-md shadow-xs uppercase tracking-wider">
            DELETED
          </span>
        )}
      </div>

      {/* Top-Right Badge: Employee Code */}
      {employee.employeeCode && (
        <div className="absolute top-3 right-3 z-10">
          <span className="bg-white/95 backdrop-blur-sm text-indigo-700 font-mono font-bold text-xs px-2.5 py-1 rounded-lg shadow-sm border border-indigo-100 tracking-wider">
            #{employee.employeeCode}
          </span>
        </div>
      )}

      {/* Bottom Footer: Name, Position & Always-Visible Action Buttons for Super Admin */}
      <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-white border-t border-slate-100">
        <div className="min-w-0 flex-1">
          <h3
            className="text-slate-900 font-semibold text-sm sm:text-base truncate"
            title={`${employee.firstName} ${employee.lastName}`}
          >
            {employee.firstName} {employee.lastName}
          </h3>
          <p className="text-xs text-slate-500 truncate mt-0.5" title={employee.position}>
            {employee.position || "Staff"}
          </p>
        </div>

        {/* Edit & Delete Action Buttons (Always visible for Super Admin on desktop and mobile) */}
        {isAdmin && !employee.isDeleted && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(employee);
              }}
              className="p-2 sm:p-2.5 rounded-xl text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-all shadow-xs active:scale-95 flex items-center justify-center"
              title="Edit Employee"
              aria-label={`Edit ${employee.firstName}`}
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-2 sm:p-2.5 rounded-xl text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all shadow-xs active:scale-95 flex items-center justify-center"
              title="Delete Employee"
              aria-label={`Delete ${employee.firstName}`}
            >
              <Trash2Icon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeCard;