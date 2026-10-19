import React, { useState, useEffect, useMemo } from "react";
import {
  BadgePercent,
  Plus,
  FileSpreadsheet,
  Search,
  Calendar,
  Filter,
  Trash2,
  Edit3,
  TrendingUp,
  IndianRupee,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  Briefcase,
  Calculator,
  Lock,
} from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useAuth } from "../../context/AuthContext";

export const INCENTIVE_PRODUCTS = [
  "Demat & Trading",
  "Mutual Funds",
  "National Pension System",
  "Floating Rate Savings Bonds, 2020 (Taxable)",
  "Unlisted Shares",
  "Insurance Solutions",
  "54 EC Capital Gain Bonds",
  "Fixed Deposits & NCDs",
  "Loan Against Securities",
  "Travel Insurance",
  "AIF and PMS",
  "Govt Schemes",
] as const;

export interface IncentiveRecord {
  _id: string;
  employeeId?: any;
  employeeName: string;
  month: string;
  product: string;
  transactionPerMonth: number;
  totalIncome?: number; // fallback
  projectedIncomeYearly: number;
  actualIncomeYearly: number;
  commissionPercentage: number;
  incentiveAmount: number;
  disbursementDate: string;
  remarks?: string;
  createdAt?: string;
}

interface EmployeeOption {
  _id: string;
  firstName: string;
  lastName: string;
  employeeCode?: string;
  department?: string;
  isDeleted?: boolean;
}

export const formatName = (name?: string): string => {
  if (!name) return "-";
  return name
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const formatDisbursementDate = (dateStr?: string | Date): string => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const day = d.getDate();
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day < 10 ? "0" + day : day}-${month}-${year}`;
};

export const formatCurrency = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(Number(val))) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(val));
};

const MONTH_PRESETS = [
  "JANUARY, 26",
  "FEBRUARY, 26",
  "MARCH, 26",
  "APRIL, 26",
  "MAY, 26",
  "JUNE, 26",
  "JULY, 26",
  "AUGUST, 26",
  "SEPTEMBER, 26",
  "OCTOBER, 26",
  "NOVEMBER, 26",
  "DECEMBER, 26",
];

const Incentives: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [incentives, setIncentives] = useState<IncentiveRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("ALL");
  const [selectedProduct, setSelectedProduct] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IncentiveRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<IncentiveRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formEmployeeName, setFormEmployeeName] = useState("");
  const [formMonth, setFormMonth] = useState("");
  const [formProduct, setFormProduct] = useState<string>(INCENTIVE_PRODUCTS[0]);
  const [formTransactionPerMonth, setFormTransactionPerMonth] = useState("");
  const [formProjectedIncomeYearly, setFormProjectedIncomeYearly] = useState("");
  const [formActualIncomeYearly, setFormActualIncomeYearly] = useState("");
  const [formCommissionPercentage, setFormCommissionPercentage] = useState("");
  const [formIncentiveAmount, setFormIncentiveAmount] = useState("");
  const [formDisbursementDate, setFormDisbursementDate] = useState("");
  const [formRemarks, setFormRemarks] = useState("");

  // Fetch incentives & employees
  const fetchIncentives = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const res = await api.get("/incentives");
      if (res.data?.success) {
        setIncentives(res.data.data || []);
        if (showToast) toast.success("Incentive data refreshed.");
      }
    } catch (err: any) {
      console.error("Failed to fetch incentives:", err);
      toast.error(err.response?.data?.error || "Failed to load incentive records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees");
      const list = Array.isArray(res.data) ? res.data : (res.data?.employees || []);
      // Exclude deactivated employees so they cannot be selected for new incentives
      setEmployees(list.filter((e: any) => !e.isDeleted));
    } catch (err) {
      console.error("Failed to fetch employees list:", err);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchIncentives();
      fetchEmployees();
    }
  }, [isAdmin]);

  // Distinct products & months for filter dropdowns
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    incentives.forEach((item) => {
      if (item.month) set.add(item.month);
    });
    MONTH_PRESETS.forEach((m) => set.add(m));
    return Array.from(set);
  }, [incentives]);

  const availableProducts = useMemo(() => {
    const set = new Set<string>();
    INCENTIVE_PRODUCTS.forEach((p) => set.add(p));
    incentives.forEach((item) => {
      if (item.product) set.add(item.product);
    });
    return Array.from(set);
  }, [incentives]);

  // Filtered incentives
  const filteredIncentives = useMemo(() => {
    return incentives.filter((item) => {
      const matchesSearch =
        !searchTerm.trim() ||
        item.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.month?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.remarks && item.remarks.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesMonth = selectedMonth === "ALL" || item.month === selectedMonth;
      const matchesProduct = selectedProduct === "ALL" || item.product === selectedProduct;

      return matchesSearch && matchesMonth && matchesProduct;
    });
  }, [incentives, searchTerm, selectedMonth, selectedProduct]);

  // Statistics
  const stats = useMemo(() => {
    const totalTransactionVolume = filteredIncentives.reduce(
      (sum, item) => sum + (Number(item.transactionPerMonth ?? item.totalIncome) || 0),
      0
    );
    const totalProjected = filteredIncentives.reduce(
      (sum, item) =>
        sum +
        (Number(
          item.projectedIncomeYearly ??
            (Number(item.transactionPerMonth ?? item.totalIncome ?? 0) * 12)
        ) || 0),
      0
    );
    const totalActual = filteredIncentives.reduce(
      (sum, item) =>
        sum +
        (Number(
          item.actualIncomeYearly ??
            item.projectedIncomeYearly ??
            (Number(item.transactionPerMonth ?? item.totalIncome ?? 0) * 12)
        ) || 0),
      0
    );
    const totalIncentive = filteredIncentives.reduce(
      (sum, item) => sum + (Number(item.incentiveAmount) || 0),
      0
    );
    const avgRate =
      totalProjected > 0 ? (totalIncentive / totalProjected) * 100 : 0;

    const totalComm = filteredIncentives.reduce(
      (sum, item) => sum + (Number(item.commissionPercentage) || 0),
      0
    );
    const avgCommission =
      filteredIncentives.length > 0 ? totalComm / filteredIncentives.length : 0;

    return {
      totalTransactionVolume,
      totalProjected,
      totalActual,
      totalIncentive,
      avgRate: avgRate.toFixed(1),
      avgCommission: avgCommission.toFixed(1),
      count: filteredIncentives.length,
    };
  }, [filteredIncentives]);

  // Handle Employee Dropdown selection in form
  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const empId = e.target.value;
    setFormEmployeeId(empId);
    if (empId) {
      const emp = employees.find((x) => x._id === empId);
      if (emp) {
        setFormEmployeeName(`${emp.firstName} ${emp.lastName || ""}`.trim().toUpperCase());
      }
    }
  };

  // Recompute projected income, actual income, and incentive when transaction per month changes
  const handleTransactionChange = (val: string) => {
    setFormTransactionPerMonth(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      const projected = parseFloat((num * 12).toFixed(2));
      setFormProjectedIncomeYearly(String(projected));
      setFormActualIncomeYearly(String(projected));

      // Auto-compute incentive if commission percentage is present
      const comm = parseFloat(formCommissionPercentage);
      if (!isNaN(comm) && comm >= 0) {
        const halfComm = comm / 2;
        const incentive = parseFloat(((projected * halfComm) / 100).toFixed(2));
        setFormIncentiveAmount(String(incentive));
      }
    } else {
      setFormProjectedIncomeYearly("");
      setFormActualIncomeYearly("");
      setFormIncentiveAmount("");
    }
  };

  // Recompute incentive amount when commission percentage changes
  // Formula: Projected Income (Yearly) * (half of Commission percentage) / 100
  const handleCommissionChange = (val: string) => {
    setFormCommissionPercentage(val);
    const comm = parseFloat(val);
    const projected = parseFloat(formProjectedIncomeYearly);
    if (!isNaN(comm) && comm >= 0 && !isNaN(projected) && projected >= 0) {
      const halfComm = comm / 2;
      const incentive = parseFloat(((projected * halfComm) / 100).toFixed(2));
      setFormIncentiveAmount(String(incentive));
    }
  };

  // Quick commission percentage setter
  const handleQuickCommission = (pct: number) => {
    handleCommissionChange(String(pct));
  };

  // Open Modal for Create
  const handleOpenAddModal = () => {
    setEditingRecord(null);
    setFormEmployeeId("");
    setFormEmployeeName("");
    setFormMonth("APRIL, 26");
    setFormProduct(INCENTIVE_PRODUCTS[0]);
    setFormTransactionPerMonth("");
    setFormProjectedIncomeYearly("");
    setFormActualIncomeYearly("");
    setFormCommissionPercentage("");
    setFormIncentiveAmount("");
    setFormDisbursementDate(new Date().toISOString().split("T")[0]);
    setFormRemarks("");
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (rec: IncentiveRecord) => {
    setEditingRecord(rec);
    setFormEmployeeId(rec.employeeId?._id || rec.employeeId || "");
    setFormEmployeeName(rec.employeeName || "");
    setFormMonth(rec.month || "");
    setFormProduct(rec.product || INCENTIVE_PRODUCTS[0]);
    const transVal = rec.transactionPerMonth ?? rec.totalIncome ?? 0;
    setFormTransactionPerMonth(transVal ? String(transVal) : "");
    const projVal = rec.projectedIncomeYearly ?? (Number(transVal) * 12);
    setFormProjectedIncomeYearly(projVal ? String(projVal) : "");
    const actualVal = rec.actualIncomeYearly ?? projVal;
    setFormActualIncomeYearly(actualVal ? String(actualVal) : "");
    setFormCommissionPercentage(
      rec.commissionPercentage !== undefined && rec.commissionPercentage !== null
        ? String(rec.commissionPercentage)
        : ""
    );
    setFormIncentiveAmount(String(rec.incentiveAmount || ""));
    setFormDisbursementDate(
      rec.disbursementDate ? new Date(rec.disbursementDate).toISOString().split("T")[0] : ""
    );
    setFormRemarks(rec.remarks || "");
    setIsModalOpen(true);
  };

  // Submit Add / Edit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeName.trim()) {
      toast.error("Please provide or select an Employee Name.");
      return;
    }
    if (!formMonth.trim()) {
      toast.error("Please provide a Month.");
      return;
    }
    const transNum = parseFloat(formTransactionPerMonth);
    if (isNaN(transNum) || transNum < 0) {
      toast.error("Please enter a valid Transaction per Month.");
      return;
    }

    const projNum = parseFloat(formProjectedIncomeYearly);
    const calculatedProj = !isNaN(projNum) ? projNum : parseFloat((transNum * 12).toFixed(2));

    const actualNum = parseFloat(formActualIncomeYearly);
    const finalActual = !isNaN(actualNum) ? actualNum : calculatedProj;

    const commNum = parseFloat(formCommissionPercentage);
    const finalComm = !isNaN(commNum) && commNum >= 0 ? commNum : 0;

    const incentiveNum = parseFloat(formIncentiveAmount);
    if (isNaN(incentiveNum) || incentiveNum < 0) {
      toast.error("Please enter or compute a valid Incentive Amount.");
      return;
    }

    if (!formDisbursementDate) {
      toast.error("Please select a Disbursement Date.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        employeeId: formEmployeeId || null,
        employeeName: formEmployeeName.trim().toUpperCase(),
        month: formMonth.trim(),
        product: formProduct.trim(),
        transactionPerMonth: transNum,
        totalIncome: transNum, // maintain sync
        projectedIncomeYearly: calculatedProj,
        actualIncomeYearly: finalActual,
        commissionPercentage: finalComm,
        incentiveAmount: incentiveNum,
        disbursementDate: formDisbursementDate,
        remarks: formRemarks.trim(),
      };

      if (editingRecord) {
        await api.put(`/incentives/${editingRecord._id}`, payload);
        toast.success("Incentive record updated successfully!");
      } else {
        await api.post("/incentives", payload);
        toast.success("New incentive entry added successfully!");
      }

      setIsModalOpen(false);
      fetchIncentives();
    } catch (err: any) {
      console.error("Failed to save incentive:", err);
      toast.error(err.response?.data?.error || "Error saving incentive record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Record
  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;
    try {
      await api.delete(`/incentives/${recordToDelete._id}`);
      toast.success("Incentive record deleted.");
      setRecordToDelete(null);
      fetchIncentives();
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error(err.response?.data?.error || "Failed to delete incentive record.");
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    if (filteredIncentives.length === 0) {
      toast.error("No incentive records to export.");
      return;
    }

    try {
      const excelRows = filteredIncentives.map((item, index) => {
        const trans = item.transactionPerMonth ?? item.totalIncome ?? 0;
        const proj = item.projectedIncomeYearly ?? (trans * 12);
        const actual = item.actualIncomeYearly ?? proj;
        return {
          "SL NO": index + 1,
          NAME: formatName(item.employeeName),
          MONTH: item.month,
          PRODUCT: item.product,
          "TRANS / MO": trans,
          "PROJECTED (YR)": proj,
          "ACTUAL (YR)": actual,
          "COMM %": item.commissionPercentage !== undefined ? `${item.commissionPercentage}%` : "0%",
          INCENTIVE: item.incentiveAmount,
          "DISBURSE DATE": formatDisbursementDate(item.disbursementDate),
        };
      });

      // Append a Summary Total row
      excelRows.push({
        "SL NO": ("TOTAL" as unknown) as number,
        NAME: "",
        MONTH: "",
        PRODUCT: "",
        "TRANS / MO": stats.totalTransactionVolume,
        "PROJECTED (YR)": stats.totalProjected,
        "ACTUAL (YR)": stats.totalActual,
        "COMM %": `Avg: ${stats.avgCommission}%`,
        INCENTIVE: stats.totalIncentive,
        "DISBURSE DATE": `Avg Payout: ${stats.avgRate}%`,
      });

      const worksheet = XLSX.utils.json_to_sheet(excelRows);

      // Auto column widths
      worksheet["!cols"] = [
        { wch: 8 },  // SL NO
        { wch: 18 }, // NAME
        { wch: 14 }, // MONTH
        { wch: 28 }, // PRODUCT
        { wch: 16 }, // TRANS / MO
        { wch: 18 }, // PROJECTED (YR)
        { wch: 16 }, // ACTUAL (YR)
        { wch: 12 }, // COMM %
        { wch: 16 }, // INCENTIVE
        { wch: 16 }, // DISBURSE DATE
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Incentives");

      const dateStamp = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `Incentives_Disbursement_Report_${dateStamp}.xlsx`);

      toast.success("Excel file exported successfully!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to generate Excel file.");
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Admin Access Required</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-md">
          The Incentive Management module is strictly reserved for administrators. Please sign in with an administrator account to view this section.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <BadgePercent className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Incentive Tracking & Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
              Admin Exclusive
            </span>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Log employee revenues, track projected & actual commissions, and export disbursements.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => fetchIncentives(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Incentive Entry</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Transaction / Mo</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-slate-800 mt-1">
            {formatCurrency(stats.totalTransactionVolume)}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 inline-block font-medium">
            Across {stats.count} recorded entries
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Projected (Yearly)</span>
            <Calculator className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-teal-700 mt-1">
            {formatCurrency(stats.totalProjected)}
          </p>
          <span className="text-[10px] text-teal-600 font-bold mt-0.5 inline-block">
            Auto-computed (×12)
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Incentives Disbursed</span>
            <IndianRupee className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-indigo-700 mt-1">
            {formatCurrency(stats.totalIncentive)}
          </p>
          <span className="text-[10px] text-indigo-600 font-bold mt-0.5 inline-block">
            Avg Payout: {stats.avgRate}%
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Entries</span>
            <Briefcase className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-slate-800 mt-1">
            {stats.count}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5 inline-block font-medium">
            Matching current filters
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Employee name, month, or product..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-slate-50/50"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Month Filter */}
          <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Product Filter */}
          <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 shrink-0 max-w-[220px]">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer truncate"
            >
              <option value="ALL">All Products</option>
              {availableProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {(searchTerm || selectedMonth !== "ALL" || selectedProduct !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSelectedMonth("ALL");
                setSelectedProduct("ALL");
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
            <p className="text-xs font-semibold">Loading incentive records...</p>
          </div>
        ) : filteredIncentives.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No incentive records found</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your filters or click "Add Incentive Entry" to create one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              {/* Green Header Styled Like Spreadsheet in Screenshot */}
              <thead>
                <tr className="bg-[#84B765] text-white text-[11px] sm:text-xs font-black uppercase tracking-wider border-b-2 border-[#699E4B]">
                  <th className="py-3 px-3 text-center w-12 border-r border-[#96C47A] whitespace-nowrap">
                    SL NO
                  </th>
                  <th className="py-3 px-3.5 border-r border-[#96C47A] min-w-[120px] whitespace-nowrap">
                    NAME
                  </th>
                  <th className="py-3 px-3 border-r border-[#96C47A] min-w-[100px] whitespace-nowrap">
                    MONTH
                  </th>
                  <th className="py-3 px-3.5 border-r border-[#96C47A] min-w-[140px] whitespace-nowrap">
                    PRODUCT
                  </th>
                  <th className="py-3 px-3.5 text-right border-r border-[#96C47A] min-w-[110px] whitespace-nowrap" title="Transaction per Month">
                    TRANS / MO
                  </th>
                  <th className="py-3 px-3.5 text-right border-r border-[#96C47A] min-w-[125px] whitespace-nowrap" title="Projected Income (Yearly) = Transaction × 12">
                    PROJECTED (YR)
                  </th>
                  <th className="py-3 px-3.5 text-right border-r border-[#96C47A] min-w-[120px] whitespace-nowrap" title="Actual Income (Yearly)">
                    ACTUAL (YR)
                  </th>
                  <th className="py-3 px-3 text-center border-r border-[#96C47A] min-w-[80px] whitespace-nowrap" title="Commission Percentage">
                    COMM %
                  </th>
                  <th className="py-3 px-3.5 text-right border-r border-[#96C47A] min-w-[110px] whitespace-nowrap" title="Incentive Amount = Projected × (Commission % ÷ 2)">
                    INCENTIVE
                  </th>
                  <th className="py-3 px-3 text-center border-r border-[#96C47A] min-w-[120px] whitespace-nowrap" title="Disbursement Date">
                    DISBURSE DATE
                  </th>
                  <th className="py-3 px-2 text-center w-18 whitespace-nowrap">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-medium text-slate-700">
                {filteredIncentives.map((item, index) => {
                  const trans = item.transactionPerMonth ?? item.totalIncome ?? 0;
                  const proj = item.projectedIncomeYearly ?? (trans * 12);
                  const actual = item.actualIncomeYearly ?? proj;
                  const comm = item.commissionPercentage ?? 0;

                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-slate-50/80 transition-colors even:bg-slate-50/30"
                    >
                      {/* SL NO */}
                      <td className="py-3 px-3 text-center font-bold text-slate-500 border-r border-slate-100 whitespace-nowrap">
                        {index + 1}
                      </td>

                      {/* NAME */}
                      <td className="py-3 px-3.5 font-bold text-slate-800 border-r border-slate-100 whitespace-nowrap">
                        {formatName(item.employeeName)}
                      </td>

                      {/* MONTH */}
                      <td className="py-3 px-3 font-bold text-slate-600 border-r border-slate-100 uppercase text-xs whitespace-nowrap">
                        {item.month}
                      </td>

                      {/* PRODUCT */}
                      <td className="py-3 px-3.5 border-r border-slate-100 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-indigo-50/90 text-indigo-700 border border-indigo-200/80">
                          {item.product}
                        </span>
                      </td>

                      {/* TRANS / MO */}
                      <td className="py-3 px-3.5 text-right font-black text-slate-800 border-r border-slate-100 whitespace-nowrap">
                        {formatCurrency(trans)}
                      </td>

                      {/* PROJECTED (YR) */}
                      <td className="py-3 px-3.5 text-right font-black text-teal-800 border-r border-slate-100 bg-teal-50/20 whitespace-nowrap">
                        {formatCurrency(proj)}
                      </td>

                      {/* ACTUAL (YR) */}
                      <td className="py-3 px-3.5 text-right font-black text-slate-800 border-r border-slate-100 whitespace-nowrap">
                        {formatCurrency(actual)}
                      </td>

                      {/* COMM % */}
                      <td className="py-3 px-3 text-center font-black text-indigo-700 border-r border-slate-100 bg-indigo-50/30 whitespace-nowrap">
                        {comm ? `${comm}%` : "0%"}
                      </td>

                      {/* INCENTIVE */}
                      <td className="py-3 px-3.5 text-right border-r border-slate-100 bg-amber-50/40 whitespace-nowrap">
                        <span className="font-black text-emerald-700 text-sm">
                          {formatCurrency(item.incentiveAmount)}
                        </span>
                      </td>

                      {/* DISBURSE DATE */}
                      <td className="py-3 px-3 text-center font-semibold text-slate-600 border-r border-slate-100 text-xs whitespace-nowrap">
                        {formatDisbursementDate(item.disbursementDate)}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecordToDelete(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Table Footer: Total Summary */}
              <tfoot>
                <tr className="bg-slate-100/90 font-black text-xs border-t-2 border-slate-200 text-slate-800">
                  <td className="py-3 px-3 text-center text-slate-500 whitespace-nowrap">TOTAL</td>
                  <td className="py-3 px-3.5 whitespace-nowrap" colSpan={3}>
                    {filteredIncentives.length} Transactions
                  </td>
                  <td className="py-3 px-3.5 text-right text-slate-900 font-black whitespace-nowrap">
                    {formatCurrency(stats.totalTransactionVolume)}
                  </td>
                  <td className="py-3 px-3.5 text-right text-teal-800 font-black bg-teal-100/40 whitespace-nowrap">
                    {formatCurrency(stats.totalProjected)}
                  </td>
                  <td className="py-3 px-3.5 text-right text-slate-900 font-black whitespace-nowrap">
                    {formatCurrency(stats.totalActual)}
                  </td>
                  <td className="py-3 px-3 text-center text-indigo-800 font-black bg-indigo-100/40 whitespace-nowrap">
                    Avg {stats.avgCommission}%
                  </td>
                  <td className="py-3 px-3.5 text-right text-emerald-800 font-black bg-amber-100/60 whitespace-nowrap">
                    {formatCurrency(stats.totalIncentive)}
                  </td>
                  <td className="py-3 px-3 text-center text-slate-500 whitespace-nowrap" colSpan={2}>
                    Avg Payout: {stats.avgRate}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Incentive Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs">
                  <BadgePercent className="w-5 h-5 text-emerald-100" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">
                    {editingRecord ? "Edit Incentive Entry" : "New Incentive Entry"}
                  </h3>
                  <p className="text-white/80 text-[11px] sm:text-xs">
                    Configure transaction volume, commission share, and payout computation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Employee <span className="text-rose-500">*</span>
                </label>
                {employees.length > 0 && (
                  <select
                    value={formEmployeeId}
                    onChange={handleEmployeeChange}
                    className="w-full mb-2 p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">-- Select from Active Employees --</option>
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.firstName} {emp.lastName || ""} {emp.employeeCode ? `(#${emp.employeeCode})` : ""} - {emp.department || "No Dept"}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  required
                  value={formEmployeeName}
                  onChange={(e) => setFormEmployeeName(e.target.value.toUpperCase())}
                  placeholder="Or enter employee name (e.g. SASWAT)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase tracking-wide"
                />
              </div>

              {/* Month & Product Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Month */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Month <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formMonth}
                    onChange={(e) => setFormMonth(e.target.value.toUpperCase())}
                    placeholder="e.g. APRIL, 26"
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase"
                  />
                  {/* Month Presets */}
                  <div className="flex gap-1 flex-wrap mt-1">
                    {["APRIL, 26", "MAY, 26", "JUNE, 26", "JULY, 26"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormMonth(p)}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                      >
                        {p.split(",")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Dropdown (12 Fixed Products from User Requirement) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formProduct}
                    onChange={(e) => setFormProduct(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    {INCENTIVE_PRODUCTS.map((prod) => (
                      <option key={prod} value={prod}>
                        {prod}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Select one of the 12 verified investment products
                  </p>
                </div>
              </div>

              {/* Transaction per Month & Projected Income (Yearly) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Transaction per Month */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Transaction / Month (₹) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formTransactionPerMonth}
                      onChange={(e) => handleTransactionChange(e.target.value)}
                      placeholder="e.g. 10000"
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Monthly transaction baseline
                  </p>
                </div>

                {/* Projected Income (Yearly) - Non-Editable */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Projected Income (Yearly) (₹)
                    </label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                      Auto (×12)
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      readOnly
                      tabIndex={-1}
                      value={formProjectedIncomeYearly}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-black text-teal-800 bg-slate-100/80 cursor-not-allowed focus:outline-hidden"
                    />
                  </div>
                  <p className="text-[10px] text-teal-600 font-medium mt-1">
                    Automatically computed as Transaction/Month × 12 (Locked)
                  </p>
                </div>
              </div>

              {/* Actual Income (Yearly) & Commission Percentage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Actual Income (Yearly) - Auto-computed & Editable */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Actual Income (Yearly) (₹) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Editable
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formActualIncomeYearly}
                      onChange={(e) => setFormActualIncomeYearly(e.target.value)}
                      placeholder="e.g. 120000"
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Defaults to Transaction × 12, can be customized by Admin
                  </p>
                </div>

                {/* Commission Percentage (%) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Commission Percentage (%)
                    </label>
                    <span className="text-[10px] font-bold text-slate-500">
                      Admin input
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      %
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formCommissionPercentage}
                      onChange={(e) => handleCommissionChange(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-indigo-700 bg-indigo-50/20 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  {/* Quick percentage buttons */}
                  <div className="flex gap-1 flex-wrap mt-1">
                    {[20, 30, 40, 50, 60, 70].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleQuickCommission(pct)}
                        className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 transition-colors cursor-pointer"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Incentive Amount & Disbursement Date Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Incentive Amount */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Incentive Amount (₹) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      Auto & Editable
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formIncentiveAmount}
                      onChange={(e) => setFormIncentiveAmount(e.target.value)}
                      placeholder="e.g. 25000"
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-black text-emerald-800 bg-amber-50/30 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <p className="text-[10px] text-amber-700 font-medium mt-1">
                    Formula: Projected Income × (Commission % ÷ 2) ÷ 100. Admin can override.
                  </p>
                </div>

                {/* Disbursement Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Disbursement Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDisbursementDate}
                    onChange={(e) => setFormDisbursementDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="Optional notes, client or payout reference..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingRecord ? "Save Changes" : "Create Entry"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-sm p-5 text-center animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">Delete Incentive Entry?</h4>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to remove the incentive record for{" "}
              <span className="font-bold text-slate-700">{formatName(recordToDelete.employeeName)}</span> (
              {recordToDelete.month})? This action cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Incentives;
