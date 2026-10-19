import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, User, KeyRound, FileBadge } from "lucide-react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { useDepartments } from "../hooks/useDepartments";

interface EmployeeFormProps {
  initialData?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const EmployeeForm = ({ initialData, onSuccess, onCancel }: EmployeeFormProps) => {
  const navigate = useNavigate();
  const { departmentNames } = useDepartments();
  const [loading, setLoading] = useState(false);
  const isEditMode = !!initialData;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    if (isEditMode) {
      const pwd = formData.get("password");
      if (!pwd) formData.delete("password");
    }
    try {
      const url = isEditMode ? `/employees/${initialData.id}` : "/employees";
      const method = isEditMode ? "put" : "post";
      await api[method](url, formData);
      onSuccess ? onSuccess() : navigate("/employees");
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 w-full animate-fade-in text-xs">
      {/* 2-Column Responsive Layout for 1-Page Non-Scrolling View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
        
        {/* LEFT COLUMN: Personal Information */}
        <div className="bg-slate-50/60 rounded-xl border border-slate-200/80 p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-indigo-100 text-indigo-700">
                <User className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Personal Information</h3>
            </div>
            {isEditMode && initialData?.employeeCode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[11px] font-bold">
                <span className="text-indigo-400 font-sans font-normal text-[10px]">Code:</span> #{initialData.employeeCode}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block mb-1 font-semibold text-slate-700">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                name="firstName"
                required
                defaultValue={initialData?.firstName}
                className="py-1.5 px-3 text-xs"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold text-slate-700">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                name="lastName"
                required
                defaultValue={initialData?.lastName}
                className="py-1.5 px-3 text-xs"
                placeholder="Last name"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-slate-700">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                name="phone"
                required
                defaultValue={initialData?.phone}
                className="py-1.5 px-3 text-xs"
                placeholder="Phone number"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold text-slate-700">
                Join Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="joinDate"
                required
                defaultValue={initialData?.joinDate ? new Date(initialData.joinDate).toISOString().split("T")[0] : ""}
                className="py-1.5 px-3 text-xs"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-slate-700">Department</label>
              <select
                name="department"
                defaultValue={initialData?.department || ""}
                className="py-1.5 px-3 text-xs bg-white"
              >
                <option value="">Select Department</option>
                {departmentNames.map((deptName: string) => (
                  <option key={deptName} value={deptName}>
                    {deptName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-semibold text-slate-700">
                Position <span className="text-rose-500">*</span>
              </label>
              <input
                name="position"
                required
                defaultValue={initialData?.position}
                className="py-1.5 px-3 text-xs"
                placeholder="Job position"
              />
            </div>

            {isEditMode && (
              <div className="sm:col-span-2">
                <label className="block mb-1 font-semibold text-slate-700">Employment Status</label>
                <select
                  name="employmentStatus"
                  defaultValue={initialData?.employmentStatus || "ACTIVE"}
                  className="py-1.5 px-3 text-xs bg-white"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            )}

            <div className="sm:col-span-2 p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between gap-3 shadow-xs">
              <div className="min-w-0 pr-2">
                <label htmlFor="isLocationExempt" className="font-bold text-slate-900 cursor-pointer block text-xs">
                  Location Geofence Exemption
                </label>
                <p className="text-[11px] text-slate-500 truncate">
                  Can punch in from anywhere without office GPS restriction.
                </p>
              </div>
              <input
                type="checkbox"
                id="isLocationExempt"
                name="isLocationExempt"
                value="true"
                defaultChecked={Boolean(initialData?.isLocationExempt || initialData?.employeeCode === "202602")}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block mb-1 font-semibold text-slate-700">Bio (Optional)</label>
              <input
                name="bio"
                defaultValue={initialData?.bio}
                className="py-1.5 px-3 text-xs"
                placeholder="Brief description or notes..."
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Account Setup + Identity & Qualifications */}
        <div className="space-y-3.5">
          
          {/* Account Setup */}
          <div className="bg-slate-50/60 rounded-xl border border-slate-200/80 p-3.5 sm:p-4 space-y-2.5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/70">
              <span className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                <KeyRound className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Account Setup</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className={isEditMode ? "sm:col-span-1" : "sm:col-span-1"}>
                <label className="block mb-1 font-semibold text-slate-700">
                  Work Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  defaultValue={initialData?.email}
                  className="py-1.5 px-3 text-xs"
                  placeholder="work@company.com"
                />
              </div>

              {!isEditMode && (
                <div className="sm:col-span-1">
                  <label className="block mb-1 font-semibold text-slate-700">
                    Temporary Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    className="py-1.5 px-3 text-xs"
                    placeholder="Enter password"
                  />
                </div>
              )}

              {isEditMode && (
                <div className="sm:col-span-1">
                  <label className="block mb-1 font-semibold text-slate-700">Change Password</label>
                  <input
                    type="password"
                    name="password"
                    className="py-1.5 px-3 text-xs"
                    placeholder="Leave blank to keep current"
                  />
                </div>
              )}

              {isEditMode && (
                <div className="sm:col-span-2">
                  <label className="block mb-1 font-semibold text-slate-700">System Role</label>
                  <select
                    name="role"
                    defaultValue={initialData?.user?.role || "EMPLOYEE"}
                    className="py-1.5 px-3 text-xs bg-white"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Identity & Qualifications */}
          <div className="bg-slate-50/60 rounded-xl border border-slate-200/80 p-3.5 sm:p-4 space-y-2.5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/70">
              <span className="p-1 rounded-md bg-amber-100 text-amber-700">
                <FileBadge className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Identity & Qualifications</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block mb-1 font-semibold text-slate-700">PAN Number</label>
                <input
                  name="panNumber"
                  placeholder="ABCDE1234F"
                  defaultValue={initialData?.panNumber}
                  className="uppercase font-mono tracking-wider py-1.5 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-slate-700">Aadhar Number</label>
                <input
                  name="aadharNumber"
                  placeholder="1234 5678 9012"
                  defaultValue={initialData?.aadharNumber}
                  className="font-mono tracking-wider py-1.5 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">Highest Qualification</label>
                <input
                  name="highestQualification"
                  placeholder="e.g. B.Tech, MBA"
                  defaultValue={initialData?.highestQualification}
                  className="py-1.5 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-slate-700">Pass Out Year</label>
                <input
                  name="passOutYear"
                  placeholder="e.g. 2024"
                  defaultValue={initialData?.passOutYear}
                  className="py-1.5 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">Certification</label>
                <input
                  name="certification"
                  placeholder="e.g. AWS, NISM"
                  defaultValue={initialData?.certification}
                  className="py-1.5 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-slate-700">Certification Validity</label>
                <input
                  name="certificationValidity"
                  placeholder="e.g. 2028-12-31 / Lifetime"
                  defaultValue={initialData?.certificationValidity}
                  className="py-1.5 px-3 text-xs"
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 shrink-0">
        <button
          type="button"
          className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          onClick={() => (onCancel ? onCancel() : navigate(-1))}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary px-5 py-2 text-xs font-bold flex items-center justify-center cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Saving...
            </>
          ) : (
            isEditMode ? "Update Employee" : "Create Employee"
          )}
        </button>
      </div>
    </form>
  );
};

export default EmployeeForm;