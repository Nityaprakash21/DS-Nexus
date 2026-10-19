import Employee from "../models/Employee.js";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import { runInTransaction } from "../utils/dbTransactions.js";

// GET employees
// GET /api/employees
export const getEmployees = async (req, res) => {
    try {
        const { department } = req.query;
        const where = {};
        if (department) where.department = department;
        const employees = await Employee.find(where).sort({ employeeCode: 1, createdAt: 1 }).populate("userId", "email role").lean();
        const result = employees.map((emp) => ({
            ...emp,
            id: emp._id.toString(),
            user: emp.userId ? { email: emp.userId.email, role: emp.userId.role } : null
        }));
        return res.json(result);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Failed to fetch employees" });
    }
};

// CREATE employee
// POST /api/employees
export const createEmployee = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            position,
            department,
            basicSalary,
            allowances,
            deductions,
            joinDate,
            password,
            role,
            bio,
            highestQualification,
            passOutYear,
            certification,
            certificationValidity,
            panNumber,
            aadharNumber
        } = req.body;
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const hashed = await bcrypt.hash(password, 10);
        const employee = await runInTransaction(async (session) => {
            const opts = session ? { session } : {};
            const [user] = await User.create([{
                email,
                password: hashed,
                role: role || "EMPLOYEE",
                name: `${firstName} ${lastName}`.trim(),
                phone: phone || "",
                bio: bio || "",
                highestQualification: highestQualification || "",
                passOutYear: passOutYear || "",
                certification: certification || "",
                certificationValidity: certificationValidity || "",
                panNumber: panNumber ? panNumber.trim().toUpperCase() : "",
                aadharNumber: aadharNumber ? aadharNumber.trim() : ""
            }], opts);

            // Automatically assign Employee Code: Joining Year + 2-digit sequential serial (e.g. 202601, 202602)
            const joinYear = joinDate ? new Date(joinDate).getFullYear() : new Date().getFullYear();
            const yearStr = String(joinYear);

            const latestEmployeeQuery = Employee.findOne({
                employeeCode: new RegExp(`^${yearStr}`)
            }).sort({ employeeCode: -1 }).select("employeeCode");
            if (session) latestEmployeeQuery.session(session);
            const latestEmployee = await latestEmployeeQuery.lean();

            let nextSerial = 1;
            if (latestEmployee && latestEmployee.employeeCode) {
                const serialPart = latestEmployee.employeeCode.slice(yearStr.length);
                const parsed = parseInt(serialPart, 10);
                if (!isNaN(parsed)) {
                    nextSerial = parsed + 1;
                }
            }
            const employeeCode = `${yearStr}${String(nextSerial).padStart(2, "0")}`;

            const [newEmp] = await Employee.create([{
                userId: user._id,
                employeeCode,
                firstName,
                lastName,
                email,
                phone,
                position,
                department: department || "Operations",
                basicSalary: Number(basicSalary) || 0,
                allowances: Number(allowances) || 0,
                deductions: Number(deductions) || 0,
                joinDate: new Date(joinDate),
                bio: bio || "",
                highestQualification: highestQualification || "",
                passOutYear: passOutYear || "",
                certification: certification || "",
                certificationValidity: certificationValidity || "",
                panNumber: panNumber ? panNumber.trim().toUpperCase() : "",
                aadharNumber: aadharNumber ? aadharNumber.trim() : "",
                isLocationExempt: req.body.isLocationExempt === "true" || req.body.isLocationExempt === true
            }], opts);

            return newEmp;
        });
        return res.status(201).json({ success: true, employee });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: "Email or Employee Code already exists" });
        }
        console.error("Create employee error: ", error);
        return res.status(500).json({ error: "Failed to create employee" });
    }
};

// UPDATE employee
// PUT /api/employees/:id
export const updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            firstName,
            lastName,
            email,
            phone,
            position,
            department,
            basicSalary,
            allowances,
            deductions,
            password,
            role,
            bio,
            employmentStatus,
            highestQualification,
            passOutYear,
            certification,
            certificationValidity,
            panNumber,
            aadharNumber
        } = req.body;

        const employee = await Employee.findById(id);
        if (!employee) return res.status(404).json({ error: "Employee not found" });

        const updateData = {
            firstName,
            lastName,
            email,
            phone,
            position,
            department: department || employee.department || "Operations",
            employmentStatus: employmentStatus || employee.employmentStatus || "ACTIVE",
            bio: bio !== undefined ? bio : employee.bio
        };

        if (employmentStatus === "INACTIVE" && employee.employmentStatus !== "INACTIVE") {
            updateData.deactivationDate = new Date();
        } else if (employmentStatus === "ACTIVE" && employee.employmentStatus === "INACTIVE") {
            updateData.deactivationDate = null;
        }

        if (highestQualification !== undefined) updateData.highestQualification = highestQualification;
        if (passOutYear !== undefined) updateData.passOutYear = passOutYear;
        if (certification !== undefined) updateData.certification = certification;
        if (certificationValidity !== undefined) updateData.certificationValidity = certificationValidity;
        if (panNumber !== undefined) updateData.panNumber = panNumber ? panNumber.trim().toUpperCase() : "";
        if (aadharNumber !== undefined) updateData.aadharNumber = aadharNumber ? aadharNumber.trim() : "";
        if (req.body.isLocationExempt !== undefined) {
            updateData.isLocationExempt = req.body.isLocationExempt === "true" || req.body.isLocationExempt === true;
        }

        if (basicSalary !== undefined && basicSalary !== "") {
            updateData.basicSalary = Number(basicSalary) || 0;
        }
        if (allowances !== undefined && allowances !== "") {
            updateData.allowances = Number(allowances) || 0;
        }
        if (deductions !== undefined && deductions !== "") {
            updateData.deductions = Number(deductions) || 0;
        }

        await runInTransaction(async (session) => {
            const opts = session ? { session } : {};
            await Employee.findByIdAndUpdate(id, updateData, opts);

            if (updateData.deactivationDate) {
                const deactMidnight = new Date(updateData.deactivationDate);
                deactMidnight.setHours(0, 0, 0, 0);
                await Attendance.deleteMany({
                    employeeId: employee._id,
                    date: { $gte: deactMidnight },
                    $or: [{ punches: { $size: 0 } }, { punches: { $exists: false } }],
                    status: "ABSENT"
                }, opts);
            }

            // Update user record
            const userUpdate = { email };
            const updatedFullName = `${firstName || employee.firstName || ""} ${lastName || employee.lastName || ""}`.trim();
            if (updatedFullName) userUpdate.name = updatedFullName;
            if (phone !== undefined) userUpdate.phone = phone;
            if (bio !== undefined) userUpdate.bio = bio;
            if (highestQualification !== undefined) userUpdate.highestQualification = highestQualification;
            if (passOutYear !== undefined) userUpdate.passOutYear = passOutYear;
            if (certification !== undefined) userUpdate.certification = certification;
            if (certificationValidity !== undefined) userUpdate.certificationValidity = certificationValidity;
            if (panNumber !== undefined) userUpdate.panNumber = panNumber ? panNumber.trim().toUpperCase() : "";
            if (aadharNumber !== undefined) userUpdate.aadharNumber = aadharNumber ? aadharNumber.trim() : "";
            if (role) userUpdate.role = role;
            if (password) userUpdate.password = await bcrypt.hash(password, 10);
            await User.findByIdAndUpdate(employee.userId, userUpdate, opts);
        });

        return res.json({ success: true });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: "Email already exists" });
        }
        return res.status(500).json({ error: "Failed to update employee" });
    }
};

// DELETE employee
// DELETE /api/employees/:id
export const deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const employee = await Employee.findById(id);
        if (!employee) return res.status(404).json({ error: "Employee not found" });

        await runInTransaction(async (session) => {
            const opts = session ? { session } : {};
            const deactDate = new Date();
            employee.isDeleted = true;
            employee.employmentStatus = "INACTIVE";
            employee.deactivationDate = deactDate;
            await employee.save(opts);
            if (employee.userId) {
                await User.findByIdAndUpdate(employee.userId, { isDeleted: true }, opts);
            }

            // Remove any unpunched auto-generated absent records on or after deactivation date
            const deactMidnight = new Date(deactDate);
            deactMidnight.setHours(0, 0, 0, 0);
            await Attendance.deleteMany({
                employeeId: employee._id,
                date: { $gte: deactMidnight },
                $or: [{ punches: { $size: 0 } }, { punches: { $exists: false } }],
                status: "ABSENT"
            }, opts);
        });

        return res.json({ success: true });
    } catch (error) {
        console.error("Delete employee error: ", error);
        return res.status(500).json({ error: "Failed to delete employee" });
    }
};
