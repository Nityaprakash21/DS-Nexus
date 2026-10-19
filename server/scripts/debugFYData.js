import 'dotenv/config';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import { getFinancialYearDates } from '../constants/marketHolidays.js';

async function test() {
    await connectDB();
    const users = await User.find().lean();
    console.log('Users:', users.map(u => ({ id: u._id, email: u.email, role: u.role })));
    const emps = await Employee.find().lean();
    console.log('Employees:', emps.map(e => ({ id: e._id, userId: e.userId, name: e.firstName })));
    const fy = getFinancialYearDates();
    console.log('FY:', fy);
    for (const emp of emps) {
        const records = await Attendance.find({ employeeId: emp._id }).lean();
        const fyRecords = await Attendance.find({
            employeeId: emp._id,
            date: { $gte: fy.startDate, $lte: fy.endDate }
        }).lean();
        console.log(`Emp: ${emp.firstName} (${emp._id}) | Total Records: ${records.length} | FY Records: ${fyRecords.length}`);
        console.log('All record dates for this emp:', records.map(r => ({ date: r.date, status: r.status, hours: r.workingHours })));
    }
    process.exit(0);
}
test();
