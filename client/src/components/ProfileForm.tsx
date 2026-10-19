import { Loader2, Save, User as UserIcon, Lock, ShieldCheck, GraduationCap } from "lucide-react";
import { useState } from "react";
import api from "../api/axios";

interface ProfileFormProps {
    initialData: any;
    onSuccess?: () => void;
}

const ProfileForm = ({ initialData, onSuccess }: ProfileFormProps) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [name, setName] = useState(
        initialData.name ||
        `${initialData.firstName || ""} ${initialData.lastName || ""}`.trim() ||
        "Admin"
    );

    const isAdmin = initialData.isAdmin || initialData.position === "Administrator";
    const hasPan = Boolean(initialData.panNumber && String(initialData.panNumber).trim());
    const hasAadhar = Boolean(initialData.aadharNumber && String(initialData.aadharNumber).trim());
    const isPanLocked = !isAdmin && hasPan;
    const isAadharLocked = !isAdmin && hasAadhar;

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setMessage("");
        const formData = new FormData(e.currentTarget);
        const payload: Record<string, any> = {
            bio: formData.get("bio"),
            highestQualification: formData.get("highestQualification"),
            passOutYear: formData.get("passOutYear"),
            certification: formData.get("certification"),
            certificationValidity: formData.get("certificationValidity"),
        };
        if (isAdmin) {
            payload.name = name;
            payload.firstName = name;
            payload.panNumber = formData.get("panNumber");
            payload.aadharNumber = formData.get("aadharNumber");
        } else {
            // If employee had no PAN set, accept their one-time input
            if (!hasPan && formData.get("panNumber")) {
                payload.panNumber = formData.get("panNumber");
            }
            // If employee had no Aadhar set, accept their one-time input
            if (!hasAadhar && formData.get("aadharNumber")) {
                payload.aadharNumber = formData.get("aadharNumber");
            }
        }

        try {
            await api.post("/profile", payload);
            setMessage("Profile updated successfully");
            onSuccess?.();
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 mb-6">
            {/* Personal Information Card */}
            <div className="card p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-slate-100 gap-2">
                    <h2 className="text-base font-medium text-slate-900 flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-slate-400" /> Public Profile
                    </h2>
                    {initialData.employeeCode && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-xs font-bold w-fit">
                            <span className="text-indigo-400 font-sans font-normal">Employee Code:</span> #{initialData.employeeCode}
                        </span>
                    )}
                </div>

                {error && (
                    <div className="bg-rose-50 text-rose-700 p-4 rounded-xl text-sm border border-rose-200 mb-6 flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                        {error}
                    </div>
                )}
                {message && (
                    <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm border border-emerald-200 mb-6 flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        {message}
                    </div>
                )}

                <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {initialData.employeeCode && (
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Employee Code</label>
                                <div className="relative">
                                    <input
                                        disabled
                                        value={`#${initialData.employeeCode}`}
                                        className="w-full bg-slate-50 text-indigo-700 font-mono font-bold border border-indigo-200/80 rounded-lg px-3 py-2 text-sm cursor-not-allowed tracking-wider"
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-sans font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                        ID
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">Your official organizational identifier.</p>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                            {isAdmin ? (
                                <input
                                    type="text"
                                    name="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your name"
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                                    required
                                />
                            ) : (
                                <input
                                    disabled
                                    value={`${initialData.firstName || ""} ${initialData.lastName || ""}`.trim()}
                                    className="w-full bg-slate-50 text-slate-500 border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                                />
                            )}
                            {isAdmin && (
                                <p className="text-[11px] text-slate-400 mt-1">This name appears in your sidebar and system notifications.</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                            <input
                                disabled
                                value={initialData.email || ""}
                                className="w-full bg-slate-50 text-slate-500 border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Position</label>
                            <input
                                disabled
                                value={initialData.position || (isAdmin ? "Administrator" : "Employee")}
                                className="w-full bg-slate-50 text-slate-500 border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
                            <input
                                disabled
                                value={initialData.department || (isAdmin ? "Management" : "Operations")}
                                className="w-full bg-slate-50 text-slate-500 border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Bio</label>
                        <textarea
                            disabled={initialData.isDeleted}
                            name="bio"
                            defaultValue={initialData.bio || ""}
                            placeholder="Write a brief bio..."
                            className={`w-full resize-none border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 ${initialData.isDeleted ? "bg-slate-50 text-slate-400 cursor-not-allowed" : "bg-white text-slate-900"
                                }`}
                            rows={2}
                        />
                        <p className="text-xs text-slate-400 mt-1.5">This will be displayed on your profile.</p>
                    </div>
                </div>
            </div>

            {/* Identity & Statutory Information */}
            <div className="card p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-slate-100 gap-2">
                    <h2 className="text-base font-medium text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-indigo-500" /> Identity Documents
                    </h2>
                    {isAdmin ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            Admin Unlocked
                        </span>
                    ) : isPanLocked && isAadharLocked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            <Lock className="w-3.5 h-3.5" /> Locked (Admin Managed)
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                            One-Time Entry Available
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-700">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-slate-700">PAN Number</label>
                            {isAdmin ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    Editable (Admin)
                                </span>
                            ) : isPanLocked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    <Lock className="w-2.5 h-2.5" /> Locked
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                    Open for Input
                                </span>
                            )}
                        </div>
                        {isPanLocked ? (
                            <div className="relative">
                                <input
                                    disabled
                                    value={initialData.panNumber || "Not Provided"}
                                    className="w-full bg-slate-50 text-slate-600 font-mono uppercase tracking-wider border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                                />
                                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            </div>
                        ) : (
                            <input
                                type="text"
                                name="panNumber"
                                defaultValue={initialData.panNumber || ""}
                                placeholder="e.g. ABCDE1234F"
                                className="w-full bg-white uppercase font-mono tracking-wider border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                            />
                        )}
                        <p className="text-[11px] text-slate-400 mt-1">
                            {isAdmin
                                ? "PAN card number for administrative and tax records."
                                : isPanLocked
                                ? "Permanent Account Number. Locked after submission. Contact Administrator to re-edit."
                                : "One-time entry: Once submitted and saved, this field will be permanently locked."}
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-slate-700">Aadhar Number</label>
                            {isAdmin ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    Editable (Admin)
                                </span>
                            ) : isAadharLocked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    <Lock className="w-2.5 h-2.5" /> Locked
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                    Open for Input
                                </span>
                            )}
                        </div>
                        {isAadharLocked ? (
                            <div className="relative">
                                <input
                                    disabled
                                    value={initialData.aadharNumber || "Not Provided"}
                                    className="w-full bg-slate-50 text-slate-600 font-mono tracking-wider border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                                />
                                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            </div>
                        ) : (
                            <input
                                type="text"
                                name="aadharNumber"
                                defaultValue={initialData.aadharNumber || ""}
                                placeholder="e.g. 1234 5678 9012"
                                className="w-full bg-white font-mono tracking-wider border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                            />
                        )}
                        <p className="text-[11px] text-slate-400 mt-1">
                            {isAdmin
                                ? "Aadhar identification number for official records."
                                : isAadharLocked
                                ? "12-digit UIDAI number. Locked after submission. Contact Administrator to re-edit."
                                : "One-time entry: Once submitted and saved, this field will be permanently locked."}
                        </p>
                    </div>
                </div>
            </div>

            {/* Qualifications & Certifications */}
            <div className="card p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-slate-100 gap-2">
                    <h2 className="text-base font-medium text-slate-900 flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-purple-500" /> Qualifications & Certifications
                    </h2>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                        Self Editable
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-700">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Highest Qualification</label>
                        <input
                            type="text"
                            name="highestQualification"
                            disabled={initialData.isDeleted}
                            defaultValue={initialData.highestQualification || ""}
                            placeholder="e.g. B.Tech in Computer Science / MBA"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Pass Out Year</label>
                        <input
                            type="text"
                            name="passOutYear"
                            disabled={initialData.isDeleted}
                            defaultValue={initialData.passOutYear || ""}
                            placeholder="e.g. 2022"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Certification</label>
                        <input
                            type="text"
                            name="certification"
                            disabled={initialData.isDeleted}
                            defaultValue={initialData.certification || ""}
                            placeholder="e.g. AWS Solutions Architect / NISM Series V-A"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Certification Validity</label>
                        <input
                            type="text"
                            name="certificationValidity"
                            disabled={initialData.isDeleted}
                            defaultValue={initialData.certificationValidity || ""}
                            placeholder="e.g. 2028-12-31 or Lifetime"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>
            </div>

            {/* Save Button */}
            {initialData.isDeleted ? (
                <div className="pt-2">
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center">
                        <p className="text-rose-600 font-medium tracking-tight">Account Deactivated</p>
                        <p className="text-sm text-rose-500 mt-0.5">You can no longer update your profile.</p>
                    </div>
                </div>
            ) : (
                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary flex items-center gap-2 justify-center w-full sm:w-auto"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </button>
                </div>
            )}
        </form>
    );
};

export default ProfileForm;