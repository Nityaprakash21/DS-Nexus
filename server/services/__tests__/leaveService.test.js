import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateLeaveDays, LEAVE_QUOTAS } from "../leaveService.js";

describe("Leave Service Core Suite", () => {
  describe("calculateLeaveDays", () => {
    it("should return 1 for same-day leave", () => {
      const start = "2026-10-05";
      const end = "2026-10-05";
      const days = calculateLeaveDays(start, end);
      assert.equal(days, 1);
    });

    it("should calculate correct days across multiple dates", () => {
      const start = "2026-10-05";
      const end = "2026-10-09"; // 5 days inclusive
      const days = calculateLeaveDays(start, end);
      assert.equal(days, 5);
    });

    it("should calculate correct days across month boundary", () => {
      const start = "2026-09-29";
      const end = "2026-10-02"; // Sep 29, 30, Oct 1, 2 = 4 days
      const days = calculateLeaveDays(start, end);
      assert.equal(days, 4);
    });
  });

  describe("Leave Quota Rules", () => {
    it("should enforce official annual quota caps", () => {
      assert.equal(LEAVE_QUOTAS.SICK, 5);
      assert.equal(LEAVE_QUOTAS.CASUAL, 10);
      assert.equal(LEAVE_QUOTAS.ANNUAL, 20);
    });
  });
});
