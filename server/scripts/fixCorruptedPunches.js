import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/ds-nexus";

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  const Attendance = mongoose.model("Attendance", new mongoose.Schema({}, { strict: false }));
  const Employee = mongoose.model("Employee", new mongoose.Schema({}, { strict: false }));

  const todayIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  console.log(`Auditing & Fixing Attendance records as of ${todayIST}...`);

  // 1. Fix Ruchi's 2026-09-08 record (ID: 6a9f033c96f4b7899c922591)
  console.log("Fixing Ruchi Sharma Sept 8 record...");
  await Attendance.updateOne(
    { _id: new mongoose.Types.ObjectId("6a9f033c96f4b7899c922591") },
    {
      $set: {
        checkIn: new Date("2026-09-08T04:28:21.269Z"), // 09:58 AM on-time arrival
        checkOut: new Date("2026-09-08T12:31:53.730Z"), // 06:01 PM departure
        currentStatus: "OUT",
        status: "PRESENT",
        workingHours: 8.06,
        dayType: "Full Day",
        requiresCorrection: false,
        verdict: "On Time (Official Shift: 10:00 AM - 6:00 PM)",
        punches: [
          { type: "IN", time: new Date("2026-09-08T04:28:21.269Z") },
          { type: "OUT", time: new Date("2026-09-08T12:31:53.730Z") }
        ]
      }
    }
  );
  console.log("-> Ruchi Sharma Sept 8 fixed: On Time, 8.06 hrs, 1 session (IN 9:58 AM -> OUT 6:01 PM).");

  // Fix Ruchi's 2026-09-17 record (ID: 6aab6df47409a7629fc7b64b)
  console.log("Fixing Ruchi Sharma Sept 17 record...");
  await Attendance.updateOne(
    { _id: new mongoose.Types.ObjectId("6aab6df47409a7629fc7b64b") },
    {
      $set: {
        currentStatus: "OUT",
        status: "PRESENT",
        checkIn: new Date("2026-09-17T04:30:00.000Z"),
        checkOut: new Date("2026-09-17T12:30:00.000Z"),
        workingHours: 8.0,
        dayType: "Full Day",
        punches: [
          { type: "IN", time: new Date("2026-09-17T04:30:00.000Z") },
          { type: "OUT", time: new Date("2026-09-17T12:30:00.000Z") }
        ]
      }
    }
  );
  console.log("-> Ruchi Sharma Sept 17 fixed: currentStatus = OUT, complete IN/OUT punches.");

  // 2. Fix Rohit Kumar Sahoo's 2026-09-16 record (ID: 6aaa1f0e7409a7629fc7b640)
  console.log("Fixing Rohit Kumar Sahoo Sept 16 accidental 2-second double-tap...");
  await Attendance.updateOne(
    { _id: new mongoose.Types.ObjectId("6aaa1f0e7409a7629fc7b640") },
    {
      $set: {
        punches: [
          { type: "IN", time: new Date("2026-09-16T04:46:06.630Z") }, // 10:16 AM
          { type: "OUT", time: new Date("2026-09-16T12:33:21.709Z") }  // 6:03 PM
        ],
        currentStatus: "OUT",
        workingHours: 7.79,
        dayType: "Full Day"
      }
    }
  );
  console.log("-> Rohit Kumar Sahoo Sept 16 fixed: removed 2-second accidental clock-out.");

  // 3. Fix all past records where currentStatus === "IN"
  const allPastIn = await Attendance.find({ currentStatus: "IN" });
  for (const rec of allPastIn) {
    const dStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(rec.date));
    if (dStr < todayIST) {
      console.log(`Setting past record ${rec._id} (${dStr}) to OUT...`);
      let updateDoc = { currentStatus: "OUT" };
      if (!rec.checkOut && rec.punches && rec.punches.length > 0) {
        const lastP = rec.punches[rec.punches.length - 1];
        if (lastP.type === "OUT") {
          updateDoc.checkOut = lastP.time;
        } else if (rec.status === "PRESENT") {
          const shiftEnd = new Date(new Date(rec.checkIn || rec.date).getTime() + 8 * 60 * 60 * 1000);
          updateDoc.checkOut = shiftEnd;
          const newPunches = [...rec.punches, { type: "OUT", time: shiftEnd }];
          updateDoc.punches = newPunches;
          updateDoc.workingHours = 8.0;
          updateDoc.dayType = "Full Day";
        }
      } else if (!rec.checkOut) {
        const shiftEnd = new Date(new Date(rec.checkIn || rec.date).getTime() + 8 * 60 * 60 * 1000);
        updateDoc.checkOut = shiftEnd;
      }
      await Attendance.updateOne({ _id: rec._id }, { $set: updateDoc });
      console.log(`-> Record ${rec._id} fixed.`);
    }
  }

  // 4. Sanitize any records where first punch is an OUT punch
  const firstPunchOutRecs = await Attendance.find({ "punches.0.type": "OUT" });
  for (const r of firstPunchOutRecs) {
    console.log(`Found record with initial OUT punch: ${r._id}. Fixing...`);
    let fixedPunches = (r.punches || []).filter((p, idx) => !(idx === 0 && p.type === "OUT"));
    if (fixedPunches.length === 0 && r.checkIn) {
      fixedPunches.push({ type: "IN", time: r.checkIn });
      if (r.checkOut) {
        fixedPunches.push({ type: "OUT", time: r.checkOut });
      }
    }
    await Attendance.updateOne({ _id: r._id }, { $set: { punches: fixedPunches } });
    console.log(`-> Record ${r._id} initial OUT punch removed.`);
  }

  console.log("Attendance audit and cleanup completed successfully.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
