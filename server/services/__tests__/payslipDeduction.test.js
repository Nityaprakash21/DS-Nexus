import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Pure calculation logic matching server/controllers/payslipController.js
 */
function resolvePayslipDeductions({
    lwp,
    tax,
    adjustments,
    customDeductions = [],
    isLwpModified = false,
    overrideDeductions = false,
    basicVal = 0,
    absentDaysCount = 0,
    validPresentDays = 0,
}) {
    const hasExplicitLwp = lwp !== undefined && lwp !== null && lwp !== "";
    const isLwpOverridden = isLwpModified === true || (overrideDeductions === true && isLwpModified !== false);
    let lwpVal = hasExplicitLwp ? Math.max(0, Number(lwp) || 0) : 0;

    // Auto-calculate LWP from Attendance records ONLY IF Super Admin did NOT manually manipulate/override LWP
    if (!isLwpOverridden && basicVal > 0) {
        if (!hasExplicitLwp || lwpVal === 0) {
            if (absentDaysCount > 0) {
                if (validPresentDays > 0) {
                    const perDay = basicVal / validPresentDays;
                    lwpVal = parseFloat((perDay * absentDaysCount).toFixed(2));
                } else {
                    lwpVal = basicVal;
                }
            }
        }
    }

    const taxVal = Math.max(0, Number(tax) || 0);
    const adjustmentsVal = Math.max(0, Number(adjustments) || 0);

    let parsedCustomDeductions = [];
    if (Array.isArray(customDeductions)) {
        parsedCustomDeductions = customDeductions
            .map((item) => ({
                name: String(item.name || "").trim(),
                amount: Math.max(0, Number(item.amount) || 0),
            }))
            .filter((item) => item.name && item.amount > 0);
    }

    const customDeductionsTotal = parsedCustomDeductions.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalDeductions = lwpVal + taxVal + adjustmentsVal + customDeductionsTotal;

    return {
        lwpVal,
        taxVal,
        adjustmentsVal,
        totalDeductions,
    };
}

describe("Payslip Deduction Manual Override vs System Computation Suite", () => {
    it("should preserve Super Admin manual 0 deduction when overridden and not overwrite with attendance absent computation", () => {
        // Employee has basic salary 25,000 and 3 absent days (would compute 2,777.78)
        // Super Admin manually set LWP to 0 and overrideDeductions is true
        const result = resolvePayslipDeductions({
            lwp: 0,
            tax: 0,
            adjustments: 0,
            isLwpModified: true,
            overrideDeductions: true,
            basicVal: 25000,
            absentDaysCount: 3,
            validPresentDays: 27,
        });

        assert.equal(result.lwpVal, 0, "LWP must remain 0 when Super Admin manually overrides");
        assert.equal(result.totalDeductions, 0, "Total deductions must be 0");
    });

    it("should finalize system attendance calculation when Super Admin does not manipulate deductions", () => {
        // Super Admin did not touch anything (isLwpModified: false, overrideDeductions: false)
        const result = resolvePayslipDeductions({
            lwp: 0,
            tax: 0,
            adjustments: 0,
            isLwpModified: false,
            overrideDeductions: false,
            basicVal: 25000,
            absentDaysCount: 3,
            validPresentDays: 27,
        });

        // 25000 / 27 * 3 = 2777.78
        assert.equal(result.lwpVal, 2777.78, "System computation should be finalized when admin did not manipulate");
        assert.equal(result.totalDeductions, 2777.78);
    });

    it("should preserve Super Admin custom deduction when overridden", () => {
        const result = resolvePayslipDeductions({
            lwp: 500,
            tax: 200,
            adjustments: 100,
            isLwpModified: true,
            overrideDeductions: true,
            basicVal: 25000,
            absentDaysCount: 3,
            validPresentDays: 27,
        });

        assert.equal(result.lwpVal, 500, "Super admin custom LWP of 500 must be preserved");
        assert.equal(result.taxVal, 200);
        assert.equal(result.adjustmentsVal, 100);
        assert.equal(result.totalDeductions, 800);
    });

    it("should correctly handle unprovided/undefined LWP and auto-calculate", () => {
        const result = resolvePayslipDeductions({
            lwp: undefined,
            tax: 0,
            adjustments: 0,
            isLwpModified: false,
            overrideDeductions: false,
            basicVal: 30000,
            absentDaysCount: 2,
            validPresentDays: 28,
        });

        // 30000 / 28 * 2 = 2142.86
        assert.equal(result.lwpVal, 2142.86);
        assert.equal(result.totalDeductions, 2142.86);
    });
});
