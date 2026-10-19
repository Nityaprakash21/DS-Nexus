import mongoose from "mongoose";

const appraisalCycleSchema = new mongoose.Schema({
    yearLabel: { type: String, required: true, unique: true }, // e.g. "FY 2025-2026"
    yoyBusinessGrowthPercentage: { type: Number, required: true, default: 15 }, // Growth Cap percentage (e.g. 15%)
    inflationBasePercentage: { type: Number, default: 0 }, // Optional floor base increment
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    status: {
        type: String,
        enum: ["ACTIVE", "CALIBRATING", "FINALIZED", "ARCHIVED"],
        default: "ACTIVE"
    },
    notes: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

const AppraisalCycle = mongoose.models.AppraisalCycle || mongoose.model("AppraisalCycle", appraisalCycleSchema);

export default AppraisalCycle;
