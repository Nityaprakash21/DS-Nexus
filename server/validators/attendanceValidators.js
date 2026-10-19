import { z } from "zod";

export const clockInOutSchema = z.object({
  action: z.enum(["CLOCK_IN", "CLOCK_OUT"]).optional(),
  latitude: z.union([z.number(), z.string()]).optional().nullable(),
  longitude: z.union([z.number(), z.string()]).optional().nullable(),
  accuracy: z.union([z.number(), z.string()]).optional().nullable(),
  force: z.boolean().optional(),
  attendanceId: z.string().optional(),
});

export const attendanceCorrectionSchema = z.object({
  date: z.string().min(1, "Date is required"),
  inTime: z.string().optional().nullable(),
  outTime: z.string().optional().nullable(),
  requestedCheckIn: z.string().optional().nullable(),
  requestedCheckOut: z.string().optional().nullable(),
  reason: z.string().trim().min(3, "A valid reason (min 3 chars) is required"),
}).passthrough();

export const reviewCorrectionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]).optional(),
  status: z.enum(["APPROVED", "REJECTED"]).optional(),
  remarks: z.string().optional().nullable(),
  reviewNote: z.string().optional().nullable(),
}).passthrough().refine((data) => data.action || data.status, {
  message: "Action ('APPROVE' / 'REJECT') or status ('APPROVED' / 'REJECTED') is required.",
});
