import { z } from "zod";

export const submitEvaluationSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  templateId: z.string().min(1, "Template ID is required"),
  teamKey: z.string().optional().default("OPERATIONS"),
  ratings: z.array(
    z.object({
      metricId: z.string().optional(),
      id: z.string().optional(),
      title: z.string().optional(),
      weight: z.coerce.number().min(0).max(100),
      score: z.coerce.number().min(1).max(5),
      comment: z.string().optional().default(""),
    })
  ).min(1, "At least one metric rating is required"),
  evaluatorFeedback: z.string().optional().default(""),
});

export const createAdminDeductionSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  cycleYear: z.string().optional().default("FY 2025-2026"),
  deductionScore: z.coerce.number().min(0.05, "Deduction score must be greater than zero"),
  reasonCategory: z.string().min(1, "Reason category is required"),
  reasonDetails: z.string().min(1, "Reason details are required"),
});

export const reverseAdminDeductionSchema = z.object({
  reversalReason: z.string().optional().default("Reversed by Administrator"),
});

export const updateCycleSchema = z.object({
  cycleName: z.string().optional(),
  yoyBusinessGrowthPercentage: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "DRAFT"]).optional(),
});
