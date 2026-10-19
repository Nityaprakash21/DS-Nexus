import mongoose from "mongoose";

const ratingItemSchema = new mongoose.Schema({
    metricId: { type: String, required: true },
    title: { type: String, required: true },
    weight: { type: Number, required: true }, // e.g. 40
    score: { type: Number, required: true, min: 1, max: 5 }, // 1 to 5
    remarks: { type: String, default: "" }
});

const kpaEvaluationSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: "AppraisalCycle", required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "KpaTemplate", required: true },
    teamKey: { type: String, required: true },
    ratings: [ratingItemSchema],
    
    // Calculated Core Fields
    rawWeightedScore: { type: Number, required: true, default: 0 }, // Out of 5.0
    totalDeductions: { type: Number, default: 0 }, // Sum of active Admin deductions
    netScore: { type: Number, required: true, default: 0 }, // max(0, rawWeightedScore - totalDeductions)
    performanceRatio: { type: Number, required: true, default: 0 }, // netScore / 5 (0.0 to 1.0)
    businessGrowthCap: { type: Number, required: true, default: 15 }, // % cap from active cycle
    finalAppraisalPercentage: { type: Number, required: true, default: 0 }, // performanceRatio * businessGrowthCap
    
    // Financial Sync Values
    currentBasicSalary: { type: Number, default: 0 },
    revisedBasicSalary: { type: Number, default: 0 },
    salaryUpdatedInPayroll: { type: Boolean, default: false },

    evaluatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    evaluatorFeedback: { type: String, default: "" },
    
    status: {
        type: String,
        enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
        default: "SUBMITTED"
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date }
}, { timestamps: true });

// Ensure one evaluation per employee per appraisal cycle
kpaEvaluationSchema.index({ employeeId: 1, cycleId: 1 }, { unique: true });

const KpaEvaluation = mongoose.models.KpaEvaluation || mongoose.model("KpaEvaluation", kpaEvaluationSchema);

export default KpaEvaluation;
