import { useState, useMemo, useEffect } from "react";
import { Loader2, Plus, X, Trash2, TrendingUp, TrendingDown, Calculator, Sparkles, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/axios";

interface CustomComponent {
    id: string;
    name: string;
    amount: number | string;
}

interface GeneratePayslipFormProps {
    employees: any[];
    onSuccess: () => void;
}

const MONTHS = [
    { value: 1, name: "January" },
    { value: 2, name: "February" },
    { value: 3, name: "March" },
    { value: 4, name: "April" },
    { value: 5, name: "May" },
    { value: 6, name: "June" },
    { value: 7, name: "July" },
    { value: 8, name: "August" },
    { value: 9, name: "September" },
    { value: 10, name: "October" },
    { value: 11, name: "November" },
    { value: 12, name: "December" },
];

const GeneratePayslipForm = ({ employees, onSuccess }: GeneratePayslipFormProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form fields
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [year, setYear] = useState<number>(new Date().getFullYear());

    // Standard Earnings
    const [basicSalary, setBasicSalary] = useState<number | string>(0);
    const [incentive, setIncentive] = useState<number | string>(0);
    const [allowances, setAllowances] = useState<number | string>(0);
    const [bonus, setBonus] = useState<number | string>(0);
    const [customEarnings, setCustomEarnings] = useState<CustomComponent[]>([]);

    // Standard Deductions
    const [lwp, setLwp] = useState<number | string>(0);
    const [tax, setTax] = useState<number | string>(0);
    const [adjustments, setAdjustments] = useState<number | string>(0);
    const [customDeductions, setCustomDeductions] = useState<CustomComponent[]>([]);

    // Auto-fetch incentive status
    const [isFetchingIncentive, setIsFetchingIncentive] = useState(false);
    const [incentiveSource, setIncentiveSource] = useState<string | null>(null);
    const [systemCalculatedIncentive, setSystemCalculatedIncentive] = useState<number>(0);
    const [isIncentiveModified, setIsIncentiveModified] = useState(false);

    // Auto-fetch incentive from Incentives module for selected employee, month, and year
    const fetchIncentiveForEmployee = async (empId: string, monthVal: number, yearVal: number) => {
        if (!empId) return;
        try {
            setIsFetchingIncentive(true);
            const res = await api.get("/incentives/employee-monthly-incentive", {
                params: {
                    employeeId: empId,
                    month: monthVal,
                    year: yearVal,
                },
            });
            if (res.data?.success) {
                const fetchedAmt = res.data.totalIncentive ?? 0;
                setSystemCalculatedIncentive(fetchedAmt);
                if (!isIncentiveModified) {
                    setIncentive(fetchedAmt);
                    if (fetchedAmt > 0) {
                        setIncentiveSource(
                            `Auto-fetched from Incentives (${res.data.count} entry${res.data.count > 1 ? "s" : ""})`
                        );
                    } else {
                        setIncentiveSource(null);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to auto-fetch employee incentive:", err);
        } finally {
            setIsFetchingIncentive(false);
        }
    };

    // Auto-fetch LWP status
    const [isFetchingLwp, setIsFetchingLwp] = useState(false);
    const [lwpSource, setLwpSource] = useState<string | null>(null);
    const [systemCalculatedLwp, setSystemCalculatedLwp] = useState<number>(0);
    const [isLwpModified, setIsLwpModified] = useState(false);
    const [isDeductionsModified, setIsDeductionsModified] = useState(false);
    const [attendanceSummary, setAttendanceSummary] = useState<{
        absentDaysCount: number;
        totalDaysInMonth: number;
        validPresentDays: number;
    } | null>(null);

    // Auto-fetch attendance absent days & calculate LWP
    const fetchLwpForEmployee = async (empId: string, monthVal: number, yearVal: number, currentBasic: number | string) => {
        if (!empId) return;
        try {
            setIsFetchingLwp(true);
            const res = await api.get("/attendance/employee-monthly-lwp", {
                params: {
                    employeeId: empId,
                    month: monthVal,
                    year: yearVal,
                    basicSalary: currentBasic,
                },
            });
            if (res.data?.success) {
                const { absentDaysCount, totalDaysInMonth, validPresentDays, lwpAmount } = res.data;
                setAttendanceSummary({ absentDaysCount, totalDaysInMonth, validPresentDays });
                const fetchedLwp = Number(lwpAmount) || 0;
                setSystemCalculatedLwp(fetchedLwp);

                if (!isLwpModified) {
                    setLwp(fetchedLwp);
                    if (absentDaysCount > 0) {
                        setLwpSource(
                            `(${absentDaysCount} absent / ${validPresentDays} present)`
                        );
                    } else {
                        setLwpSource(null);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to auto-fetch employee LWP:", err);
        } finally {
            setIsFetchingLwp(false);
        }
    };

    // Whenever employee, month, or year changes, auto-fetch incentive & LWP if modal is open
    useEffect(() => {
        if (isOpen && selectedEmployeeId && selectedMonth && year) {
            fetchIncentiveForEmployee(selectedEmployeeId, selectedMonth, year);
            fetchLwpForEmployee(selectedEmployeeId, selectedMonth, year, basicSalary);
        }
    }, [isOpen, selectedEmployeeId, selectedMonth, year]);

    // Recalculate LWP when basic salary changes
    const handleBasicSalaryChange = (newBasicStr: string) => {
        setBasicSalary(newBasicStr);
        const newBasic = Math.max(0, Number(newBasicStr) || 0);
        if (attendanceSummary && attendanceSummary.absentDaysCount > 0) {
            if (attendanceSummary.validPresentDays > 0) {
                const perDay = newBasic / attendanceSummary.validPresentDays;
                const newLwp = parseFloat((perDay * attendanceSummary.absentDaysCount).toFixed(2));
                setSystemCalculatedLwp(newLwp);
                if (!isLwpModified) {
                    setLwp(newLwp);
                    setLwpSource(
                        `(${attendanceSummary.absentDaysCount} absent / ${attendanceSummary.validPresentDays} present)`
                    );
                }
            } else {
                setSystemCalculatedLwp(newBasic);
                if (!isLwpModified) {
                    setLwp(newBasic);
                }
            }
        }
    };

    // Auto-populate employee data when selected
    const handleEmployeeChange = (empId: string) => {
        setSelectedEmployeeId(empId);
        setIsLwpModified(false);
        setIsDeductionsModified(false);
        setIsIncentiveModified(false);
        setLwpSource(null);
        setIncentiveSource(null);
        const emp = employees.find((e) => (e._id || e.id) === empId);
        if (emp) {
            let bSal = basicSalary;
            if (emp.basicSalary !== undefined && emp.basicSalary !== null) {
                bSal = emp.basicSalary;
                setBasicSalary(emp.basicSalary);
            }
            if (emp.allowances !== undefined && emp.allowances !== null) {
                setAllowances(emp.allowances);
            }
            fetchLwpForEmployee(empId, selectedMonth, year, bSal);
            fetchIncentiveForEmployee(empId, selectedMonth, year);
        }
    };

    const handleMonthChange = (val: number) => {
        setSelectedMonth(val);
        setIsLwpModified(false);
        setIsDeductionsModified(false);
        setIsIncentiveModified(false);
        setLwpSource(null);
        setIncentiveSource(null);
    };

    const handleYearChange = (val: number) => {
        setYear(val);
        setIsLwpModified(false);
        setIsDeductionsModified(false);
        setIsIncentiveModified(false);
        setLwpSource(null);
        setIncentiveSource(null);
    };

    // Open Modal and reset
    const handleOpen = () => {
        const defaultEmp = employees[0];
        const defaultEmpId = defaultEmp ? (defaultEmp._id || defaultEmp.id) : "";
        setSelectedEmployeeId(defaultEmpId);
        setSelectedMonth(new Date().getMonth() + 1);
        setYear(new Date().getFullYear());

        setBasicSalary(defaultEmp?.basicSalary || 0);
        setIncentive(0);
        setIncentiveSource(null);
        setSystemCalculatedIncentive(0);
        setIsIncentiveModified(false);

        setAllowances(defaultEmp?.allowances || 0);
        setBonus(0);
        setCustomEarnings([]);

        setLwp(0);
        setLwpSource(null);
        setSystemCalculatedLwp(0);
        setIsLwpModified(false);
        setIsDeductionsModified(false);
        setAttendanceSummary(null);

        setTax(0);
        setAdjustments(0);
        setCustomDeductions([]);

        setIsOpen(true);
    };

    // Add Custom Earning Component
    const addCustomEarning = () => {
        setCustomEarnings((prev) => [
            ...prev,
            { id: String(Date.now() + Math.random()), name: "", amount: "" }
        ]);
    };

    const updateCustomEarning = (id: string, field: "name" | "amount", val: any) => {
        setCustomEarnings((prev) =>
            prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
        );
    };

    const removeCustomEarning = (id: string) => {
        setCustomEarnings((prev) => prev.filter((item) => item.id !== id));
    };

    // Add Custom Deduction Component
    const addCustomDeduction = () => {
        setIsDeductionsModified(true);
        setCustomDeductions((prev) => [
            ...prev,
            { id: String(Date.now() + Math.random()), name: "", amount: "" }
        ]);
    };

    const updateCustomDeduction = (id: string, field: "name" | "amount", val: any) => {
        setIsDeductionsModified(true);
        setCustomDeductions((prev) =>
            prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
        );
    };

    const removeCustomDeduction = (id: string) => {
        setIsDeductionsModified(true);
        setCustomDeductions((prev) => prev.filter((item) => item.id !== id));
    };

    // Calculations
    const totalEarnings = useMemo(() => {
        const basic = Math.max(0, Number(basicSalary) || 0);
        const inc = Math.max(0, Number(incentive) || 0);
        const allow = Math.max(0, Number(allowances) || 0);
        const bon = Math.max(0, Number(bonus) || 0);
        const customSum = customEarnings.reduce((acc, curr) => acc + (Math.max(0, Number(curr.amount) || 0)), 0);
        return basic + inc + allow + bon + customSum;
    }, [basicSalary, incentive, allowances, bonus, customEarnings]);

    const totalDeductions = useMemo(() => {
        const lwpVal = Math.max(0, Number(lwp) || 0);
        const taxVal = Math.max(0, Number(tax) || 0);
        const adjVal = Math.max(0, Number(adjustments) || 0);
        const customSum = customDeductions.reduce((acc, curr) => acc + (Math.max(0, Number(curr.amount) || 0)), 0);
        return lwpVal + taxVal + adjVal + customSum;
    }, [lwp, tax, adjustments, customDeductions]);

    const netPay = useMemo(() => {
        return Math.max(0, totalEarnings - totalDeductions);
    }, [totalEarnings, totalDeductions]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeId) {
            toast.error("Please select an employee");
            return;
        }

        setLoading(true);

        const payload = {
            employeeId: selectedEmployeeId,
            month: Number(selectedMonth),
            year: Number(year),
            basicSalary: Number(basicSalary) || 0,
            incentive: Number(incentive) || 0,
            allowances: Number(allowances) || 0,
            bonus: Number(bonus) || 0,
            customEarnings: customEarnings
                .filter((item) => item.name.trim() && Number(item.amount) > 0)
                .map((item) => ({ name: item.name.trim(), amount: Number(item.amount) })),
            lwp: Number(lwp) || 0,
            tax: Number(tax) || 0,
            adjustments: Number(adjustments) || 0,
            customDeductions: customDeductions
                .filter((item) => item.name.trim() && Number(item.amount) > 0)
                .map((item) => ({ name: item.name.trim(), amount: Number(item.amount) })),
            isLwpModified,
            overrideDeductions: isLwpModified || isDeductionsModified,
            isIncentiveModified,
            overrideEarnings: isIncentiveModified,
        };

        try {
            await api.post("/payslips", payload);
            toast.success("Payslip generated successfully");
            setIsOpen(false);
            onSuccess();
        } catch (err: any) {
            toast.error(err.response?.data?.error || err?.message || "Failed to generate payslip");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={handleOpen}
                className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer shadow-sm hover:shadow"
            >
                <Plus className="w-4 h-4" /> Generate Payslip
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
            <div className="card max-w-4xl w-full p-5 sm:p-7 animate-slide-up my-6 max-h-[92vh] flex flex-col">
                {/* Modal Header */}
                <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-indigo-600" />
                            Generate Monthly Payslip
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Calculate earnings, statutory and voluntary deductions, and net payable salary
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-5 pr-1">
                    {/* Employee & Period Details */}
                    <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-slate-700">
                            {/* Select Employee */}
                            <div className="sm:col-span-1">
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Employee <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={selectedEmployeeId}
                                    onChange={(e) => handleEmployeeChange(e.target.value)}
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="" disabled>Select Employee</option>
                                    {employees.map((e: any) => (
                                        <option key={e._id || e.id} value={e._id || e.id}>
                                            {e.firstName} {e.lastName} ({e.position || "Employee"})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Select Month in Name */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Month <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => handleMonthChange(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                                >
                                    {MONTHS.map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Select Year */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Year <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={year}
                                    onChange={(e) => handleYearChange(Number(e.target.value))}
                                    min={2020}
                                    max={2035}
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* SECTION 1: EARNINGS */}
                        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs flex flex-col">
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-100">
                                <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    Earnings
                                </h4>
                                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    Total: ₹{totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="space-y-3 text-xs flex-1">
                                {/* Basic Salary */}
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">
                                        Basic Salary (₹) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={basicSalary}
                                        onChange={(e) => handleBasicSalaryChange(e.target.value)}
                                        placeholder="0.00"
                                        required
                                        className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                {/* Incentive */}
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <label className="font-semibold text-slate-700 whitespace-nowrap shrink-0">Incentive (₹)</label>
                                            {isIncentiveModified && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300">
                                                    Manual Override Active
                                                </span>
                                            )}
                                        </div>
                                        {isFetchingIncentive && (
                                            <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold whitespace-nowrap shrink-0">
                                                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Fetching...
                                            </span>
                                        )}
                                        {!isIncentiveModified && incentiveSource && !isFetchingIncentive && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-300 whitespace-nowrap shrink-0">
                                                <Sparkles className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                                {incentiveSource}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={incentive}
                                        onChange={(e) => {
                                            setIncentive(e.target.value);
                                            setIsIncentiveModified(true);
                                            setIncentiveSource(null);
                                        }}
                                        placeholder="0.00"
                                        className={`w-full border rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 transition-colors ${
                                            isIncentiveModified
                                                ? "bg-amber-50/30 border-amber-300 ring-1 ring-amber-200"
                                                : incentiveSource
                                                ? "bg-emerald-50/40 border-emerald-300"
                                                : "border-slate-200"
                                        }`}
                                    />
                                    {isIncentiveModified && systemCalculatedIncentive > 0 && (
                                        <div className="flex items-center justify-between gap-2 mt-1.5 p-1.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-[11px]">
                                            <span className="text-amber-900 font-medium truncate">
                                                System calculated: <strong className="font-bold">₹{systemCalculatedIncentive.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIncentive(systemCalculatedIncentive);
                                                    setIsIncentiveModified(false);
                                                    setIncentiveSource("Auto-fetched from Incentives");
                                                }}
                                                className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                                                title="Reset to system calculated incentive"
                                            >
                                                <RotateCcw className="w-2.5 h-2.5" /> Reset to System Calc
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Allowances */}
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Allowances (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={allowances}
                                        onChange={(e) => setAllowances(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                {/* Bonus */}
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Bonus (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={bonus}
                                        onChange={(e) => setBonus(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>

                                {/* Custom Earning Components */}
                                {customEarnings.length > 0 && (
                                    <div className="pt-2 border-t border-slate-100 space-y-2">
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            Additional Earning Components
                                        </p>
                                        {customEarnings.map((item) => (
                                            <div key={item.id} className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => updateCustomEarning(item.id, "name", e.target.value)}
                                                    placeholder="Component (e.g. Overtime)"
                                                    className="flex-1 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                                                />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.amount}
                                                    onChange={(e) => updateCustomEarning(item.id, "amount", e.target.value)}
                                                    placeholder="Amount (₹)"
                                                    className="w-24 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeCustomEarning(item.id)}
                                                    className="text-slate-400 hover:text-rose-500 p-1.5 rounded hover:bg-rose-50 transition-colors"
                                                    title="Remove component"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add Earning Component Button */}
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={addCustomEarning}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-dashed border-emerald-300 w-full justify-center transition-colors cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Earning Component
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: DEDUCTIONS */}
                        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs flex flex-col">
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-rose-100">
                                <h4 className="text-sm font-bold text-rose-800 flex items-center gap-1.5">
                                    <TrendingDown className="w-4 h-4 text-rose-600" />
                                    Deductions
                                </h4>
                                <span className="text-xs font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                    Total: ₹{totalDeductions.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div className="space-y-3 text-xs flex-1">
                                {/* Leave Without Pay (LWP) */}
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <label className="font-semibold text-slate-700 whitespace-nowrap shrink-0">
                                                Leave Without Pay (LWP) (₹)
                                            </label>
                                            {isLwpModified && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300">
                                                    Manual Override Active
                                                </span>
                                            )}
                                        </div>
                                        {isFetchingLwp && (
                                            <span className="text-[10px] text-rose-600 flex items-center gap-1 font-semibold whitespace-nowrap shrink-0">
                                                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Checking attendance...
                                            </span>
                                        )}
                                        {!isLwpModified && lwpSource && !isFetchingLwp && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-300 whitespace-nowrap shrink-0">
                                                <Sparkles className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                                {lwpSource}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={lwp}
                                        onChange={(e) => {
                                            setLwp(e.target.value);
                                            setIsLwpModified(true);
                                            setIsDeductionsModified(true);
                                            setLwpSource(null);
                                        }}
                                        placeholder="0.00"
                                        className={`w-full border rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500 transition-colors ${
                                            isLwpModified
                                                ? "bg-amber-50/30 border-amber-300 ring-1 ring-amber-200"
                                                : lwpSource
                                                ? "bg-rose-50/40 border-rose-300"
                                                : "border-slate-200"
                                        }`}
                                    />
                                    {/* LWP Override hint & Reset button */}
                                    {isLwpModified && systemCalculatedLwp > 0 && (
                                        <div className="flex items-center justify-between gap-2 mt-1.5 p-1.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-[11px]">
                                            <span className="text-amber-900 font-medium truncate">
                                                System calculated: <strong className="font-bold">₹{systemCalculatedLwp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setLwp(systemCalculatedLwp);
                                                    setIsLwpModified(false);
                                                    if (attendanceSummary && attendanceSummary.absentDaysCount > 0) {
                                                        setLwpSource(
                                                            `(${attendanceSummary.absentDaysCount} absent / ${attendanceSummary.validPresentDays} present)`
                                                        );
                                                    } else {
                                                        setLwpSource(null);
                                                    }
                                                }}
                                                className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                                                title="Reset to attendance calculation"
                                            >
                                                <RotateCcw className="w-2.5 h-2.5" /> Reset to System Calc
                                            </button>
                                        </div>
                                    )}
                                    {!isLwpModified && attendanceSummary && attendanceSummary.absentDaysCount > 0 && (
                                        <p className="text-[10px] text-rose-700 mt-1 font-medium">
                                            Formula: (Basic Salary ÷ {attendanceSummary.validPresentDays} valid days) × {attendanceSummary.absentDaysCount} absent days.
                                        </p>
                                    )}
                                </div>

                                {/* Tax */}
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Tax / TDS (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={tax}
                                        onChange={(e) => {
                                            setTax(e.target.value);
                                            setIsDeductionsModified(true);
                                        }}
                                        placeholder="0.00"
                                        className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500"
                                    />
                                </div>

                                {/* Adjustments */}
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Adjustments (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={adjustments}
                                        onChange={(e) => {
                                            setAdjustments(e.target.value);
                                            setIsDeductionsModified(true);
                                        }}
                                        placeholder="0.00"
                                        className="w-full border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-rose-500"
                                    />
                                </div>

                                {/* Custom Deduction Components */}
                                {customDeductions.length > 0 && (
                                    <div className="pt-2 border-t border-slate-100 space-y-2">
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            Additional Deduction Components
                                        </p>
                                        {customDeductions.map((item) => (
                                            <div key={item.id} className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => updateCustomDeduction(item.id, "name", e.target.value)}
                                                    placeholder="Component (e.g. PF, Loan)"
                                                    className="flex-1 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 focus:outline-none focus:border-rose-500"
                                                />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.amount}
                                                    onChange={(e) => updateCustomDeduction(item.id, "amount", e.target.value)}
                                                    placeholder="Amount (₹)"
                                                    className="w-24 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800 focus:outline-none focus:border-rose-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeCustomDeduction(item.id)}
                                                    className="text-slate-400 hover:text-rose-500 p-1.5 rounded hover:bg-rose-50 transition-colors"
                                                    title="Remove component"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add Deduction Component Button */}
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={addCustomDeduction}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-dashed border-rose-300 w-full justify-center transition-colors cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Deduction Component
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* NET PAY SUMMARY BANNER */}
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 rounded-xl text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-white/10 text-emerald-400 border border-white/10">
                                <Calculator className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                                    Net Payable Salary
                                </span>
                                <div className="text-xs text-slate-300 flex items-center gap-2">
                                    <span>Earnings: ₹{totalEarnings.toLocaleString("en-IN")}</span>
                                    <span>−</span>
                                    <span>Deductions: ₹{totalDeductions.toLocaleString("en-IN")}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                                ₹{netPay.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="btn-secondary text-xs px-4 py-2 cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary flex items-center gap-2 text-xs px-5 py-2 cursor-pointer font-bold"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Generate Payslip
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GeneratePayslipForm;