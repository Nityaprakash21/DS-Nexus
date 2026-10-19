import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Valid email address is required"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters long"),
});
