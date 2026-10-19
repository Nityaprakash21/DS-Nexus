import Feedback from "../models/Feedback.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";

// GET /api/feedback
// Fetch all feedbacks with optional filters
export const getFeedbacks = async (req, res) => {
    try {
        const { status, category, search } = req.query;
        const query = {};

        if (status && status !== "ALL") {
            query.status = status;
        }
        if (category && category !== "ALL") {
            query.category = category;
        }
        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), "i");
            query.$or = [
                { title: regex },
                { description: regex },
                { authorName: regex },
                { authorDepartment: regex }
            ];
        }

        const feedbacks = await Feedback.find(query)
            .sort({ createdAt: -1 })
            .lean();

        // Calculate summary counts for tabs/badges
        const allFeedbacks = await Feedback.find().select("status").lean();
        const counts = {
            total: allFeedbacks.length,
            implemented: allFeedbacks.filter(f => f.status === "IMPLEMENTED").length,
            valuable: allFeedbacks.filter(f => f.status === "VALUABLE").length,
            notImplemented: allFeedbacks.filter(f => f.status === "NOT_IMPLEMENTED").length,
            pending: allFeedbacks.filter(f => f.status === "PENDING").length
        };

        const result = feedbacks.map(f => ({
            ...f,
            id: f._id.toString()
        }));

        return res.json({
            data: result,
            counts
        });
    } catch (error) {
        console.error("Failed to fetch feedbacks:", error);
        return res.status(500).json({ error: "Failed to fetch feedbacks" });
    }
};

// POST /api/feedback
// Submit a new feedback
export const createFeedback = async (req, res) => {
    try {
        const session = req.session;
        if (!session || !session.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { title, description, category } = req.body;
        if (!title || !title.trim() || !description || !description.trim()) {
            return res.status(400).json({ error: "Title and description are required" });
        }

        let authorName = "Employee";
        let authorDepartment = "General";
        let authorEmail = session.email || "";
        const authorRole = session.role || "EMPLOYEE";

        if (authorRole === "ADMIN") {
            const adminUser = await User.findById(session.userId).lean();
            authorName = adminUser?.name?.trim() || session.email?.split("@")[0] || "Administrator";
            authorDepartment = "Administration";
            authorEmail = adminUser?.email || session.email;
        } else {
            const employee = await Employee.findOne({ userId: session.userId }).lean();
            if (employee) {
                authorName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || "Employee";
                authorDepartment = employee.department || "General";
                authorEmail = employee.email || session.email;
            } else {
                const user = await User.findById(session.userId).lean();
                authorName = user?.name || session.email?.split("@")[0] || "Employee";
            }
        }

        const validCategories = [
            "Workplace & Facility",
            "Process & Operations",
            "IT & Tools",
            "HR & Culture",
            "General"
        ];
        const selectedCategory = validCategories.includes(category) ? category : "General";

        const feedback = await Feedback.create({
            userId: session.userId,
            authorName,
            authorRole,
            authorDepartment,
            authorEmail,
            title: title.trim(),
            category: selectedCategory,
            description: description.trim(),
            status: "PENDING"
        });

        return res.status(201).json({
            success: true,
            data: {
                ...feedback.toObject(),
                id: feedback._id.toString()
            }
        });
    } catch (error) {
        console.error("Failed to create feedback:", error);
        return res.status(500).json({ error: "Failed to submit feedback" });
    }
};

// PATCH /api/feedback/:id/status
// Admin updates feedback status (Implemented, Not Implemented, Valuable, or Pending)
export const updateFeedbackStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminRemark } = req.body;

        const allowedStatuses = ["PENDING", "IMPLEMENTED", "NOT_IMPLEMENTED", "VALUABLE"];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                error: `Invalid status. Allowed values: ${allowedStatuses.join(", ")}`
            });
        }

        const feedback = await Feedback.findById(id);
        if (!feedback) {
            return res.status(404).json({ error: "Feedback not found" });
        }

        feedback.status = status;
        feedback.markedBy = req.session.userId;
        feedback.markedAt = new Date();

        if (typeof adminRemark === "string") {
            feedback.adminRemark = adminRemark.trim();
        }

        await feedback.save();

        return res.json({
            success: true,
            data: {
                ...feedback.toObject(),
                id: feedback._id.toString()
            }
        });
    } catch (error) {
        console.error("Failed to update feedback status:", error);
        return res.status(500).json({ error: "Failed to update feedback status" });
    }
};

// DELETE /api/feedback/:id
// Delete feedback (Admin or original Author)
export const deleteFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const feedback = await Feedback.findById(id);
        if (!feedback) {
            return res.status(404).json({ error: "Feedback not found" });
        }

        const isAdmin = req.session.role === "ADMIN";
        const isAuthor = feedback.userId.toString() === req.session.userId.toString();

        if (!isAdmin && !isAuthor) {
            return res.status(403).json({ error: "Not authorized to delete this feedback" });
        }

        await Feedback.findByIdAndDelete(id);
        return res.json({ success: true, message: "Feedback deleted successfully" });
    } catch (error) {
        console.error("Failed to delete feedback:", error);
        return res.status(500).json({ error: "Failed to delete feedback" });
    }
};
