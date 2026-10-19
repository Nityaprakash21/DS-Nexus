import "dotenv/config";
import connectDB from "../config/db.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";

async function main() {
    await connectDB();
    const empId = "6a92f2e2de0ec5e059acf306";
    const employee = await Employee.findById(empId);
    console.log("Employee:", employee?.firstName, employee?.lastName);

    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    console.log("Now:", now.toISOString());
    console.log("todayStart:", todayStart.toISOString());
    console.log("todayEnd:", todayEnd.toISOString());

    const found = await Attendance.findOne({
        employeeId: empId,
        date: { $gte: todayStart, $lte: todayEnd }
    });
    console.log("Found with todayStart/End:", found ? {
        id: found._id,
        date: found.date.toISOString(),
        currentStatus: found.currentStatus,
        punches: found.punches
    } : "NOT FOUND!");

    const all = await Attendance.find({ employeeId: empId }).sort({ date: -1 });
    console.log("All records for this employee:");
    for (const r of all) {
        console.log(JSON.stringify({
            id: r._id,
            date: r.date.toISOString(),
            status: r.status,
            currentStatus: r.currentStatus,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            punches: r.punches
        }, null, 2));
    }

    process.exit(0);
}

main().catch(console.error);
