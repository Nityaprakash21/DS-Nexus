import mongoose from "mongoose";

const adminDeductionSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    cycleYear: { type: String, required: true }, // e.g. "FY 2025-2026"
    deductionScore: { type: Number, required: true, min: 0.05, max: 5 }, // Marks deducted from the 5-point scale (e.g. 0.5)
    reasonCategory: {
        type: String,
        enum: [
            "DATA_ENTRY_ERROR",
            "AMC_REJECTION",
            "SEBI_AMFI_COMPLIANCE_BREACH",
            "SOP_VIOLATION",
            "CLIENT_COMPLAINT",
            "ATTENDANCE_BREACH",
            "DISCIPLINARY",
            "OTHER"
        ],
        required: true
    },
    reasonDetails: { type: String, required: true },
    incidentDate: { type: Date, default: Date.now },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
        type: String,
        enum: ["ACTIVE", "REVERSED"],
        default: "ACTIVE"
    },
    reversalReason: { type: String, default: "" },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

const AdminDeduction = mongoose.models.AdminDeduction || mongoose.model("AdminDeduction", adminDeductionSchema);

export default AdminDeduction;
