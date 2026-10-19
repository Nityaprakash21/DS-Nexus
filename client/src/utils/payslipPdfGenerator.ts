import { jsPDF } from "jspdf";

interface GeneratePdfParams {
  payslip: any;
  emp: any;
  empName: string;
  monthName: string;
  periodText: string;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  netSalaryInWords: string;
  earningsBasic: number;
  earningsIncentive: number;
  earningsAllowances: number;
  earningsBonus: number;
  earningsCustom: any[];
  deductionsLwp: number;
  deductionsTax: number;
  deductionsAdjustments: number;
  deductionsCustom: any[];
}

const formatCurrency = (val: number): string => {
  return "Rs. " + (Number(val) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const generatePayslipPdf = ({
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
}: GeneratePdfParams): void => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const leftMargin = 14;
  const rightMargin = 196;
  const contentWidth = rightMargin - leftMargin; // 182mm

  // -------------------------------------------------------------
  // 1. COMPANY HEADER
  // -------------------------------------------------------------
  // Logo: Render larger favicon logo from DOM or fallback badge
  let hasDrawnLogo = false;
  try {
    const logoEl = typeof document !== "undefined" ? (document.getElementById("payslip-company-logo") as HTMLImageElement) : null;
    if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
      (doc as any).addImage(logoEl, "PNG", leftMargin, 11, 14, 14);
      hasDrawnLogo = true;
    }
  } catch (e) {
    console.warn("Could not embed logo image in PDF:", e);
  }

  if (!hasDrawnLogo) {
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.roundedRect(leftMargin, 11, 14, 14, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text("DSI", leftMargin + 7, 19.5, { align: "center" });
  }

  // Company Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("DS INVESTMENT", leftMargin + 17, 18);

  // Company Subtitle / Tagline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("Powered by Trust. Driven by Growth.", leftMargin + 17, 23);

  // Right Header: Badge + Period + Date
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(rightMargin - 26, 13, 26, 5.5, 1, 1, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85); // slate-700
  doc.text("PAYSLIP", rightMargin - 13, 17, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text(periodText, rightMargin, 23, { align: "right" });

  const issueDate = payslip.paymentDate
    ? new Date(payslip.paymentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Issue Date: ${issueDate}`, rightMargin, 27, { align: "right" });

  // Divider Line
  doc.setDrawColor(15, 23, 42); // slate-900
  doc.setLineWidth(0.6);
  doc.line(leftMargin, 30, rightMargin, 30);

  // -------------------------------------------------------------
  // 2. EMPLOYEE INFORMATION CARD
  // -------------------------------------------------------------
  const empBoxY = 33;
  const empBoxHeight = 27;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.25);
  doc.roundedRect(leftMargin, empBoxY, contentWidth, empBoxHeight, 2, 2, "FD");

  // Section Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text("EMPLOYEE INFORMATION", leftMargin + 4, empBoxY + 5);
  doc.setDrawColor(226, 232, 240);
  doc.line(leftMargin + 4, empBoxY + 6.5, rightMargin - 4, empBoxY + 6.5);

  const col1 = leftMargin + 4;
  const col2 = leftMargin + 50;
  const col3 = leftMargin + 98;
  const col4 = leftMargin + 142;

  // Row 1
  const r1LabelY = empBoxY + 10.5;
  const r1ValY = empBoxY + 14.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("EMPLOYEE NAME", col1, r1LabelY);
  doc.text("EMPLOYEE CODE / ID", col2, r1LabelY);
  doc.text("POSITION / DESIGNATION", col3, r1LabelY);
  doc.text("DEPARTMENT", col4, r1LabelY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(empName, col1, r1ValY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(String(emp.employeeCode || (emp._id ? `EMP-${String(emp._id).slice(-5).toUpperCase()}` : "N/A")), col2, r1ValY);
  doc.text(String(emp.position || "Employee"), col3, r1ValY);
  doc.text(String(emp.department || "Operations"), col4, r1ValY);

  // Row 2
  const r2LabelY = empBoxY + 19;
  const r2ValY = empBoxY + 23;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("PAY PERIOD", col1, r2LabelY);
  doc.text("OFFICIAL EMAIL", col2, r2LabelY);
  doc.text("PAN NUMBER", col3, r2LabelY);
  doc.text("AADHAR NUMBER", col4, r2LabelY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(periodText, col1, r2ValY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(String(emp.email || "N/A"), col2, r2ValY);
  doc.text(String(emp.panNumber || "—"), col3, r2ValY);
  const aadharMasked = emp.aadharNumber ? `•••• •••• ${String(emp.aadharNumber).slice(-4)}` : "—";
  doc.text(aadharMasked, col4, r2ValY);

  // -------------------------------------------------------------
  // 3. EARNINGS & DEDUCTIONS TABLES
  // -------------------------------------------------------------
  const tableStartY = 64;
  const tableWidth = 88; // each table width
  const leftTableX = leftMargin; // 14
  const rightTableX = leftMargin + tableWidth + 6; // 108

  // Build rows for Earnings
  const earningsList: { name: string; amount: number }[] = [
    { name: "Basic Salary", amount: earningsBasic },
    { name: "Incentive", amount: earningsIncentive },
    { name: "Allowances", amount: earningsAllowances },
    { name: "Bonus", amount: earningsBonus },
    ...earningsCustom.map((c) => ({ name: c.name, amount: Number(c.amount) || 0 })),
  ];

  // Build rows for Deductions
  const deductionsList: { name: string; amount: number }[] = [
    { name: "Leave Without Pay (LWP)", amount: deductionsLwp },
    { name: "Tax / TDS", amount: deductionsTax },
    { name: "Adjustments", amount: deductionsAdjustments },
    ...deductionsCustom.map((c) => ({ name: c.name, amount: Number(c.amount) || 0 })),
  ];

  const maxRows = Math.max(earningsList.length, deductionsList.length);
  const rowHeight = 6.2;
  const headerHeight = 7.5;
  const footerHeight = 8;
  const tableBodyHeight = maxRows * rowHeight;
  const totalTableHeight = headerHeight + tableBodyHeight + footerHeight;

  // Background card borders
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(leftTableX, tableStartY, tableWidth, totalTableHeight, 1.5, 1.5, "S");
  doc.roundedRect(rightTableX, tableStartY, tableWidth, totalTableHeight, 1.5, 1.5, "S");

  // Headers
  // Earnings Header
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.rect(leftTableX + 0.25, tableStartY + 0.25, tableWidth - 0.5, headerHeight, "F");
  doc.setDrawColor(209, 250, 229); // emerald-100
  doc.line(leftTableX, tableStartY + headerHeight, leftTableX + tableWidth, tableStartY + headerHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text("EARNINGS (COMPONENTS)", leftTableX + 4, tableStartY + 5);
  doc.text("Amount (Rs.)", leftTableX + tableWidth - 4, tableStartY + 5, { align: "right" });

  // Deductions Header
  doc.setFillColor(255, 241, 242); // rose-50
  doc.rect(rightTableX + 0.25, tableStartY + 0.25, tableWidth - 0.5, headerHeight, "F");
  doc.setDrawColor(254, 205, 211); // rose-100
  doc.line(rightTableX, tableStartY + headerHeight, rightTableX + tableWidth, tableStartY + headerHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(159, 18, 57); // rose-800
  doc.text("DEDUCTIONS (COMPONENTS)", rightTableX + 4, tableStartY + 5);
  doc.text("Amount (Rs.)", rightTableX + tableWidth - 4, tableStartY + 5, { align: "right" });

  // Rows rendering
  for (let i = 0; i < maxRows; i++) {
    const rowY = tableStartY + headerHeight + i * rowHeight;

    // Row divider lines
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.line(leftTableX, rowY + rowHeight, leftTableX + tableWidth, rowY + rowHeight);
    doc.line(rightTableX, rowY + rowHeight, rightTableX + tableWidth, rowY + rowHeight);

    // Earnings Row
    if (i < earningsList.length) {
      const item = earningsList[i];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text(item.name, leftTableX + 4, rowY + 4.2);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(formatCurrency(item.amount), leftTableX + tableWidth - 4, rowY + 4.2, { align: "right" });
    }

    // Deductions Row
    if (i < deductionsList.length) {
      const item = deductionsList[i];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(item.name, rightTableX + 4, rowY + 4.2);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text(formatCurrency(item.amount), rightTableX + tableWidth - 4, rowY + 4.2, { align: "right" });
    }
  }

  // Footer / Totals
  const footerY = tableStartY + headerHeight + tableBodyHeight;

  // Earnings Total Footer
  doc.setFillColor(248, 250, 252);
  doc.rect(leftTableX + 0.25, footerY, tableWidth - 0.5, footerHeight - 0.25, "F");
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.35);
  doc.line(leftTableX, footerY, leftTableX + tableWidth, footerY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text("TOTAL EARNINGS (A)", leftTableX + 4, footerY + 5.2);

  doc.setFontSize(8.5);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(formatCurrency(totalEarnings), leftTableX + tableWidth - 4, footerY + 5.2, { align: "right" });

  // Deductions Total Footer
  doc.setFillColor(248, 250, 252);
  doc.rect(rightTableX + 0.25, footerY, tableWidth - 0.5, footerHeight - 0.25, "F");
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.line(rightTableX, footerY, rightTableX + tableWidth, footerY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text("TOTAL DEDUCTIONS (B)", rightTableX + 4, footerY + 5.2);

  doc.setFontSize(8.5);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(formatCurrency(totalDeductions), rightTableX + tableWidth - 4, footerY + 5.2, { align: "right" });

  // -------------------------------------------------------------
  // 4. NET SALARY PAYABLE SUMMARY CARD
  // -------------------------------------------------------------
  const netCardY = tableStartY + totalTableHeight + 6;
  const netCardHeight = 22;

  // Dark background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(leftMargin, netCardY, contentWidth, netCardHeight, 2, 2, "F");

  // Left Title & Formula
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("NET SALARY PAYABLE (TOTAL EARNINGS - TOTAL DEDUCTIONS)", leftMargin + 6, netCardY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // slate-300
  const formulaStr = `Earnings: ${formatCurrency(totalEarnings)}   -   Deductions: ${formatCurrency(totalDeductions)}`;
  doc.text(formulaStr, leftMargin + 6, netCardY + 11.5);

  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 231, 183); // emerald-300
  doc.text(`Amount in Words: `, leftMargin + 6, netCardY + 17);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(netSalaryInWords, leftMargin + 32, netCardY + 17);

  // Right Net Amount
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text(formatCurrency(netSalary), rightMargin - 6, netCardY + 12, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 231, 183);
  doc.text("[✓] Disbursed / Payable", rightMargin - 6, netCardY + 17, { align: "right" });

  // -------------------------------------------------------------
  // 5. FOOTER NOTE (Signatures removed)
  // -------------------------------------------------------------
  const noteY = netCardY + netCardHeight + 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const noteText = "Note: This is a computer-generated monthly payslip issued by DS Investment. All statutory taxes, LWP, and compensation components have been calculated as per company policy.";
  doc.text(noteText, (leftMargin + rightMargin) / 2, noteY, { align: "center", maxWidth: contentWidth });

  // Save the PDF
  const sanitizedName = empName.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `Payslip_${sanitizedName}_${monthName}_${payslip.year}.pdf`;
  doc.save(fileName);
};
