import "dotenv/config";
import connectDB from "../config/db.js";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import { getISTTime } from "../services/attendanceService.js";
import { clearCachePattern } from "../config/redis.js";

async function updateAttendance() {
  await connectDB();

  const rohit = await Employee.findOne({ firstName: "ROHIT KUMAR" });
  if (!rohit) {
    console.error("Rohit not found in Employee database");
    process.exit(1);
  }

  console.log(`Found Employee: ${rohit.firstName} ${rohit.lastName} (ID: ${rohit._id})`);

  // Target Date: 1st Oct 2026 IST
  // 10:18:00 AM IST = 04:48:00 UTC
  // 06:14:00 PM IST = 18:14:00 IST = 12:44:00 UTC
  const inTime = new Date("2026-10-01T10:18:00.000+05:30");
  const outTime = new Date("2026-10-01T18:14:00.000+05:30");
  const dateISTMidnight = new Date("2026-10-01T00:00:00.000+05:30");

  console.log("Check-in Time (IST):", inTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));
  console.log("Check-out Time (IST):", outTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));

  // Working Hours calculation:
  // 10:18 to 18:14 is 7 hours and 56 minutes = 7 + (56 / 60) = 7.9333... hrs
  const diffMs = outTime.getTime() - inTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const workingHours = parseFloat(diffHours.toFixed(2)); // 7.93
  const dayType = workingHours >= 6.0 ? "Full Day" : "Half Day";

  const punches = [
    {
      type: "IN",
      time: inTime,
      latitude: 22.2576588,
      longitude: 84.8858672,
      distanceMeters: 1,
      accuracyMeters: 14.5,
      locationVerified: true,
    },
    {
      type: "OUT",
      time: outTime,
      latitude: 22.2576585,
      longitude: 84.8858654,
      distanceMeters: 1,
      accuracyMeters: 13.9,
      locationVerified: true,
    },
  ];

  // Check existing record
  let attendanceRecord = await Attendance.findOne({
    employeeId: rohit._id,
    date: dateISTMidnight,
  });

  if (!attendanceRecord) {
    attendanceRecord = new Attendance({
      employeeId: rohit._id,
      date: dateISTMidnight,
    });
  }

  attendanceRecord.checkIn = inTime;
  attendanceRecord.checkOut = outTime;
  attendanceRecord.currentStatus = "OUT";
  attendanceRecord.punches = punches;
  attendanceRecord.status = "LATE";
  attendanceRecord.isLateBuffer = true;
  attendanceRecord.wasLate = true;
  attendanceRecord.lateCountThisMonth = 1;
  attendanceRecord.verdict = "Late Arrival (1/5 allowed monthly late buffer used: 10:15 AM - 10:30 AM)";
  attendanceRecord.requiresCorrection = false;
  attendanceRecord.workingHours = workingHours;
  attendanceRecord.dayType = dayType;

  await attendanceRecord.save();

  console.log("\n✅ Successfully updated Rohit's attendance for 1st Oct 2026:");
  console.log({
    recordId: attendanceRecord._id,
    employee: `${rohit.firstName} ${rohit.lastName}`,
    date: attendanceRecord.date.toISOString(),
    checkIn: attendanceRecord.checkIn.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    checkOut: attendanceRecord.checkOut.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    status: attendanceRecord.status,
    isLateBuffer: attendanceRecord.isLateBuffer,
    wasLate: attendanceRecord.wasLate,
    verdict: attendanceRecord.verdict,
    workingHours: attendanceRecord.workingHours,
    dayType: attendanceRecord.dayType,
    punches: attendanceRecord.punches.map(p => ({
      type: p.type,
      time: p.time.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      locationVerified: p.locationVerified
    }))
  });

  // Clear relevant cache
  try {
    await clearCachePattern("*attendance*");
  } catch (e) {
    // safe ignore if redis not active
  }

  process.exit(0);
}

updateAttendance().catch(err => {
  console.error("Failed to update attendance:", err);
  process.exit(1);
});
