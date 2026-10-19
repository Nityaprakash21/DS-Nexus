import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        date: {
            type: String, // Stored strictly as YYYY-MM-DD for fast string queries and timezone safety
            required: true,
            unique: true,
            trim: true
        },
        day: {
            type: String, // e.g., Monday, Tuesday...
            required: true,
            trim: true
        },
        category: {
            type: String,
            enum: ["MARKET", "NATIONAL", "FESTIVAL", "COMPANY", "OPTIONAL"],
            default: "MARKET"
        },
        description: {
            type: String,
            default: "",
            trim: true
        },
        isWeekend: {
            type: Boolean,
            default: false
        },
        isSystemDefault: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

const Holiday = mongoose.models.Holiday || mongoose.model("Holiday", holidaySchema);

export default Holiday;
