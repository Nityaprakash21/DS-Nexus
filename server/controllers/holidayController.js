import Holiday from "../models/Holiday.js";
import { MARKET_HOLIDAYS } from "../constants/marketHolidays.js";
import { clearCachePattern } from "../config/redis.js";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Helper to compute day name and isWeekend flag from YYYY-MM-DD
export const getDayInfoFromDate = (dateStr) => {
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3) return { day: "Monday", isWeekend: false };
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayIdx = dt.getDay();
    return {
        day: WEEKDAYS[dayIdx],
        isWeekend: dayIdx === 0 || dayIdx === 6 // Saturday or Sunday
    };
};

// Seed default official holidays into MongoDB if empty
export const ensureHolidaysSeeded = async () => {
    try {
        const count = await Holiday.countDocuments();
        if (count === 0) {
            for (const item of MARKET_HOLIDAYS) {
                const info = getDayInfoFromDate(item.date);
                let category = "MARKET";
                if (item.name.includes("Republic") || item.name.includes("Independence") || item.name.includes("Gandhi")) {
                    category = "NATIONAL";
                } else if (item.name.includes("Diwali") || item.name.includes("Holi") || item.name.includes("Eid") || item.name.includes("Christmas") || item.name.includes("Ganesh") || item.name.includes("Dussehra")) {
                    category = "FESTIVAL";
                }

                await Holiday.findOneAndUpdate(
                    { date: item.date },
                    {
                        $setOnInsert: {
                            name: item.name,
                            date: item.date,
                            day: item.day || info.day,
                            category,
                            description: item.name.includes("Laxmi Pujan") ? "Muhurat Trading session scheduled" : "Official Trading & Corporate Holiday",
                            isWeekend: Boolean(item.isWeekend ?? info.isWeekend),
                            isSystemDefault: true
                        }
                    },
                    { upsert: true, returnDocument: "after" }
                );
            }
        }
    } catch (err) {
        console.error("Error auto-seeding holidays:", err);
    }
};

// GET /api/holidays
// Accessible to all authenticated users
export const getHolidays = async (req, res) => {
    try {
        await ensureHolidaysSeeded();

        const { year, category } = req.query;
        const query = {};

        if (year) {
            query.date = { $regex: new RegExp(`^${year}`) };
        }

        if (category && category !== "ALL") {
            query.category = category;
        }

        const holidays = await Holiday.find(query).sort({ date: 1 }).lean();

        return res.json({
            success: true,
            count: holidays.length,
            holidays
        });
    } catch (err) {
        console.error("Error fetching holidays:", err);
        return res.status(500).json({ error: "Failed to fetch holidays" });
    }
};

// POST /api/holidays
// Admin-only: Create a new holiday
export const createHoliday = async (req, res) => {
    try {
        const { name, date, category, description } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ error: "Holiday title/occasion is required" });
        }

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
            return res.status(400).json({ error: "Valid date in format YYYY-MM-DD is required" });
        }

        const trimmedDate = date.trim();
        const trimmedName = name.trim();

        // Check date uniqueness
        const existing = await Holiday.findOne({ date: trimmedDate });
        if (existing) {
            return res.status(400).json({
                error: `A holiday is already registered on ${trimmedDate} ("${existing.name}")`
            });
        }

        const dayInfo = getDayInfoFromDate(trimmedDate);

        const newHoliday = await Holiday.create({
            name: trimmedName,
            date: trimmedDate,
            day: dayInfo.day,
            category: category || "COMPANY",
            description: description?.trim() || "",
            isWeekend: dayInfo.isWeekend,
            isSystemDefault: false
        });

        // Invalidate holiday cache
        clearCachePattern("holidays:*");

        return res.status(201).json({
            success: true,
            message: `Holiday "${newHoliday.name}" (${newHoliday.date}) created successfully`,
            holiday: newHoliday
        });
    } catch (err) {
        console.error("Error creating holiday:", err);
        return res.status(500).json({ error: "Failed to create holiday" });
    }
};

// PUT /api/holidays/:id
// Admin-only: Update an existing holiday
export const updateHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, date, category, description } = req.body;

        const holiday = await Holiday.findById(id);
        if (!holiday) {
            return res.status(404).json({ error: "Holiday not found" });
        }

        if (name && name.trim()) {
            holiday.name = name.trim();
        }

        if (date && date.trim()) {
            const trimmedDate = date.trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
                return res.status(400).json({ error: "Valid date in format YYYY-MM-DD is required" });
            }

            if (trimmedDate !== holiday.date) {
                const existing = await Holiday.findOne({ date: trimmedDate, _id: { $ne: id } });
                if (existing) {
                    return res.status(400).json({
                        error: `A holiday is already registered on ${trimmedDate} ("${existing.name}")`
                    });
                }
                holiday.date = trimmedDate;
                const dayInfo = getDayInfoFromDate(trimmedDate);
                holiday.day = dayInfo.day;
                holiday.isWeekend = dayInfo.isWeekend;
            }
        }

        if (category) {
            holiday.category = category;
        }

        if (description !== undefined) {
            holiday.description = description.trim();
        }

        await holiday.save();

        // Invalidate holiday cache
        clearCachePattern("holidays:*");

        return res.json({
            success: true,
            message: `Holiday "${holiday.name}" updated successfully`,
            holiday
        });
    } catch (err) {
        console.error("Error updating holiday:", err);
        return res.status(500).json({ error: "Failed to update holiday" });
    }
};

// DELETE /api/holidays/:id
// Admin-only: Delete a holiday
export const deleteHoliday = async (req, res) => {
    try {
        const { id } = req.params;

        const holiday = await Holiday.findById(id);
        if (!holiday) {
            return res.status(404).json({ error: "Holiday not found" });
        }

        await Holiday.findByIdAndDelete(id);

        // Invalidate holiday cache
        clearCachePattern("holidays:*");

        return res.json({
            success: true,
            message: `Holiday "${holiday.name}" (${holiday.date}) deleted successfully`
        });
    } catch (err) {
        console.error("Error deleting holiday:", err);
        return res.status(500).json({ error: "Failed to delete holiday" });
    }
};
