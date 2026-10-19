import AdminReminder from "../models/AdminReminder.js";

// GET /api/admin/reminders
// Query params: year, month, priority, startDate, endDate
export const getReminders = async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const filter = { userId };

    const { year, month, priority, startDate, endDate } = req.query;

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (year && month) {
      const y = parseInt(year);
      const m = parseInt(month);
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    if (priority && ["PRIORITY", "MEDIUM", "NORMAL"].includes(priority)) {
      filter.priority = priority;
    }

    const reminders = await AdminReminder.find(filter).sort({
      date: 1,
      startTime: 1,
      createdAt: 1,
    });

    return res.json({ success: true, data: reminders });
  } catch (error) {
    console.error("Error fetching admin reminders:", error);
    return res.status(500).json({ error: "Failed to fetch reminders" });
  }
};

// POST /api/admin/reminders
export const createReminder = async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      title,
      description = "",
      date,
      startTime = null,
      endTime = null,
      isAllDay = false,
      priority = "NORMAL",
      category = "General",
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }
    if (!date) {
      return res.status(400).json({ error: "Date is required" });
    }

    let reminderDate;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      const [y, m, d] = date.trim().split("-").map(Number);
      reminderDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    } else {
      reminderDate = new Date(date);
      reminderDate.setHours(0, 0, 0, 0);
    }

    const validPriority = ["PRIORITY", "MEDIUM", "NORMAL"].includes(priority)
      ? priority
      : "NORMAL";

    const reminder = await AdminReminder.create({
      userId,
      title: title.trim(),
      description: description.trim(),
      date: reminderDate,
      startTime: isAllDay ? null : startTime,
      endTime: isAllDay ? null : endTime,
      isAllDay: Boolean(isAllDay),
      priority: validPriority,
      category: category || "General",
      isCompleted: false,
    });

    return res.status(201).json({
      success: true,
      message: "Reminder created successfully",
      data: reminder,
    });
  } catch (error) {
    console.error("Error creating admin reminder:", error);
    return res.status(500).json({ error: "Failed to create reminder" });
  }
};

// PUT /api/admin/reminders/:id
export const updateReminder = async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const existing = await AdminReminder.findOne({ _id: id, userId });
    if (!existing) {
      return res.status(404).json({ error: "Reminder not found" });
    }

    const {
      title,
      description,
      date,
      startTime,
      endTime,
      isAllDay,
      priority,
      category,
      isCompleted,
      isRead,
    } = req.body;

    if (title !== undefined) existing.title = title.trim();
    if (description !== undefined) existing.description = description.trim();
    if (date !== undefined) {
      let d;
      if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        const [y, m, day] = date.trim().split("-").map(Number);
        d = new Date(y, m - 1, day, 0, 0, 0, 0);
      } else {
        d = new Date(date);
        d.setHours(0, 0, 0, 0);
      }
      existing.date = d;
    }
    if (startTime !== undefined) existing.startTime = startTime;
    if (endTime !== undefined) existing.endTime = endTime;
    if (isAllDay !== undefined) existing.isAllDay = Boolean(isAllDay);
    if (priority && ["PRIORITY", "MEDIUM", "NORMAL"].includes(priority)) {
      existing.priority = priority;
    }
    if (category !== undefined) existing.category = category;
    if (isCompleted !== undefined) existing.isCompleted = Boolean(isCompleted);
    if (isRead !== undefined) {
      existing.isRead = Boolean(isRead);
      if (isRead && !existing.readAt) existing.readAt = new Date();
    }

    await existing.save();

    return res.json({
      success: true,
      message: "Reminder updated successfully",
      data: existing,
    });
  } catch (error) {
    console.error("Error updating admin reminder:", error);
    return res.status(500).json({ error: "Failed to update reminder" });
  }
};

// PATCH /api/admin/reminders/:id/read
export const markAsRead = async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const reminder = await AdminReminder.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true, readAt: new Date() },
      { returnDocument: "after" }
    );
    if (!reminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }

    return res.json({
      success: true,
      message: "Reminder marked as read",
      data: reminder,
    });
  } catch (error) {
    console.error("Error marking reminder as read:", error);
    return res.status(500).json({ error: "Failed to mark reminder as read" });
  }
};

// PATCH /api/admin/reminders/read-all
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await AdminReminder.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return res.json({
      success: true,
      message: "All reminders marked as read",
    });
  } catch (error) {
    console.error("Error marking all reminders as read:", error);
    return res.status(500).json({ error: "Failed to mark all reminders as read" });
  }
};

// DELETE /api/admin/reminders/:id
export const deleteReminder = async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const deleted = await AdminReminder.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
      return res.status(404).json({ error: "Reminder not found" });
    }

    return res.json({
      success: true,
      message: "Reminder deleted successfully",
      id,
    });
  } catch (error) {
    console.error("Error deleting admin reminder:", error);
    return res.status(500).json({ error: "Failed to delete reminder" });
  }
};
