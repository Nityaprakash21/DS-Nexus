import "dotenv/config";
import connectDB from "./config/db.js";
import bcrypt from "bcrypt";
import User from "./models/User.js"

const TemporaryPassword = "admin123";

async function registerAdmin() {
    try {
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
        if (!ADMIN_EMAIL) {
            console.error("MIssing Admin Email env Variable");
            process.exit(1);
        }
        await connectDB();
        const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
        if (existingAdmin) {
            console.log("User already exists as role", existingAdmin.role);
            process.exit(0);
        }
        const hashedpassword = await bcrypt.hash(TemporaryPassword, 10);
        const admin = await User.create({
            email: process.env.ADMIN_EMAIL,
            password: hashedpassword,
            role: "ADMIN",
        });
        console.log("Admin user created");
        console.log("\nEmail: ", admin.email);
        console.log("Password", TemporaryPassword);
        console.log("\nChange the password after login");
        process.exit(0);
    } catch (error) {
        console.error("Failed to create admin user:", error);
        process.exit(1);
    }
}

registerAdmin();