import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Loading from "../components/Loading";
import { format } from "date-fns";
import toast from "react-hot-toast";
import api from "../api/axios";
import { Printer, Download, ArrowLeft, ShieldCheck, CheckCircle2, Loader2 } from "lucide-react";
import { generatePayslipPdf } from "../utils/payslipPdfGenerator";
import logo from "../assets/favicon.png";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Helper to convert numbers to Indian Rupee Words
const numberToWords = (num: number): string => {
  if (!num || isNaN(num) || num <= 0) return "Zero Rupees Only";
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const inWords = (n: number): string => {
    if (n === 0) return "";
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : " ");
    if (n < 1000) return a[Math.floor(n / 100)] + "Hundred " + (n % 100 !== 0 ? inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + "Thousand " + (n % 1000 !== 0 ? inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + "Lakh " + (n % 100000 !== 0 ? inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + "Crore " + (n % 10000000 !== 0 ? inWords(n % 10000000) : "");
  };

  const integerPart = Math.floor(num);
  const words = inWords(integerPart).trim();
  return words ? `${words} Rupees Only` : "";
};

const PrintPayslip = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [payslip, setPayslip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get(`/payslips/${id}`)
      .then((res) => {
        setPayslip(res.data);
      })
      .catch((err: any) => {
        toast.error(err.response?.data?.error || err?.message || "Failed to load payslip");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  // Set document title for printing
  useEffect(() => {
    if (payslip) {
      const emp = payslip.employee;
      const empName = emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : "Employee";
      const mName = payslip.monthName || (payslip.month ? MONTH_NAMES[payslip.month - 1] : "Month");
      document.title = `Payslip_${empName.replace(/\s+/g, "_")}_${mName}_${payslip.year || ""}`;
    }
    return () => {
      document.title = "DS-Nexus";
    };
  }, [payslip]);

  // Auto-trigger download if accessed with ?download=1
  useEffect(() => {
    if (payslip && searchParams.get("download") === "1") {
      const timer = setTimeout(() => {
        handleDownloadPdf();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [payslip, searchParams]);

  if (loading) return <Loading />;
  if (!payslip) return <p className="text-center py-12 text-slate-400">Payslip not found</p>;

  const emp = payslip.employee || {};
  const empName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Employee";
  const monthName = payslip.monthName || (payslip.month ? MONTH_NAMES[payslip.month - 1] : "Month");
  const periodText = `${monthName} ${payslip.year}`;

  // Earnings Components
  const earningsBasic = payslip.earnings?.basicSalary ?? payslip.basicSalary ?? 0;
  const earningsIncentive = payslip.earnings?.incentive ?? 0;
  const earningsAllowances = payslip.earnings?.allowances ?? payslip.allowances ?? 0;
  const earningsBonus = payslip.earnings?.bonus ?? 0;
  const earningsCustom: any[] = payslip.earnings?.custom || [];
  const totalEarnings = payslip.earnings?.total ?? (
    earningsBasic + earningsIncentive + earningsAllowances + earningsBonus +
    earningsCustom.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  );

  // Deductions Components
  const deductionsLwp = payslip.deductionsDetail?.lwp ?? 0;
  const deductionsTax = payslip.deductionsDetail?.tax ?? 0;
  const deductionsAdjustments = payslip.deductionsDetail?.adjustments ?? 0;
  const deductionsCustom: any[] = payslip.deductionsDetail?.custom || [];
  const totalDeductions = payslip.deductionsDetail?.total ?? (
    deductionsLwp + deductionsTax + deductionsAdjustments +
    deductionsCustom.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || (payslip.deductions ?? 0)
  );

  // Net Pay = Total Earnings - Total Deductions
  const netSalary = payslip.netSalary ?? Math.max(0, totalEarnings - totalDeductions);
  const netSalaryInWords = numberToWords(netSalary);

  // Direct PDF Download Handler
  const handleDownloadPdf = () => {
    setDownloading(true);
    const toastId = toast.loading("Generating Payslip PDF...");
    try {
      generatePayslipPdf({
        payslip,
        emp,
        empName,
        monthName,
        periodText,
        totalEarnings,
        totalDeductions,
        netSalary,
        netSalaryInWords,
        earningsBasic,
        earningsIncentive,
        earningsAllowances,
        earningsBonus,
        earningsCustom,
        deductionsLwp,
        deductionsTax,
        deductionsAdjustments,
        deductionsCustom,
      });
      toast.success("Payslip PDF downloaded successfully!", { id: toastId });
    } catch (err: any) {
      console.error("PDF download error:", err);
      toast.error(err?.message || "Failed to generate PDF. Try 'Print PDF' instead.", { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0">
      {/* Top Action Toolbar (Hidden during Print / PDF generation) */}
      <div className="max-w-4xl mx-auto mb-5 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
        <button
          type="button"
          onClick={() => navigate("/payslips")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3.5 py-2 rounded-lg shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Payslips
        </button>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Download PDF Button */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex items-center justify-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-60 flex-1 sm:flex-initial"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? "Generating PDF..." : "Download PDF"}
          </button>

          {/* Print PDF Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 px-4 py-2 rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer flex-1 sm:flex-initial"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Print PDF
          </button>
        </div>
      </div>

      {/* Main Printable Document Card */}
      <div
        id="payslip-printable-content"
        ref={printableRef}
        className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-10 print:shadow-none print:border-0 print:p-2 print:m-0 print:max-w-full text-slate-800 text-xs font-sans"
      >
        {/* Company Header */}
        <div className="border-b-2 border-slate-800 pb-5 mb-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-3.5">
                <img
                  id="payslip-company-logo"
                  src={logo}
                  alt="DS Investment Logo"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain border border-slate-200 bg-white p-1.5 shadow-2xs shrink-0"
                />
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    DS INVESTMENT
                  </h1>
                  <p className="text-xs text-slate-500 font-semibold tracking-wide">
                    Powered by Trust. Driven by Growth.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 rounded font-bold text-xs uppercase tracking-wider border border-slate-200 print:border-slate-400">
                PAYSLIP
              </span>
              <p className="text-xs font-bold text-indigo-700 print:text-slate-900 mt-1.5">
                {periodText}
              </p>
              <p className="text-[10px] text-slate-400">
                Issue Date: {payslip.paymentDate ? format(new Date(payslip.paymentDate), "dd MMM yyyy") : format(new Date(), "dd MMM yyyy")}
              </p>
            </div>
          </div>
        </div>

        {/* Employee Summary Details Grid */}
        <div className="bg-slate-50/90 rounded-lg border border-slate-200 p-4 mb-6 print:bg-white print:border-slate-300">
          <h2 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-3 border-b border-slate-200/60 pb-1.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 print:text-slate-700" />
            Employee Information
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-4 text-xs">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Employee Name
              </span>
              <span className="font-bold text-slate-900 text-sm">{empName}</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Employee Code / ID
              </span>
              <span className="font-medium text-slate-800">
                {emp.employeeCode || (emp._id ? `EMP-${String(emp._id).slice(-5).toUpperCase()}` : "N/A")}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Position / Designation
              </span>
              <span className="font-medium text-slate-800">{emp.position || "Employee"}</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Department
              </span>
              <span className="font-medium text-slate-800">{emp.department || "General"}</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Pay Period
              </span>
              <span className="font-bold text-slate-900">{periodText}</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Official Email
              </span>
              <span className="font-medium text-slate-800 truncate block">{emp.email || "N/A"}</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                PAN Number
              </span>
              <span className="font-medium text-slate-800 font-mono">
                {emp.panNumber || "—"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Aadhar Number
              </span>
              <span className="font-medium text-slate-800 font-mono">
                {emp.aadharNumber ? `•••• •••• ${String(emp.aadharNumber).slice(-4)}` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* TWO SECTIONS: EARNINGS & DEDUCTIONS BREAKDOWN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* SECTION 1: EARNINGS */}
          <div className="rounded-lg border border-slate-200 overflow-hidden flex flex-col justify-between print:border-slate-300">
            <div>
              <div className="bg-emerald-50/90 border-b border-emerald-100 px-4 py-2.5 flex justify-between items-center print:bg-slate-100 print:border-slate-300">
                <span className="font-black text-emerald-900 text-xs uppercase tracking-wider print:text-slate-900">
                  Earnings (Components)
                </span>
                <span className="font-bold text-emerald-800 text-xs print:text-slate-900">
                  Amount (₹)
                </span>
              </div>

              <table className="w-full text-xs">
                <tbody>
                  {/* Basic Salary */}
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-4 text-slate-700 font-medium">Basic Salary</td>
                    <td className="py-2 px-4 text-right font-semibold text-slate-900">
                      ₹{earningsBasic.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Incentive */}
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-4 text-slate-700 font-medium">Incentive</td>
                    <td className="py-2 px-4 text-right font-semibold text-slate-900">
                      ₹{earningsIncentive.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Allowances */}
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-4 text-slate-700 font-medium">Allowances</td>
                    <td className="py-2 px-4 text-right font-semibold text-slate-900">
                      ₹{earningsAllowances.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Bonus */}
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-4 text-slate-700 font-medium">Bonus</td>
                    <td className="py-2 px-4 text-right font-semibold text-slate-900">
                      ₹{earningsBonus.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Additional / Custom Earning Components */}
                  {earningsCustom.map((comp: any, idx: number) => (
                    <tr key={`custom-earn-${idx}`} className="border-b border-slate-100 bg-emerald-50/20 print:bg-white">
                      <td className="py-2 px-4 text-slate-700 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 print:bg-slate-700"></span>
                        {comp.name}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-slate-900">
                        ₹{Number(comp.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Earnings Footer */}
            <div className="bg-slate-50 border-t-2 border-slate-200 px-4 py-2.5 flex justify-between items-center print:bg-slate-100 print:border-slate-300">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Total Earnings (A)
              </span>
              <span className="font-black text-emerald-700 text-sm print:text-slate-900">
                ₹{totalEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* SECTION 2: DEDUCTIONS */}
          <div className="rounded-lg border border-slate-200 overflow-hidden flex flex-col justify-between print:border-slate-300">
            <div>
              <div className="bg-rose-50/90 border-b border-rose-100 px-4 py-2.5 flex justify-between items-center print:bg-slate-100 print:border-slate-300">
                <span className="font-black text-rose-900 text-xs uppercase tracking-wider print:text-slate-900">
                  Deductions (Components)
                </span>
                <span className="font-bold text-rose-800 text-xs print:text-slate-900">
                  Amount (₹)
                </span>
              </div>

              <table className="w-full text-xs">
                <tbody>
                  {/* Leave Without Pay (LWP) */}
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-4 text-slate-700 font-medium">Leave Without Pay (LWP)</td>
                    <td className="py-2 px-4 text-right font-semibold text-rose-600 print:text-slate-900">
                      ₹{deductionsLwp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Tax / TDS */}
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-4 text-slate-700 font-medium">Tax / TDS</td>
                    <td className="py-2 px-4 text-right font-semibold text-rose-600 print:text-slate-900">
                      ₹{deductionsTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Adjustments */}
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-4 text-slate-700 font-medium">Adjustments</td>
                    <td className="py-2 px-4 text-right font-semibold text-rose-600 print:text-slate-900">
                      ₹{deductionsAdjustments.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>

                  {/* Additional / Custom Deduction Components */}
                  {deductionsCustom.map((comp: any, idx: number) => (
                    <tr key={`custom-ded-${idx}`} className="border-b border-slate-100 bg-rose-50/20 print:bg-white">
                      <td className="py-2 px-4 text-slate-700 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 print:bg-slate-700"></span>
                        {comp.name}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-rose-600 print:text-slate-900">
                        ₹{Number(comp.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}

                  {/* Empty placeholder spacer if no custom deductions to keep columns visually aligned */}
                  {deductionsCustom.length === 0 && (
                    <tr className="border-b border-slate-100 opacity-0 select-none print:hidden">
                      <td className="py-2 px-4">—</td>
                      <td className="py-2 px-4 text-right">—</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Deductions Footer */}
            <div className="bg-slate-50 border-t-2 border-slate-200 px-4 py-2.5 flex justify-between items-center print:bg-slate-100 print:border-slate-300">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Total Deductions (B)
              </span>
              <span className="font-black text-rose-700 text-sm print:text-slate-900">
                ₹{totalDeductions.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* NET SALARY PAYABLE SUMMARY BANNER */}
        <div className="bg-slate-900 text-white rounded-lg p-4 sm:p-5 mb-6 border border-slate-800 shadow-xs print:bg-slate-50 print:text-slate-900 print:border-slate-400">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 print:text-slate-600 block">
                Net Salary Payable (Total Earnings − Total Deductions)
              </span>
              <div className="text-xs text-slate-300 print:text-slate-700 mt-0.5 flex items-center gap-2 font-mono">
                <span>Earnings: ₹{totalEarnings.toLocaleString("en-IN")}</span>
                <span>−</span>
                <span>Deductions: ₹{totalDeductions.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-xs font-semibold text-emerald-300 print:text-slate-900 mt-2 italic">
                Amount in Words: <span className="font-normal text-white print:text-slate-900">{netSalaryInWords}</span>
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 print:text-slate-900 font-mono block">
                ₹{netSalary.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 print:text-slate-700 font-medium mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Disbursed / Payable
              </span>
            </div>
          </div>
        </div>

        {/* Note (Signatures removed) */}
        <div className="pt-5 border-t border-slate-200 text-[11px] text-slate-500 text-center">
          <p className="italic">
            Note: This is a computer-generated monthly payslip issued by DS Investment. All statutory taxes, LWP, and compensation components have been calculated as per company policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrintPayslip;