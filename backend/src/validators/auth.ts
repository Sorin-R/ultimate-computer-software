import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  ref: z.string().min(2).max(64).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const login2faSchema = z.object({
  twoFactorToken: z.string().min(10),
  code: z.string().min(6).max(20),
});

export const twoFactorVerifySchema = z.object({
  code: z.string().min(6).max(20),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email().max(255),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20),
});

export const resendVerificationSchema = z.object({
  email: z.string().email().max(255),
});
