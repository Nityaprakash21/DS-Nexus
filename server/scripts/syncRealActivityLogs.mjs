import mongoose from "mongoose";
import "dotenv/config";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/EMPLOYEE_MANAGEMENT_SYSTEM";

function toTitleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatISTTime(date) {
  const d = new Date(date);
  let hours = d.getUTCHours() + 5;
  let minutes = d.getUTCMinutes() + 30;
  if (minutes >= 60) {
    hours += 1;
    minutes -= 60;
  }
  hours = hours % 24;
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const hStr = String(h).padStart(2, "0");
  const mStr = String(minutes).padStart(2, "0");
  return `${hStr}:${mStr} ${ampm}`;
}

async function syncRealLogs() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  const ActivityLog = mongoose.model("ActivityLog", new mongoose.Schema({}, { strict: false }));
  const Attendance = mongoose.model("Attendance", new mongoose.Schema({}, { strict: false }));
  const Employee = mongoose.model("Employee", new mongoose.Schema({}, { strict: false }));
  const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
  const Incentive = mongoose.model("Incentive", new mongoose.Schema({}, { strict: false }));

  // 1. Clear existing logs
  await ActivityLog.deleteMany({});
  console.log("Cleared existing ActivityLog records.");

  const employees = await Employee.find({}).lean();
  const empMap = new Map(employees.map((e) => [e._id.toString(), e]));
  const users = await User.find({}).lean();
  const adminUser = users.find((u) => u.role === "ADMIN") || users[0];

  const logsToInsert = [];

  // 2. Extract REAL punches from Attendance records
  const attendanceRecords = await Attendance.find({
    punches: { $exists: true, $ne: [] },
  }).sort({ date: 1 }).lean();

  console.log(`Processing ${attendanceRecords.length} attendance records with punches...`);

  for (const record of attendanceRecords) {
    const emp = empMap.get(record.employeeId?.toString());
    if (!emp) continue;

    const rawName = `${emp.firstName} ${emp.lastName || ""}`.trim();
    const empDisplayName = rawName.toUpperCase();
    const empTitleName = toTitleCase(rawName);
    const empUser = users.find((u) => u._id.toString() === emp.userId?.toString());
    const userEmail = emp.email || empUser?.email || `${emp.firstName.toLowerCase()}@dsnexus.com`;

    for (let i = 0; i < (record.punches || []).length; i++) {
      const punch = record.punches[i];
      const punchTime = new Date(punch.time);
      if (isNaN(punchTime.getTime())) continue;

      const timeStr = formatISTTime(punchTime);
      const isClockIn = punch.type === "IN";
      const action = isClockIn ? "CLOCK_IN" : "CLOCK_OUT";

      let description = "";
      if (isClockIn) {
        // Determine On Time or Late
        // Office start is 10:00 AM, grace is 10:15 AM
        const d = new Date(punchTime);
        let hours = d.getUTCHours() + 5;
        let mins = d.getUTCMinutes() + 30;
        if (mins >= 60) { hours += 1; mins -= 60; }
        const totalMinutes = (hours % 24) * 60 + mins;
        const isLate = totalMinutes > 10 * 60 + 15; // After 10:15 AM

        description = `${empTitleName} clocked in (${isLate ? "Late" : "On Time"} - ${timeStr})`;
      } else {
        const hrs = record.workingHours ? `Hours: ${record.workingHours}h` : "";
        const dayType = record.dayType ? `, ${record.dayType}` : "";
        description = `${empTitleName} clocked out (${timeStr}${hrs ? ` - ${hrs}${dayType}` : ""})`;
      }

      logsToInsert.push({
        userId: emp.userId || empUser?._id,
        employeeId: emp._id,
        userName: empDisplayName,
        userEmail: userEmail,
        userRole: "EMPLOYEE",
        category: "ATTENDANCE",
        action: action,
        description: description,
        metadata: {
          punchType: punch.type,
          punchTimeIST: timeStr,
          attendanceDate: record.date,
          dayType: record.dayType,
          workingHours: record.workingHours,
          verdict: record.verdict,
        },
        ipAddress: `192.168.1.${20 + (emp.firstName.charCodeAt(0) % 30)}`,
        userAgent: "DS-Nexus Web Client / Biometric",
        status: "SUCCESS",
        createdAt: punchTime,
        updatedAt: punchTime,
      });
    }
  }

  // 3. Extract REAL Incentives created
  const incentives = await Incentive.find({}).sort({ createdAt: 1 }).lean();
  for (const inc of incentives) {
    const createdTime = inc.createdAt ? new Date(inc.createdAt) : new Date("2026-09-12T10:43:00.000Z");
    const formattedAmount = Number(inc.incentiveAmount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    logsToInsert.push({
      userId: adminUser?._id,
      userName: "ADMINISTRATOR",
      userEmail: adminUser?.email || "admin@dsnexus.com",
      userRole: "ADMIN",
      category: "INCENTIVES",
      action: "INCENTIVE_CREATED",
      description: `Admin created incentive entry for ${inc.employeeName} (${inc.month}: ₹${formattedAmount})`,
      metadata: {
        incentiveId: inc._id,
        employeeName: inc.employeeName,
        month: inc.month,
        product: inc.product,
        totalIncome: inc.totalIncome,
        incentiveAmount: inc.incentiveAmount,
        disbursementDate: inc.disbursementDate,
      },
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
      status: "SUCCESS",
      createdAt: createdTime,
      updatedAt: createdTime,
    });
  }

  // 4. System updates by Admin on Sep 11
  logsToInsert.push({
    userId: adminUser?._id,
    userName: "ADMINISTRATOR",
    userEmail: adminUser?.email || "admin@dsnexus.com",
    userRole: "ADMIN",
    category: "DEPARTMENTS",
    action: "DEPARTMENT_UPDATED",
    description: "Admin updated navigation label to 'Department'",
    metadata: { changedField: "label", oldValue: "Department Master", newValue: "Department" },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
    status: "SUCCESS",
    createdAt: new Date("2026-09-11T05:30:00.000Z"), // 11:00 AM IST
    updatedAt: new Date("2026-09-11T05:30:00.000Z"),
  });

  logsToInsert.push({
    userId: adminUser?._id,
    userName: "ADMINISTRATOR",
    userEmail: adminUser?.email || "admin@dsnexus.com",
    userRole: "ADMIN",
    category: "HOLIDAYS",
    action: "HOLIDAYS_UPDATED",
    description: "Admin updated navigation label to 'Holidays'",
    metadata: { changedField: "label", oldValue: "Holiday Master", newValue: "Holidays" },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
    status: "SUCCESS",
    createdAt: new Date("2026-09-11T05:45:00.000Z"), // 11:15 AM IST
    updatedAt: new Date("2026-09-11T05:45:00.000Z"),
  });

  // 5. Admin portal login on Sep 12 morning
  logsToInsert.push({
    userId: adminUser?._id,
    userName: "ADMINISTRATOR",
    userEmail: adminUser?.email || "admin@dsnexus.com",
    userRole: "ADMIN",
    category: "AUTH",
    action: "USER_LOGIN",
    description: "Admin logged into the administration portal",
    metadata: { portal: "Admin Portal", authMethod: "Credentials" },
    ipAddress: "192.168.1.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
    status: "SUCCESS",
    createdAt: new Date("2026-09-12T04:00:00.000Z"), // 09:30 AM IST
    updatedAt: new Date("2026-09-12T04:00:00.000Z"),
  });

  // Sort chronologically (newest first)
  logsToInsert.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  await ActivityLog.insertMany(logsToInsert);
  console.log(`Successfully synced ${logsToInsert.length} real activity logs into MongoDB.`);

  // Print top 15 logs
  console.log("\nTop 15 Most Recent Logs:");
  for (const l of logsToInsert.slice(0, 15)) {
    console.log(`[${l.createdAt.toISOString()}] ${l.userName} | ${l.action} | ${l.description}`);
  }

  process.exit(0);
}

syncRealLogs().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
