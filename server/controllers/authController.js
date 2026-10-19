import User from "../models/User.js";
import Employee from "../models/Employee.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import "dotenv";
import { logActivity } from "../utils/activityLogger.js";

// Login for employee and admin
//POST /api/auth/login
export const login = async (req, res) => {
    try {
        const { email, password, role_type } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and Password are required" })
        }
        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") } });
        if (!user) {
            logActivity({
                req,
                userName: "UNKNOWN USER",
                userRole: role_type === "admin" ? "ADMIN" : "EMPLOYEE",
                category: "AUTH",
                action: "LOGIN_FAILED",
                description: "Failed login attempt: Account not found",
                status: "FAILED",
                metadata: { role_type }
            });
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Resolve clean employee or admin display name
        let resolvedDisplayName = user.name || "";
        let employeeRecord = null;
        if (user.role === "EMPLOYEE" || !resolvedDisplayName) {
            employeeRecord = await Employee.findOne({ userId: user._id }).select("_id employeeCode firstName lastName isDeleted").lean();
            if (employeeRecord) {
                resolvedDisplayName = `${employeeRecord.firstName} ${employeeRecord.lastName || ""}`.trim();
            }
        }
        if (!resolvedDisplayName) {
            resolvedDisplayName = user.role === "ADMIN" ? "ADMIN" : "EMPLOYEE";
        }

        // Gatekeeper: Reject login for deactivated / deleted user or employee accounts
        if (user.isDeleted || employeeRecord?.isDeleted) {
            logActivity({
                req,
                userId: user._id,
                employeeId: employeeRecord?._id || null,
                userName: resolvedDisplayName,
                userRole: user.role,
                category: "AUTH",
                action: "LOGIN_DENIED",
                description: `Deactivated account login attempt by ${resolvedDisplayName}`,
                status: "WARNING",
                metadata: { role_type }
            });
            return res.status(403).json({ error: "Your account has been deactivated. Please contact HR or your Administrator." });
        }

        if (role_type === "admin" && user.role !== "ADMIN") {
            logActivity({
                req,
                userId: user._id,
                employeeId: employeeRecord?._id || null,
                userName: resolvedDisplayName,
                userRole: user.role,
                category: "AUTH",
                action: "LOGIN_DENIED",
                description: `Unauthorized admin portal login attempt by ${resolvedDisplayName}`,
                status: "WARNING",
                metadata: { role_type, actualRole: user.role }
            });
            return res.status(401).json({ error: "Not authorized as admin" });
        }
        if (role_type === "employee" && user.role !== "EMPLOYEE") {
            return res.status(401).json({ error: "Not authorized as employee" });
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            logActivity({
                req,
                userId: user._id,
                employeeId: employeeRecord?._id || null,
                userName: resolvedDisplayName,
                userRole: user.role,
                category: "AUTH",
                action: "LOGIN_FAILED",
                description: `Failed login attempt: Incorrect password for ${resolvedDisplayName}`,
                status: "FAILED",
                metadata: { role_type }
            });
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const payload = {
            userId: user._id.toString(),
            role: user.role,
            email: user.email,
        };

        let displayName = user.name || user.email.split("@")[0];
        let employeeId = null;

        if (user.role === "EMPLOYEE") {
            const emp = employeeRecord || await Employee.findOne({ userId: user._id }).select("_id employeeCode firstName lastName").lean();
            if (emp) {
                payload.employeeCode = emp.employeeCode;
                payload.firstName = emp.firstName;
                payload.lastName = emp.lastName;
                displayName = `${emp.firstName} ${emp.lastName || ""}`.trim();
                employeeId = emp._id;
            }
        }

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

        // Log successful login
        logActivity({
            req,
            userId: user._id,
            employeeId,
            userName: displayName,
            userRole: user.role,
            category: "AUTH",
            action: "USER_LOGIN",
            description: `${displayName} successfully logged in as ${user.role}`,
            status: "SUCCESS",
            metadata: { role: user.role }
        });

        return res.json({ user: payload, token });
    } catch (error) {
        console.error("Login error: ", error);
        return res.status(500).json({ error: "Failed to login" })
    }
}

// GET Session for employee and admin
// GET /api/auth/session
export const session = async (req, res) => {
    const session = req.session;
    if (session && session.role === "EMPLOYEE" && !session.employeeCode) {
        try {
            const emp = await Employee.findOne({ userId: session.userId }).select("employeeCode firstName lastName").lean();
            if (emp) {
                session.employeeCode = emp.employeeCode;
                session.firstName = emp.firstName;
                session.lastName = emp.lastName;
            }
        } catch (e) {
            console.error("Session employee lookup error:", e);
        }
    }
    return res.json({ user: session })
}

//Change password for employee and admin
// POST /api/auth/change-password
export const changePassword = async (req, res) => {
    try {
        const session = req.session;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Both Passwords are required" });
        }
        const user = await User.findById(session.userId);
        if (!user) return res.status(401).json({ error: "User not found" });
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) return res.status(400).json({ error: "Current password is incorrect" });
        const hashed = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(session.userId, { password: hashed });

        let empName = user.name || "";
        let employeeId = null;
        if (session.role === "EMPLOYEE" || !empName) {
            const emp = await Employee.findOne({ userId: session.userId }).select("_id firstName lastName").lean();
            if (emp) {
                empName = `${emp.firstName} ${emp.lastName || ""}`.trim();
                employeeId = emp._id;
            }
        }
        if (!empName) empName = session.role === "ADMIN" ? "ADMIN" : "EMPLOYEE";

        logActivity({
            req,
            userId: session.userId,
            employeeId,
            userName: empName,
            userRole: session.role,
            category: "AUTH",
            action: "PASSWORD_CHANGED",
            description: `User ${empName} changed their password`,
            status: "SUCCESS"
        });

        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: "Failed to change password" });
    }
}
