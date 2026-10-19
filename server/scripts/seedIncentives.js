import mongoose from "mongoose";
import "dotenv/config";
import Incentive from "../models/Incentive.js";
import Employee from "../models/Employee.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/EMPLOYEE_MANAGEMENT_SYSTEM";

async function seedIncentives() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);

  const saswat = await Employee.findOne({
    $or: [
      { firstName: { $regex: /saswat/i } },
      { lastName: { $regex: /saswat/i } },
    ],
  });

  const empId = saswat ? saswat._id : null;
  console.log(`Found Saswat: ${saswat ? saswat.firstName + " " + saswat.lastName : "Not found, using name directly"}`);

  const sampleData = [
    {
      employeeId: empId,
      employeeName: "SASWAT",
      month: "APRIL, 26",
      product: "MF",
      totalIncome: 3421,
      incentiveAmount: 1710.5,
      disbursementDate: new Date("2026-06-09T00:00:00.000Z"),
      remarks: "",
    },
    {
      employeeId: empId,
      employeeName: "SASWAT",
      month: "MAY, 26",
      product: "MF",
      totalIncome: 5196,
      incentiveAmount: 2598.0,
      disbursementDate: new Date("2026-06-09T00:00:00.000Z"),
      remarks: "",
    },
    {
      employeeId: empId,
      employeeName: "SASWAT",
      month: "JUNE, 26",
      product: "MF",
      totalIncome: 3927.28,
      incentiveAmount: 1963.64,
      disbursementDate: new Date("2026-08-02T00:00:00.000Z"),
      remarks: "",
    },
    {
      employeeId: empId,
      employeeName: "SASWAT",
      month: "JULY, 26",
      product: "MF",
      totalIncome: 4018.0,
      incentiveAmount: 2009.0,
      disbursementDate: new Date("2026-08-02T00:00:00.000Z"),
      remarks: "",
    },
  ];

  for (const item of sampleData) {
    const existing = await Incentive.findOne({
      employeeName: item.employeeName,
      month: item.month,
      product: item.product,
    });
    if (!existing) {
      await Incentive.create(item);
      console.log(`✅ Seeded Incentive: ${item.employeeName} - ${item.month} - ₹${item.incentiveAmount}`);
    } else {
      console.log(`ℹ️ Already exists: ${item.employeeName} - ${item.month}`);
    }
  }

  console.log("Seeding finished successfully.");
  await mongoose.disconnect();
}

seedIncentives().catch(console.error);
