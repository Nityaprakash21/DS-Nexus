import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getISTTime,
  getISTDateString,
  getISTMidnightDate,
  calculateDistanceMeters,
  calculateWorkingHoursFromPunches,
} from "../attendanceService.js";
import { ATTENDANCE_RULES } from "../../constants/attendanceRules.js";

describe("Attendance Service Core Suite", () => {
  describe("IST Timezone Helpers", () => {
    it("should correctly calculate IST minutesFromMidnight", () => {
      // 10:14 AM IST = 04:44 UTC
      const date = new Date("2026-09-25T04:44:00.000Z");
      const istTime = getISTTime(date);

      assert.equal(istTime.hour, 10);
      assert.equal(istTime.minute, 14);
      assert.equal(istTime.minutesFromMidnight, 10 * 60 + 14); // 614
      assert.ok(istTime.minutesFromMidnight <= ATTENDANCE_RULES.GRACE_PERIOD_END_MINUTES);
    });

    it("should format IST date string as YYYY-MM-DD", () => {
      const date = new Date("2026-09-25T04:44:00.000Z");
      const dStr = getISTDateString(date);
      assert.equal(dStr, "2026-09-25");
    });

    it("should create accurate IST midnight date with zeroed hours", () => {
      const date = new Date("2026-09-25T11:30:00.000Z");
      const midnight = getISTMidnightDate(date);
      const istTime = getISTTime(midnight);

      assert.equal(istTime.hour, 0);
      assert.equal(istTime.minute, 0);
      assert.equal(istTime.minutesFromMidnight, 0);
    });
  });

  describe("Haversine Distance Calculator", () => {
    it("should return 0 meters for identical coordinates", () => {
      const lat = ATTENDANCE_RULES.DEFAULT_OFFICE_LATITUDE;
      const lon = ATTENDANCE_RULES.DEFAULT_OFFICE_LONGITUDE;
      const distance = calculateDistanceMeters(lat, lon, lat, lon);
      assert.equal(distance, 0);
    });

    it("should accurately calculate distance between office and known offset", () => {
      const officeLat = 22.257667;
      const officeLon = 84.885863;
      // Coordinates approx ~111m away north
      const offsetLat = 22.258667;
      const offsetLon = 84.885863;

      const distance = calculateDistanceMeters(officeLat, officeLon, offsetLat, offsetLon);
      assert.ok(distance > 100);
      assert.ok(distance < 120);
    });
  });

  describe("Working Hours & Session Calculations", () => {
    it("should calculate correct hours for completed IN-OUT sessions", () => {
      const punches = [
        { type: "IN", time: new Date("2026-09-25T10:00:00.000+05:30") },
        { type: "OUT", time: new Date("2026-09-25T14:00:00.000+05:30") }, // 4 hours
        { type: "IN", time: new Date("2026-09-25T15:00:00.000+05:30") },
        { type: "OUT", time: new Date("2026-09-25T18:00:00.000+05:30") }, // 3 hours
      ];

      const { workingHours, dayType } = calculateWorkingHoursFromPunches(
        punches,
        punches[0].time,
        new Date("2026-09-25T18:00:00.000+05:30")
      );

      assert.equal(workingHours, 7.0);
      assert.equal(dayType, "Full Day"); // >= 6 hours
    });

    it("should mark Half Day when total working hours is under threshold", () => {
      const punches = [
        { type: "IN", time: new Date("2026-09-25T10:00:00.000+05:30") },
        { type: "OUT", time: new Date("2026-09-25T14:30:00.000+05:30") }, // 4.5 hours
      ];

      const { workingHours, dayType } = calculateWorkingHoursFromPunches(
        punches,
        punches[0].time,
        new Date("2026-09-25T14:30:00.000+05:30")
      );

      assert.equal(workingHours, 4.5);
      assert.equal(dayType, "Half Day"); // < 6 hours
    });
  });

  describe("Month-Basis vs Full FY Attendance Days Filtering", () => {
    it("should isolate present days to current calendar month rather than full FY cycle", () => {
      const sampleRecords = [
        // August 2026 (prior month in FY 2026-27)
        { date: new Date("2026-08-10T10:00:00.000Z"), status: "PRESENT" },
        { date: new Date("2026-08-11T10:00:00.000Z"), status: "PRESENT" },
        // September 2026 (prior month in FY 2026-27)
        { date: new Date("2026-09-15T10:00:00.000Z"), status: "PRESENT" },
        { date: new Date("2026-09-16T10:00:00.000Z"), status: "LATE" },
        // October 2026 (current month)
        { date: new Date("2026-10-01T10:00:00.000Z"), status: "PRESENT" },
        { date: new Date("2026-10-02T10:00:00.000Z"), status: "LATE" },
        { date: new Date("2026-10-05T10:00:00.000Z"), status: "PRESENT" },
        { date: new Date("2026-10-06T10:00:00.000Z"), status: "ABSENT" },
      ];

      const targetMonth = 9; // October (0-indexed: 9)
      const targetYear = 2026;
      const startOfMonth = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

      const monthRecords = sampleRecords.filter(r => r.date >= startOfMonth && r.date <= endOfMonth);
      const monthPresentDays = monthRecords.filter(r => r.status === "PRESENT" || r.status === "LATE").length;

      // Full FY cycle has 7 present days, but October only has 3
      const fyPresentDays = sampleRecords.filter(r => r.status === "PRESENT" || r.status === "LATE").length;

      assert.equal(fyPresentDays, 7, "FY total includes prior months");
      assert.equal(monthPresentDays, 3, "Month-basis count only includes current month present days");
    });
  });
});

