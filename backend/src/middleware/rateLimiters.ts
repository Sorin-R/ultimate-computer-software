import rateLimit from "express-rate-limit";
import { Request } from "express";

function keyForRequest(req: Request): string {
  const authedUserId = req.user?.userId;
  if (authedUserId) return `user:${authedUserId}`;
  return `ip:${req.ip}`;
}

export function createUserOrIpRateLimiter(options: {
  windowMs: number;
  max: number;
  skipInDev?: boolean;
}) {
  const isProd = process.env.NODE_ENV === "production";

  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    keyGenerator: keyForRequest,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." },
    skip: () => !isProd && options.skipInDev !== false,
  });
}

export const reportRateLimiter = createUserOrIpRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
});

export const dmRateLimiter = createUserOrIpRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
});

export const passwordResetRateLimiter = createUserOrIpRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
});

export const dataRequestRateLimiter = createUserOrIpRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
});

export const contactInquiryRateLimiter = createUserOrIpRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
});
