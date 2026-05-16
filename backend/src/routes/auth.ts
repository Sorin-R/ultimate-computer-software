import { Router } from "express";
import {
  register,
  login,
  loginWithTwoFactor,
  logout,
  me,
  csrfToken,
  refreshToken,
  setupTwoFactor,
  verifyTwoFactorSetup,
  disableTwoFactor,
  requestPasswordReset,
  confirmPasswordReset,
  verifyEmail,
  resendVerificationEmail,
} from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  registerSchema,
  loginSchema,
  login2faSchema,
  twoFactorVerifySchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "../validators/auth";
import rateLimit from "express-rate-limit";
import { passwordResetRateLimiter } from "../middleware/rateLimiters";

const router = Router();

const isProd = process.env.NODE_ENV === "production";
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 1000,
  message: { error: "Too many attempts, try again later" },
  // Skip in non-production so iterative dev/testing doesn't lock you out.
  skip: () => !isProd,
});

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/login/2fa", authLimiter, validate(login2faSchema), loginWithTwoFactor);
router.post("/verify-email", authLimiter, validate(verifyEmailSchema), verifyEmail);
router.post(
  "/resend-verification",
  passwordResetRateLimiter,
  validate(resendVerificationSchema),
  resendVerificationEmail
);
router.get("/csrf", csrfToken);
router.post("/logout", logout);
router.post("/refresh", authLimiter, refreshToken);
router.get("/me", authenticate, me);
router.post("/2fa/setup", authenticate, setupTwoFactor);
router.post("/2fa/verify", authenticate, validate(twoFactorVerifySchema), verifyTwoFactorSetup);
router.post("/2fa/disable", authenticate, validate(twoFactorVerifySchema), disableTwoFactor);
router.post(
  "/password-reset/request",
  passwordResetRateLimiter,
  validate(passwordResetRequestSchema),
  requestPasswordReset
);
router.post(
  "/password-reset/confirm",
  passwordResetRateLimiter,
  validate(passwordResetConfirmSchema),
  confirmPasswordReset
);

export default router;
