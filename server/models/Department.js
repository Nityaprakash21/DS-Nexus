import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
    {
        departmentId: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true
        },
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        description: {
            type: String,
            default: "",
            trim: true
        },
        color: {
            type: String,
            default: "indigo" // indigo, emerald, blue, amber, rose, purple, cyan, slate
        },
        isDefault: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

const Department = mongoose.models.Department || mongoose.model("Department", departmentSchema);

export default Department;
