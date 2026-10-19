import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    authorName: {
        type: String,
        required: true,
        trim: true
    },
    authorRole: {
        type: String,
        enum: ["ADMIN", "EMPLOYEE"],
        default: "EMPLOYEE"
    },
    authorDepartment: {
        type: String,
        default: "General"
    },
    authorEmail: {
        type: String,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ["Workplace & Facility", "Process & Operations", "IT & Tools", "HR & Culture", "General"],
        default: "General"
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ["PENDING", "IMPLEMENTED", "NOT_IMPLEMENTED", "VALUABLE"],
        default: "PENDING"
    },
    adminRemark: {
        type: String,
        default: "",
        trim: true
    },
    markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    markedAt: {
        type: Date
    }
}, { timestamps: true });

const Feedback = mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema);

export default Feedback;
