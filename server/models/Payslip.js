import mongoose from "mongoose";

const componentItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    amount: { type: Number, required: true, default: 0 }
}, { _id: false });

const payslipSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    month: { type: Number, required: true },
    monthName: { type: String, default: "" },
    year: { type: Number, required: true },
    
    // Top-level summary numbers (maintained for backwards compatibility)
    basicSalary: { type: Number, required: true, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true, default: 0 },

    // Detailed Earnings Breakdown
    earnings: {
        basicSalary: { type: Number, default: 0 },
        incentive: { type: Number, default: 0 },
        allowances: { type: Number, default: 0 },
        bonus: { type: Number, default: 0 },
        custom: [componentItemSchema],
        total: { type: Number, default: 0 }
    },

    // Detailed Deductions Breakdown
    deductionsDetail: {
        lwp: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        adjustments: { type: Number, default: 0 },
        custom: [componentItemSchema],
        total: { type: Number, default: 0 }
    },

    paymentDate: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

payslipSchema.index({ employeeId: 1, year: -1, month: -1 });

const Payslip = mongoose.models.Payslip || mongoose.model("Payslip", payslipSchema);

export default Payslip;