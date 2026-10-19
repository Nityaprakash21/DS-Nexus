import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    position: { type: String, required: true },
    basicSalary: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    employmentStatus: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    joinDate: { type: Date, required: true },
    isDeleted: { type: Boolean, default: false },
    deactivationDate: { type: Date, default: null },
    bio: { type: String, default: "" },
    department: { type: String, trim: true },
    employeeCode: { type: String, unique: true, sparse: true, index: true },
    highestQualification: { type: String, default: "" },
    passOutYear: { type: String, default: "" },
    certification: { type: String, default: "" },
    certificationValidity: { type: String, default: "" },
    panNumber: { type: String, default: "", trim: true },
    aadharNumber: { type: String, default: "", trim: true },
    isLocationExempt: { type: Boolean, default: false }
}, { timestamps: true });

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

export default Employee;