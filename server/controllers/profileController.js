import Employee from "../models/Employee.js";
import User from "../models/User.js";
import { logActivity } from "../utils/activityLogger.js";

// GET profile
// GET /api/profile
export const getProfile = async (req, res) => {
    try {
        const session = req.session;
        const employee = await Employee.findOne({ userId: session.userId });
        if (!employee) {
            // Authenticated user is an Admin
            const user = await User.findById(session.userId);
            
            // Format fallback name from email if not explicitly set
            let displayName = user?.name || "";
            if (!displayName && session.email) {
                const prefix = session.email.split("@")[0].replace(/[0-9_.-]+/g, " ").trim();
                displayName = prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : "Admin";
            }
            if (!displayName) displayName = "Admin";

            return res.json({
                firstName: displayName,
                lastName: "",
                name: displayName,
                email: session.email,
                position: "Administrator",
                bio: user?.bio || "",
                phone: user?.phone || "",
                highestQualification: user?.highestQualification || "",
                passOutYear: user?.passOutYear || "",
                certification: user?.certification || "",
                certificationValidity: user?.certificationValidity || "",
                panNumber: user?.panNumber || "",
                aadharNumber: user?.aadharNumber || "",
                isAdmin: true
            });
        }

        const employeeObj = employee.toObject ? employee.toObject() : { ...employee };
        employeeObj.isAdmin = session.role === "ADMIN";
        return res.json(employeeObj);
    } catch (error) {
        console.error("Failed to get profile:", error);
        res.status(500).json({ error: "Failed to get profile" });
    }
};

// UPDATE profile
// POST /api/profile or PUT /api/profile
export const updateProfile = async (req, res) => {
    try {
        const session = req.session;
        const isAdmin = session.role === "ADMIN";
        const employee = await Employee.findOne({ userId: session.userId });

        const {
            name,
            firstName,
            bio,
            phone,
            highestQualification,
            passOutYear,
            certification,
            certificationValidity,
            panNumber,
            aadharNumber
        } = req.body;

        if (!employee) {
            // Authenticated user is an Admin without employee document
            const updatedName = name || firstName;
            const updateFields = {
                ...(updatedName && { name: updatedName.trim() }),
                ...(bio !== undefined && { bio }),
                ...(phone !== undefined && { phone }),
                ...(highestQualification !== undefined && { highestQualification }),
                ...(passOutYear !== undefined && { passOutYear }),
                ...(certification !== undefined && { certification }),
                ...(certificationValidity !== undefined && { certificationValidity }),
                ...(panNumber !== undefined && { panNumber: panNumber.trim().toUpperCase() }),
                ...(aadharNumber !== undefined && { aadharNumber: aadharNumber.trim() })
            };

            await User.findByIdAndUpdate(session.userId, updateFields);

            logActivity({
                req,
                userId: session.userId,
                userName: updatedName || session.email,
                userEmail: session.email,
                userRole: "ADMIN",
                category: "PROFILE",
                action: "PROFILE_UPDATED",
                description: `Admin updated profile settings`,
                metadata: updateFields
            });

            return res.json({ success: true, message: "Admin profile updated" });
        }

        if (employee.isDeleted) {
            return res.status(403).json({ error: "Your account is deactivated. You cannot update your profile." });
        }

        const employeeUpdates = {};
        if (bio !== undefined) employeeUpdates.bio = bio;
        if (phone !== undefined) employeeUpdates.phone = phone;
        if (highestQualification !== undefined) employeeUpdates.highestQualification = highestQualification;
        if (passOutYear !== undefined) employeeUpdates.passOutYear = passOutYear;
        if (certification !== undefined) employeeUpdates.certification = certification;
        if (certificationValidity !== undefined) employeeUpdates.certificationValidity = certificationValidity;

        // PAN: Admin can always update. Employee can update ONCE if not already provided.
        const currentPan = employee.panNumber ? employee.panNumber.trim() : "";
        if (isAdmin) {
            if (panNumber !== undefined) employeeUpdates.panNumber = panNumber.trim().toUpperCase();
        } else if (!currentPan && panNumber && panNumber.trim()) {
            employeeUpdates.panNumber = panNumber.trim().toUpperCase();
        }

        // Aadhar: Admin can always update. Employee can update ONCE if not already provided.
        const currentAadhar = employee.aadharNumber ? employee.aadharNumber.trim() : "";
        if (isAdmin) {
            if (aadharNumber !== undefined) employeeUpdates.aadharNumber = aadharNumber.trim();
        } else if (!currentAadhar && aadharNumber && aadharNumber.trim()) {
            employeeUpdates.aadharNumber = aadharNumber.trim();
        }

        await Employee.findByIdAndUpdate(employee._id, employeeUpdates);

        // Also update User document
        const userUpdates = { ...employeeUpdates };
        if (name && isAdmin) userUpdates.name = name.trim();
        await User.findByIdAndUpdate(session.userId, userUpdates);

        logActivity({
            req,
            userId: session.userId,
            employeeId: employee._id,
            userName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
            userEmail: employee.email || session.email,
            userRole: isAdmin ? "ADMIN" : "EMPLOYEE",
            category: "PROFILE",
            action: "PROFILE_UPDATED",
            description: `${employee.firstName} updated profile details`,
            metadata: employeeUpdates
        });

        return res.json({ success: true });
    } catch (error) {
        console.error("Failed to update profile:", error);
        return res.status(500).json({ error: "Failed to update profile." });
    }
};

// DELETE profile (Soft delete)
// DELETE /api/profile/:id
export const deleteProfile = async (req, res) => {
    // Soft delete logic if needed
};
