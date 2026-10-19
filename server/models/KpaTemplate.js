import mongoose from "mongoose";

const kpaMetricSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    weight: { type: Number, required: true, min: 1, max: 100 }, // e.g. 40 for 40%
    description: { type: String, default: "" },
    evaluatorRole: { type: String, default: "Immediate Manager" },
    rubric: {
        5: { type: String, default: "Outstanding: Consistently exceeds expectations; flawless execution." },
        4: { type: String, default: "Exceeds Expectations: High quality of work, goes beyond basic duties often." },
        3: { type: String, default: "Meets Expectations: Fully satisfactory performance; standard requirements met." },
        2: { type: String, default: "Needs Improvement: Below standard; frequent errors or delays." },
        1: { type: String, default: "Unsatisfactory: Subpar performance; requires immediate corrective action." }
    }
});

const kpaTemplateSchema = new mongoose.Schema({
    teamKey: { 
        type: String, 
        required: true, 
        unique: true,
        enum: ["OPERATIONS", "FIELD_SERVICE", "MANAGEMENT", "CUSTOM"]
    },
    teamName: { type: String, required: true },
    targetDescription: { type: String, default: "" },
    applicableDepartments: [{ type: String }],
    metrics: [kpaMetricSchema],
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const KpaTemplate = mongoose.models.KpaTemplate || mongoose.model("KpaTemplate", kpaTemplateSchema);

export default KpaTemplate;
