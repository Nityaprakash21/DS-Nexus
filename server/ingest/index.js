import { Inngest } from "inngest";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import sendEmail from "../config/nodemailer.js";

export const inngest = new Inngest({ id: "Employee_ManagementSytem" });

const autoCheckout = inngest.createFunction(
    { id: "auto-checkout", triggers: [{ event: "employee/checkout" }] },
    async ({ event, step }) => {
        await step.sleep("Wait-a-moment", "1s");
        const { employeeId, attendanceId } = event.data;

        // Wait for 9 Hours
        await step.sleepUntil("Wait for the 9. hours", new Date(new Date().getTime() + 9 * 60 * 60 * 1000));

        // GET Attendance Data
        let attendance = await Attendance.findById(attendanceId);
        if (!attendance?.checkOut) {

            // GET Employee Data
            const employee = await Employee.findById(employeeId);

            // Send Reminder Email
            await sendEmail({
                to: employee.email,
                subject: "Attendance Check-Out Reminder",
                body: `'<div style="max-width: 600px;">
                            <h2>Hi ${employee.firstName},</h2>
                            <p style="font-size: 16px;">You have a check-in in ${employee.department} today:</p>
                            <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">
                                ${attendance?.checkIn ? new Date(attendance.checkIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : ""}
                            </p>
                            <p style="font-size: 16px;">Please make sure to check-out in one hour.</p>
                            <p style="font-size: 16px;">If you have any questions, please contact your admin. </p>
                            <br />
                            <p style="font-size: 16px;">Best Regards, </p>
                            <p style="font-size: 16px;">EMS</p>
                        </div>`
            })

            // After 10 hours, mark attendance as Checked Out with status "LATE"
            await step.sleepUntil("wait-for-the-1-hour", new Date(new Date().getTime() + 1 * 60 * 60 * 1000))

            attendance = await Attendance.findById(attendanceId)
            if (!attendance?.checkOut) {
                attendance.checkOut = new Date(attendance.checkIn).getTime() + 4 * 60 * 60 * 1000;
                attendance.workingHours = 4;
                attendance.dayType = "Half Day";
                attendance.status = "LATE";
                await attendance.save();
            }
        }

    }
);

// Send Email to Admin, if Admin doesnot take action on Leave Application within 24 hours
const leaveApplicationReminder = inngest.createFunction(
    { id: "leave-application-reminder", triggers: [{ event: "leave/pending" }] },
    async ({ event, step }) => {
        const { leaveApplicationId } = event.data;

        // Wait for 24 hours
        await step.sleepUntil("wait-for-the-24-hours", new Date(new Date().getTime() + 24 * 60 * 60 * 1000))
        const leaveApplication = await LeaveApplication.findById(leaveApplicationId);
        if (leaveApplication?.status === "PENDING") {
            const employee = await Employee.findById(leaveApplication.employeeId);

            // Send reminder Email to Admin to take action on Leaves
            await sendEmail({
                to: process.env.ADMIN_EMAIL,
                subject: 'Leave Application Reminder',
                body: `<div style="max-width: 600px;">
                            <h2>Hi Admin,</h2>
                            <p style="font-size: 16px;">You have a leave application in ${employee.department} today:</p>
                            <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">
                                ${leaveApplication?.startDate?.toLocaleDateString()}
                            </p>
                            <p style="font-size: 16px;">Please make sure to take action on this leave application.</p>
                            <br />
                            <p style="font-size: 16px;">Best Regards,</p>
                            <p style="font-size: 16px;">EMS</p>
                        </div>`
            });
        }
    }
);

// Cron: Check Attendance at 11.30 AM IST (06:00 UTC) and email asbent employees
const attendanceReminederCron = inngest.createFunction(
    { id: "attendance-reminder-cron", triggers: [{ cron: "TZ=Asia/Kolkata 30 11 * * *" }] },
    async ({ step }) => {

        // Step 1: GET Today's Date Range (IST)
        const today = await step.run("get-today-date", () => {
            const startUTC = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00 +05:30");
            const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
            return { startUTC: startUTC.toISOString(), endUTC: endUTC.toISOString() }
        });

        // Step 2: GET all active, non-deleted employees
        const activeEmployees = await step.run("get-active-employees", async () => {
            const employees = await Employee.find({
                isDeleted: false,
                employmentStatus: "ACTIVE",
            }).lean();
            return employees.map((e) => ({ _id: e._id.toString(), firstName: e.firstName, lastName: e.lastName, email: e.email, department: e.department }));
        });

        // Step 3: GET Employee IDs on Approved leave Today
        const onLeaveIds = await step.run("get-on-leave-ids", async () => {
            const leaves = await LeaveApplication.find({
                status: "APPROVED",
                startDate: { $lte: new Date(today.endUTC) },
                endDate: { $gte: new Date(today.startUTC) },
            }).lean();
            return leaves.map((l) => l.employeeId.toString());
        })

        // Step 4: GET Employee IDs who already checked in today
        const checkedInIds = await step.run("get-checked-in-ids", async () => {
            const attendances = await Attendance.find({
                date: { $gte: new Date(today.startUTC), $lt: new Date(today.endUTC) },
            }).lean();
            return attendances.map((a) => a.employeeId.toString())
        });

        // Step 5: Filter absent employees (not on leave & not checked in)
        const absentEmployees = activeEmployees.filter((emp) => !onLeaveIds.includes(emp._id) && !checkedInIds.includes(emp._id));

        // Step 6: Send reminder emails
        if (absentEmployees.length > 0) {
            await step.run("send-reminder-emails", async () => {
                const emailPromises = absentEmployees.map((emp) => {

                    // Send Email
                    sendEmail({
                        to: emp.email,
                        subject: `Attendance Reminder - Please Mark Your Attendance`,
                        body: `<div style="max-width: 600px;">
                            <h2>Hi ${emp.firstName}</h2>
                            
                            <p style="font-size: 16px;">This is a reminder to mark your attendance in the portal.</p>
                            <p style="font-size: 16px;">Please check-in to mark your attendance. </p>
                            <br />
                            <p style="font-size: 16px;">Best Regards,</p>
                            <p style="font-size: 16px;">EMS</p>
                        </div>`
                    })
                })
                await Promise.all(emailPromises);
            })
        }
        return { totalActive: activeEmployees.length, onLeave: onLeaveIds.length, checkedIn: checkedInIds.length, absent: absentEmployees.length }
    }
);

// Cron: Automatically reconcile completed shifts and unexcused absences daily at 7:00 PM IST (13:30 UTC)
// This offloads heavy DB write operations from synchronous GET endpoints to a resilient background queue
const dailyAttendanceReconciliationCron = inngest.createFunction(
    { id: "daily-attendance-reconciliation-cron", triggers: [{ cron: "TZ=Asia/Kolkata 00 19 * * *" }] },
    async ({ step }) => {
        const activeEmployees = await step.run("get-active-employees", async () => {
            const employees = await Employee.find({ isDeleted: false, employmentStatus: "ACTIVE" }).select("_id").lean();
            return employees.map((e) => e._id.toString());
        });

        const todayStart = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00.000+05:30");
        const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

        await step.run("reconcile-all-active-employees", async () => {
            const { reconcileAbsentDays } = await import("../services/attendanceService.js");
            for (const empId of activeEmployees) {
                try {
                    await reconcileAbsentDays(empId, sevenDaysAgo, todayStart);
                } catch (err) {
                    console.error(`Error in cron reconciliation for employee ${empId}:`, err);
                }
            }
        });

        return { reconciledEmployeesCount: activeEmployees.length };
    }
);

// Export all Inngest Functions
export const functions = [autoCheckout, leaveApplicationReminder, attendanceReminederCron, dailyAttendanceReconciliationCron];