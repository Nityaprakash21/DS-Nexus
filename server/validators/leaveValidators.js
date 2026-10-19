import { z } from "zod";

export const createLeaveSchema = z.object({
  type: z.enum(["CASUAL", "SICK", "UNPAID", "ANNUAL"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().trim().min(3, "Reason must be at least 3 characters"),
});

export const updateLeaveStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().optional().nullable(),
}).passthrough();

export const updateLeaveSchema = z.object({
  type: z.enum(["CASUAL", "SICK"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().trim().min(3, "Reason must be at least 3 characters"),
}).passthrough();
