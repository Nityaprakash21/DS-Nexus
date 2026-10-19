import mongoose from "mongoose";

const punchSchema = new mongoose.Schema({
    type: { type: String, enum: ["IN", "OUT"], required: true },
    time: { type: Date, default: Date.now },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    distanceMeters: { type: Number, default: null },
    accuracyMeters: { type: Number, default: null },
    locationVerified: { type: Boolean, default: false }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: Date, required: true },
    checkIn: { type: Date, default: null }, // First In of the day (null when marked absent with no punch)
    checkOut: { type: Date, default: null }, // Last Out of the day
    currentStatus: { type: String, enum: ["IN", "OUT", null], default: null },
    punches: [punchSchema],
    status: { type: String, enum: ["PRESENT", "ABSENT", "LATE"], default: "PRESENT" },
    isLateBuffer: { type: Boolean, default: false }, // 10:15 - 10:30 AM late buffer
    wasLate: { type: Boolean, default: false }, // Permanent flag: true if employee arrived late (after 10:15 AM)
    lateCountThisMonth: { type: Number, default: 0 }, // Late occurrence count in current month (max 5)
    verdict: { type: String, default: null }, // Official attendance verdict note
    requiresCorrection: { type: Boolean, default: false }, // Flag if absence requires correction or LWP
    workingHours: { type: Number, default: null },
    dayType: { type: String, enum: ["Full Day", "Three Quarter Day", "Half Day", "Short Day", "Absent", null], default: null }
}, { timestamps: true })

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);

export default Attendance;