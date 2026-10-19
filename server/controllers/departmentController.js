import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import { clearCachePattern } from "../config/redis.js";

const DEFAULT_DEPARTMENTS = [
    {
        departmentId: "DEP-SALES",
        name: "Sales",
        color: "rose",
        description: "Business development, client acquisition, and revenue generation.",
        isDefault: true
    },
    {
        departmentId: "DEP-SRV",
        name: "Services",
        color: "blue",
        description: "Customer service, client onboarding, relationship management, and field support.",
        isDefault: true
    },
    {
        departmentId: "DEP-OPS",
        name: "Operations",
        color: "emerald",
        description: "Core organizational logistics, platform execution, and operational oversight.",
        isDefault: true
    },
    {
        departmentId: "DEP-FIN",
        name: "Finance",
        color: "amber",
        description: "Corporate accounting, payroll administration, auditing, and financial reporting.",
        isDefault: true
    }
];

// Helper to ensure database is seeded with defaults and employee departments
export const ensureDepartmentsSeeded = async () => {
    try {
        // Backfill departmentId for any existing records that lack it
        const allCurrent = await Department.find();
        for (const doc of allCurrent) {
            if (!doc.departmentId) {
                const match = DEFAULT_DEPARTMENTS.find(def => def.name.toLowerCase() === doc.name.toLowerCase());
                const generatedId = match ? match.departmentId : `DEP-${doc.name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 5).toUpperCase() || "UNIT"}`;
                doc.departmentId = generatedId;
                await doc.save();
            }
        }

        const count = await Department.countDocuments();
        if (count === 0) {
            for (const item of DEFAULT_DEPARTMENTS) {
                await Department.findOneAndUpdate(
                    { name: item.name },
                    { $setOnInsert: item },
                    { upsert: true, returnDocument: 'after' }
                );
            }
        }

        // Check if any active employee has a department not yet in the collection
        const employeeDepts = await Employee.distinct("department", { isDeleted: false, department: { $ne: null, $ne: "" } });
        for (const deptName of employeeDepts) {
            if (!deptName) continue;
            const exists = await Department.findOne({ name: { $regex: new RegExp(`^${deptName.trim()}$`, "i") } });
            if (!exists) {
                const cleanCode = deptName.replace(/[^a-zA-Z0-9]/g, "").substring(0, 5).toUpperCase() || "UNIT";
                await Department.create({
                    departmentId: `DEP-${cleanCode}`,
                    name: deptName.trim(),
                    description: "Imported from employee records",
                    color: "indigo",
                    isDefault: false
                });
            }
        }
    } catch (err) {
        console.error("Error auto-seeding departments:", err);
    }
};

// GET /api/departments
// Accessible to all authenticated users for dropdowns, filters, and management
export const getDepartments = async (req, res) => {
    try {
        await ensureDepartmentsSeeded();

        const departments = await Department.find().sort({ createdAt: 1 }).lean();

        // Attach live active employee count and position breakdown for each department
        const departmentsWithDetails = await Promise.all(
            departments.map(async (dept) => {
                const employees = await Employee.find({
                    department: dept.name,
                    isDeleted: false
                }).select("firstName lastName position").lean();

                const positions = [...new Set(employees.map(e => e.position).filter(Boolean))];

                return {
                    ...dept,
                    employeeCount: employees.length,
                    positions,
                    sampleEmployees: employees.slice(0, 3).map(e => `${e.firstName} ${e.lastName}`.trim())
                };
            })
        );

        return res.json({
            success: true,
            count: departmentsWithDetails.length,
            departments: departmentsWithDetails
        });
    } catch (err) {
        console.error("Error fetching departments:", err);
        return res.status(500).json({ error: "Failed to fetch departments" });
    }
};

// POST /api/departments
// Admin-only: Create a new department
export const createDepartment = async (req, res) => {
    try {
        const { departmentId, name, description, color } = req.body;

        if (!departmentId || typeof departmentId !== "string" || !departmentId.trim()) {
            return res.status(400).json({ error: "Department ID is required (e.g. DEP-01, SALES-01)" });
        }

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ error: "Department name is required" });
        }

        const trimmedId = departmentId.trim().toUpperCase();
        const trimmedName = name.trim();

        // Check unique departmentId
        const existingId = await Department.findOne({ departmentId: trimmedId });
        if (existingId) {
            return res.status(400).json({ error: `Department ID "${trimmedId}" is already assigned to "${existingId.name}"` });
        }

        // Check case-insensitive duplicate name
        const existingName = await Department.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, "i") }
        });

        if (existingName) {
            return res.status(400).json({ error: `Department "${existingName.name}" already exists` });
        }

        const newDept = await Department.create({
            departmentId: trimmedId,
            name: trimmedName,
            description: description?.trim() || "",
            color: color || "indigo",
            isDefault: false
        });

        // Invalidate department cache
        clearCachePattern("departments:*");

        return res.status(201).json({
            success: true,
            message: `Department "${newDept.name}" (${newDept.departmentId}) created successfully`,
            department: {
                ...newDept.toObject(),
                employeeCount: 0,
                positions: []
            }
        });
    } catch (err) {
        console.error("Error creating department:", err);
        return res.status(500).json({ error: "Failed to create department" });
    }
};

// PUT /api/departments/:id
// Admin-only: Update department details
export const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;
        const { departmentId, name, description, color } = req.body;

        const dept = await Department.findById(id);
        if (!dept) {
            return res.status(404).json({ error: "Department not found" });
        }

        const oldName = dept.name;

        if (departmentId && departmentId.trim()) {
            const trimmedId = departmentId.trim().toUpperCase();
            if (trimmedId !== dept.departmentId) {
                const existingId = await Department.findOne({ departmentId: trimmedId, _id: { $ne: id } });
                if (existingId) {
                    return res.status(400).json({ error: `Department ID "${trimmedId}" is already assigned to "${existingId.name}"` });
                }
                dept.departmentId = trimmedId;
            }
        }

        if (name && name.trim()) {
            const trimmedName = name.trim();
            if (trimmedName.toLowerCase() !== dept.name.toLowerCase()) {
                const existingName = await Department.findOne({
                    name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
                    _id: { $ne: id }
                });
                if (existingName) {
                    return res.status(400).json({ error: `Department "${existingName.name}" already exists` });
                }
                dept.name = trimmedName;

                // If department name changed, sync active employee records with the new name!
                await Employee.updateMany({ department: oldName }, { department: trimmedName });
            }
        }

        if (description !== undefined) dept.description = description.trim();
        if (color) dept.color = color;

        await dept.save();

        // Invalidate department cache
        clearCachePattern("departments:*");

        return res.json({
            success: true,
            message: `Department "${dept.name}" updated successfully`,
            department: dept
        });
    } catch (err) {
        console.error("Error updating department:", err);
        return res.status(500).json({ error: "Failed to update department" });
    }
};

// DELETE /api/departments/:id
// Admin-only: Delete a department (protected by employee assignment safeguard)
export const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;

        const dept = await Department.findById(id);
        if (!dept) {
            return res.status(404).json({ error: "Department not found" });
        }

        // Safety check: Ensure no active employees are currently assigned to this department
        const assignedEmployeesCount = await Employee.countDocuments({
            department: dept.name,
            isDeleted: false
        });

        if (assignedEmployeesCount > 0) {
            return res.status(400).json({
                error: `Cannot delete department "${dept.name}" (${dept.departmentId || "ID N/A"}) because ${assignedEmployeesCount} active employee(s) are currently assigned to it. Please reassign those employees to another department first.`
            });
        }

        await Department.findByIdAndDelete(id);

        // Invalidate department cache
        clearCachePattern("departments:*");

        return res.json({
            success: true,
            message: `Department "${dept.name}" deleted successfully`
        });
    } catch (err) {
        console.error("Error deleting department:", err);
        return res.status(500).json({ error: "Failed to delete department" });
    }
};
