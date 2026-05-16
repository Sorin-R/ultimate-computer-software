import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/db";
import { env } from "../config/env";
import { AuthPayload } from "../middleware/auth";
import {
  buildOtpAuthUrl,
  consumeRecoveryCode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotpCode,
} from "../utils/totp";
import { decryptSecret, encryptSecret, randomTokenUrlSafe, sha256Hex } from "../utils/security";
import { ensureReferralCodeForUser } from "./referralController";
import { sendEmailVerificationEmail, sendPasswordResetEmail } from "../utils/email";
import {
  ensureCsrfCookie,
  clearAuthCookies,
  generateTokenPair,
  REFRESH_COOKIE_NAME,
  refreshTokenExpiresAt,
  setAuthCookies,
  verifyRefreshToken,
} from "../utils/authCookies";
import { getCookie } from "../utils/requestCookies";
import {
  createRefreshSession,
  findRefreshSession,
  newRefreshSessionId,
  revokeAllUserRefreshSessions,
  revokeRefreshSession,
  rotateRefreshSession,
} from "../services/refreshSessionService";

interface TwoFactorChallengePayload {
  userId: string;
  role: AuthPayload["role"];
  purpose: "2fa_login";
}

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function generateTwoFactorChallengeToken(payload: TwoFactorChallengePayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "10m" });
}

function parseTwoFactorChallengeToken(token: string): TwoFactorChallengePayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TwoFactorChallengePayload;
    if (payload?.purpose !== "2fa_login") return null;
    return payload;
  } catch {
    return null;
  }
}

function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

async function issueEmailVerificationToken(userId: string): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = randomTokenUrlSafe(32);
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  const now = new Date();

  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    }),
    prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return { rawToken, expiresAt };
}

async function issueFreshSession(req: Request, res: Response, payload: AuthPayload): Promise<void> {
  const refreshSessionId = newRefreshSessionId();
  const tokens = generateTokenPair(payload, refreshSessionId);

  await createRefreshSession({
    req,
    sessionId: refreshSessionId,
    userId: payload.userId,
    tokenHash: sha256Hex(tokens.refreshToken),
    expiresAt: refreshTokenExpiresAt(),
  });

  setAuthCookies(req, res, tokens);
}

/** Generate a unique URL-safe username slug from the user's display name. */
async function ensureUniqueUsername(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "user";

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt}`;
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

async function ensureUniqueReferralCode(name: string, userId: string): Promise<string> {
  const fallback = `${name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "USER"}${
    userId.slice(-6).toUpperCase()
  }`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? fallback : `${fallback}${attempt}`;
    const existing = await prisma.user.findUnique({
      where: { referralCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  return `${fallback}${Math.floor(Math.random() * 9000 + 1000)}`;
}

async function resolveReferrerId(rawRef: unknown): Promise<string | null> {
  if (typeof rawRef !== "string" || !rawRef.trim()) return null;
  const normalized = rawRef.trim();

  const referrer = await prisma.user.findFirst({
    where: {
      referralCode: { equals: normalized, mode: "insensitive" },
      isActive: true,
    },
    select: { id: true },
  });

  return referrer?.id ?? null;
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password, ref } = req.body as {
    name: string;
    email: string;
    password: string;
    ref?: string;
  };
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = name.trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const referrerId = await resolveReferrerId(ref);

  const usernameSlug = await ensureUniqueUsername(normalizedName);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        passwordHash,
        username: usernameSlug,
        emailVerified: false,
      },
    });

    const referralCode = await ensureUniqueReferralCode(normalizedName, createdUser.id);
    const updatedUser = await tx.user.update({
      where: { id: createdUser.id },
      data: { referralCode },
    });

    if (referrerId && referrerId !== createdUser.id) {
      await tx.referral.create({
        data: {
          referrerUserId: referrerId,
          referredUserId: createdUser.id,
          referralCode: ref || "",
          status: "REWARDED",
          rewardedAt: new Date(),
        },
      });

      await tx.userBadge.createMany({
        data: [
          { userId: referrerId, code: "COMMUNITY_BUILDER" },
          { userId: createdUser.id, code: "COMMUNITY_BUILDER" },
        ],
        skipDuplicates: true,
      });
    }

    return updatedUser;
  });

  const { rawToken, expiresAt } = await issueEmailVerificationToken(user.id);
  const verificationUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(rawToken)}`;
  await sendEmailVerificationEmail(user.email, user.name, verificationUrl, expiresAt);

  res.status(201).json({
    message: "Registration successful. Please verify your email address before signing in.",
    ...(env.NODE_ENV === "production" ? {} : { verificationPreviewUrl: verificationUrl }),
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "User account is banned" });
    return;
  }

  if (!user.emailVerified) {
    res.status(403).json({
      error: "Please verify your email address before signing in.",
      code: "EMAIL_NOT_VERIFIED",
    });
    return;
  }

  if (user.twoFactorEnabled) {
    const twoFactorToken = generateTwoFactorChallengeToken({
      userId: user.id,
      role: user.role,
      purpose: "2fa_login",
    });

    res.json({ requiresTwoFactor: true, twoFactorToken });
    return;
  }

  await issueFreshSession(req, res, { userId: user.id, role: user.role });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      referralCode: user.referralCode,
      emailVerified: user.emailVerified,
    },
  });
}

export async function loginWithTwoFactor(req: Request, res: Response): Promise<void> {
  const { twoFactorToken, code } = req.body as { twoFactorToken: string; code: string };

  const challenge = parseTwoFactorChallengeToken(twoFactorToken);
  if (!challenge) {
    res.status(401).json({ error: "Invalid or expired two-factor token" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: challenge.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      emailVerified: true,
      twoFactorEnabled: true,
      twoFactorSecretEncrypted: true,
      twoFactorRecoveryCodes: true,
      referralCode: true,
    },
  });

  if (!user || !user.isActive || !user.emailVerified || !user.twoFactorEnabled || !user.twoFactorSecretEncrypted) {
    res.status(401).json({ error: "Two-factor verification failed" });
    return;
  }

  let verified = false;
  let remainingRecoveryCodes = user.twoFactorRecoveryCodes;

  try {
    const secret = decryptSecret(user.twoFactorSecretEncrypted);
    verified = verifyTotpCode(secret, code);
  } catch {
    res.status(500).json({ error: "Two-factor configuration error" });
    return;
  }

  if (!verified) {
    const consumed = consumeRecoveryCode(code, user.twoFactorRecoveryCodes);
    verified = consumed.valid;
    remainingRecoveryCodes = consumed.remainingHashedCodes;
  }

  if (!verified) {
    res.status(401).json({ error: "Invalid two-factor code" });
    return;
  }

  if (remainingRecoveryCodes.length !== user.twoFactorRecoveryCodes.length) {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorRecoveryCodes: remainingRecoveryCodes },
    });
  }

  await issueFreshSession(req, res, { userId: user.id, role: user.role });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      referralCode: user.referralCode,
      emailVerified: user.emailVerified,
    },
  });
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const refreshTokenRaw = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
  const refreshTokenValue = refreshTokenRaw || getCookie(req, REFRESH_COOKIE_NAME);
  if (!refreshTokenValue) {
    res.status(400).json({ error: "Refresh token required" });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshTokenValue);
    if (!payload.sid || payload.tokenType !== "refresh") {
      clearAuthCookies(req, res);
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    const session = await findRefreshSession(payload.sid);
    if (!session || session.userId !== payload.userId) {
      await revokeAllUserRefreshSessions(payload.userId, "REUSE_DETECTED");
      clearAuthCookies(req, res);
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    const isExpired = session.expiresAt.getTime() <= Date.now();
    const isRevoked = Boolean(session.revokedAt);
    const isTokenHashMismatch = session.tokenHash !== sha256Hex(refreshTokenValue);

    if (isExpired || isRevoked || isTokenHashMismatch) {
      await revokeAllUserRefreshSessions(session.userId, "REUSE_DETECTED");
      clearAuthCookies(req, res);
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    if (!session.user.isActive) {
      res.status(403).json({ error: "User account is banned" });
      return;
    }
    if (!session.user.emailVerified) {
      clearAuthCookies(req, res);
      res.status(403).json({
        error: "Please verify your email address before signing in.",
        code: "EMAIL_NOT_VERIFIED",
      });
      return;
    }

    const newSessionId = newRefreshSessionId();
    const tokens = generateTokenPair(
      { userId: session.user.id, role: session.user.role },
      newSessionId
    );

    await rotateRefreshSession({
      currentSessionId: session.id,
      newSessionId,
      userId: session.user.id,
      newTokenHash: sha256Hex(tokens.refreshToken),
      newExpiresAt: refreshTokenExpiresAt(),
      req,
    });

    setAuthCookies(req, res, tokens);
    res.json({ ok: true });
  } catch {
    clearAuthCookies(req, res);
    res.status(401).json({ error: "Invalid refresh token" });
  }
}

export async function csrfToken(req: Request, res: Response): Promise<void> {
  const token = ensureCsrfCookie(req, res);
  res.json({ csrfToken: token });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      twoFactorEnabled: true,
      referralCode: true,
      emailVerified: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!user.referralCode) {
    await ensureReferralCodeForUser(user.id);
    const refreshed = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        twoFactorEnabled: true,
        referralCode: true,
        emailVerified: true,
      },
    });
    res.json({ user: refreshed });
    return;
  }

  res.json({ user });
}

export async function setupTwoFactor(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, twoFactorEnabled: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.twoFactorEnabled) {
    res.status(400).json({ error: "Two-factor authentication is already enabled" });
    return;
  }

  const secret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes(10);
  const hashedRecoveryCodes = recoveryCodes.map((code) => hashRecoveryCode(code));

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorSetupSecretEncrypted: encryptSecret(secret),
      twoFactorSetupRecoveryCodes: hashedRecoveryCodes,
    },
  });

  const otpauthUrl = buildOtpAuthUrl(secret, user.email, env.TWO_FACTOR_ISSUER);

  res.json({
    secret,
    otpauthUrl,
    recoveryCodes,
  });
}

export async function verifyTwoFactorSetup(req: Request, res: Response): Promise<void> {
  const { code } = req.body as { code: string };

  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      twoFactorEnabled: true,
      twoFactorSetupSecretEncrypted: true,
      twoFactorSetupRecoveryCodes: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.twoFactorEnabled) {
    res.status(400).json({ error: "Two-factor authentication is already enabled" });
    return;
  }

  if (!user.twoFactorSetupSecretEncrypted) {
    res.status(400).json({ error: "No two-factor setup in progress" });
    return;
  }

  const setupSecret = decryptSecret(user.twoFactorSetupSecretEncrypted);
  const valid = verifyTotpCode(setupSecret, code);

  if (!valid) {
    res.status(400).json({ error: "Invalid authentication code" });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecretEncrypted: user.twoFactorSetupSecretEncrypted,
      twoFactorRecoveryCodes: user.twoFactorSetupRecoveryCodes,
      twoFactorSetupSecretEncrypted: null,
      twoFactorSetupRecoveryCodes: [],
    },
  });

  res.json({ ok: true });
}

export async function disableTwoFactor(req: Request, res: Response): Promise<void> {
  const { code } = req.body as { code: string };

  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      twoFactorEnabled: true,
      twoFactorSecretEncrypted: true,
      twoFactorRecoveryCodes: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecretEncrypted) {
    res.status(400).json({ error: "Two-factor authentication is not enabled" });
    return;
  }

  const secret = decryptSecret(user.twoFactorSecretEncrypted);
  let verified = verifyTotpCode(secret, code);
  let remainingRecoveryCodes = user.twoFactorRecoveryCodes;

  if (!verified) {
    const consumed = consumeRecoveryCode(code, user.twoFactorRecoveryCodes);
    verified = consumed.valid;
    remainingRecoveryCodes = consumed.remainingHashedCodes;
  }

  if (!verified) {
    res.status(400).json({ error: "Invalid authentication code" });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecretEncrypted: null,
      twoFactorRecoveryCodes: [],
      twoFactorSetupSecretEncrypted: null,
      twoFactorSetupRecoveryCodes: [],
    },
  });

  if (remainingRecoveryCodes.length !== user.twoFactorRecoveryCodes.length) {
    // no-op by design; 2FA has been disabled entirely
  }

  res.json({ ok: true });
}

export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string };
  const normalizedEmail = normalizeEmail(email);

  const genericMessage =
    "If that email address exists, a password reset link has been sent.";

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, isActive: true },
  });

  if (!user || !user.isActive) {
    res.json({ message: genericMessage });
    return;
  }

  const rawToken = randomTokenUrlSafe(32);
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(rawToken)}`;
  await sendPasswordResetEmail(user.email, user.name, resetUrl, expiresAt).catch((err) => {
    console.error("Failed to send password reset email", err);
  });

  res.json({ message: genericMessage });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.body as { token: string };

  const tokenHash = sha256Hex(token);
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      usedAt: true,
      expiresAt: true,
    },
  });

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "Verification link is invalid or expired." });
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerified: true },
    }),
    prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);

  res.json({ message: "Email verified successfully. You can now sign in." });
}

export async function resendVerificationEmail(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string };
  const normalizedEmail = normalizeEmail(email);
  const genericMessage = "If the account exists, a verification email has been sent.";

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true, email: true, isActive: true, emailVerified: true },
  });

  if (!user || !user.isActive || user.emailVerified) {
    res.json({ message: genericMessage });
    return;
  }

  const { rawToken, expiresAt } = await issueEmailVerificationToken(user.id);
  const verificationUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(rawToken)}`;
  await sendEmailVerificationEmail(user.email, user.name, verificationUrl, expiresAt);

  res.json({
    message: genericMessage,
    ...(env.NODE_ENV === "production" ? {} : { verificationPreviewUrl: verificationUrl }),
  });
}

export async function confirmPasswordReset(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as { token: string; password: string };

  const tokenHash = sha256Hex(token);
  const resetRow = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      usedAt: true,
      expiresAt: true,
    },
  });

  if (!resetRow || resetRow.usedAt || resetRow.expiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "Reset token is invalid or expired" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRow.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRow.id },
      data: { usedAt: new Date() },
    }),
  ]);
  await revokeAllUserRefreshSessions(resetRow.userId, "PASSWORD_RESET");

  res.json({ ok: true });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const refreshTokenValue = getCookie(req, REFRESH_COOKIE_NAME);

  if (refreshTokenValue) {
    try {
      const payload = verifyRefreshToken(refreshTokenValue);
      if (payload.sid && payload.tokenType === "refresh") {
        await revokeRefreshSession(payload.sid, "LOGOUT");
      }
    } catch {
      // Ignore invalid/expired refresh token during logout.
    }
  }

  clearAuthCookies(req, res);
  res.json({ message: "Logged out successfully" });
}
