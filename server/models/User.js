import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "EMPLOYEE"], default: "EMPLOYEE" },
    isDeleted: { type: Boolean, default: false },
    name: { type: String, default: "" },
    bio: { type: String, default: "" },
    phone: { type: String, default: "" },
    highestQualification: { type: String, default: "" },
    passOutYear: { type: String, default: "" },
    certification: { type: String, default: "" },
    certificationValidity: { type: String, default: "" },
    panNumber: { type: String, default: "", trim: true },
    aadharNumber: { type: String, default: "", trim: true }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
