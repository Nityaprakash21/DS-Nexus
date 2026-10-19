import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateIncentiveMetrics, aggregateIncentiveStats } from "../incentiveService.js";

describe("Incentive Service Core Suite", () => {
  describe("calculateIncentiveMetrics", () => {
    it("should compute commission amount and 12-month projection accurately", () => {
      const result = calculateIncentiveMetrics({
        transactionPerMonth: 50000,
        commissionPercentage: 10,
      });

      assert.equal(result.transactionPerMonth, 50000);
      assert.equal(result.projectedIncomeYearly, 600000); // 50000 * 12
      assert.equal(result.commissionPercentage, 10);
      assert.equal(result.incentiveAmount, 5000); // 10% of 50000
    });

    it("should prioritize explicit incentiveAmount over computed percentage if provided", () => {
      const result = calculateIncentiveMetrics({
        transactionPerMonth: 50000,
        commissionPercentage: 10,
        incentiveAmount: 7500, // explicit bonus override
      });

      assert.equal(result.incentiveAmount, 7500);
    });
  });

  describe("aggregateIncentiveStats", () => {
    it("should correctly sum transaction volumes and calculate average commission", () => {
      const records = [
        { transactionPerMonth: 10000, incentiveAmount: 1000, projectedIncomeYearly: 120000, commissionPercentage: 10 },
        { transactionPerMonth: 20000, incentiveAmount: 4000, projectedIncomeYearly: 240000, commissionPercentage: 20 },
      ];

      const stats = aggregateIncentiveStats(records);

      assert.equal(stats.totalRecords, 2);
      assert.equal(stats.totalTransactionVolume, 30000);
      assert.equal(stats.totalIncentivePaid, 5000);
      assert.equal(stats.totalProjectedVolume, 360000);
      assert.equal(stats.avgCommissionPct, 15); // (10 + 20) / 2
    });
  });
});
