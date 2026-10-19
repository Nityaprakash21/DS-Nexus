import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateAppraisalScores } from "../kpaService.js";

describe("KPA Service Core Suite", () => {
  describe("calculateAppraisalScores", () => {
    it("should accurately calculate weighted score for perfect 5.0 ratings", () => {
      const ratings = [
        { score: 5, weight: 40 },
        { score: 5, weight: 30 },
        { score: 5, weight: 30 },
      ];

      const result = calculateAppraisalScores({
        ratings,
        totalDeductions: 0,
        growthCap: 20,
        currentBasicSalary: 50000,
      });

      assert.equal(result.rawWeightedScore, 5.0);
      assert.equal(result.netScore, 5.0);
      assert.equal(result.performanceRatio, 1.0); // 5/5
      assert.equal(result.finalAppraisalPercentage, 20.0); // 1.0 * 20%
      assert.equal(result.revisedBasicSalary, 60000); // 50000 + 20%
    });

    it("should deduct admin infractions from net score and reduce appraisal increment", () => {
      const ratings = [
        { score: 4, weight: 50 }, // 2.0
        { score: 4, weight: 50 }, // 2.0 -> raw = 4.0
      ];

      const result = calculateAppraisalScores({
        ratings,
        totalDeductions: 1.0, // infraction deduction
        growthCap: 15,
        currentBasicSalary: 40000,
      });

      assert.equal(result.rawWeightedScore, 4.0);
      assert.equal(result.netScore, 3.0); // 4.0 - 1.0
      assert.equal(result.performanceRatio, 0.6); // 3.0 / 5.0
      assert.equal(result.finalAppraisalPercentage, 9.0); // 0.6 * 15%
      assert.equal(result.revisedBasicSalary, 43600); // 40000 + 9%
    });

    it("should not allow netScore to fall below 0", () => {
      const ratings = [{ score: 2, weight: 100 }]; // 2.0
      const result = calculateAppraisalScores({
        ratings,
        totalDeductions: 3.5, // deduction exceeds score
        growthCap: 15,
        currentBasicSalary: 30000,
      });

      assert.equal(result.netScore, 0);
      assert.equal(result.performanceRatio, 0);
      assert.equal(result.finalAppraisalPercentage, 0);
      assert.equal(result.revisedBasicSalary, 30000);
    });
  });
});
