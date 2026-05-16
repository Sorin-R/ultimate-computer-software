import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthPayload } from "../middleware/auth";
import { randomTokenUrlSafe } from "./security";

export const ACCESS_COOKIE_NAME = "ucs_access_token";
export const REFRESH_COOKIE_NAME = "ucs_refresh_token";
export const CSRF_COOKIE_NAME = "ucs_csrf_token";

export interface RefreshTokenPayload extends AuthPayload {
  sid: string;
  tokenType: "refresh";
}

export function durationMs(value: string): number {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) return 15 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000;
  }
}

export function refreshTokenExpiresAt(): Date {
  return new Date(Date.now() + durationMs(env.JWT_REFRESH_EXPIRES_IN));
}

export function generateTokenPair(payload: AuthPayload): {
  accessToken: string;
  refreshToken: string;
};
export function generateTokenPair(
  payload: AuthPayload,
  refreshSessionId: string
): {
  accessToken: string;
  refreshToken: string;
};
export function generateTokenPair(
  payload: AuthPayload,
  refreshSessionId?: string
): {
  accessToken: string;
  refreshToken: string;
} {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
  const refreshPayload: RefreshTokenPayload = {
    ...payload,
    sid: refreshSessionId || randomTokenUrlSafe(24),
    tokenType: "refresh",
  };
  const refreshToken = jwt.sign(refreshPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
  });
  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

function setCsrfCookie(req: Request, res: Response): string {
  const secure = env.COOKIE_SECURE || req.secure;
  const sameSite = env.COOKIE_SAME_SITE;
  const token = randomTokenUrlSafe(24);

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure,
    sameSite,
    path: "/",
    maxAge: durationMs(env.JWT_REFRESH_EXPIRES_IN),
  });

  return token;
}

export function ensureCsrfCookie(req: Request, res: Response): string {
  return setCsrfCookie(req, res);
}

export function setAuthCookies(
  req: Request,
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
): void {
  const secure = env.COOKIE_SECURE || req.secure;
  const sameSite = env.COOKIE_SAME_SITE;

  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: durationMs(env.JWT_EXPIRES_IN),
  });

  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: durationMs(env.JWT_REFRESH_EXPIRES_IN),
  });

  setCsrfCookie(req, res);
}

export function clearAuthCookies(req: Request, res: Response): void {
  const secure = env.COOKIE_SECURE || req.secure;
  const sameSite = env.COOKIE_SAME_SITE;

  res.clearCookie(ACCESS_COOKIE_NAME, { httpOnly: true, secure, sameSite, path: "/" });
  res.clearCookie(REFRESH_COOKIE_NAME, { httpOnly: true, secure, sameSite, path: "/" });
  res.clearCookie(CSRF_COOKIE_NAME, { httpOnly: false, secure, sameSite, path: "/" });
}
