import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Role } from "@prisma/client";
import prisma from "../config/db";
import { ACCESS_COOKIE_NAME } from "../utils/authCookies";
import { getCookie } from "../utils/requestCookies";

export interface AuthPayload {
  userId: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = getCookie(req, ACCESS_COOKIE_NAME);
  const token = bearerToken || cookieToken;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isActive: true, emailVerified: true },
    });

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "User account is banned" });
      return;
    }
    if (!user.emailVerified) {
      res.status(403).json({ error: "Email verification required" });
      return;
    }

    req.user = { userId: user.id, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Soft authentication: if a valid Bearer token is present, populate req.user.
 * Otherwise continue silently. Use for public endpoints that personalise the
 * response when the caller is logged in (e.g. "did the current user like this
 * comment?").
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = getCookie(req, ACCESS_COOKIE_NAME);
  const token = bearerToken || cookieToken;

  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isActive: true, emailVerified: true },
    });
    if (user && user.isActive && user.emailVerified) {
      req.user = { userId: user.id, role: user.role };
    }
  } catch {
    // Bad token — treat as anonymous, do not error.
  }
  next();
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
