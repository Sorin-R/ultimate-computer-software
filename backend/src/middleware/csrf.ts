import { NextFunction, Request, Response } from "express";
import {
  ACCESS_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ensureCsrfCookie,
} from "../utils/authCookies";
import { getCookie } from "../utils/requestCookies";
import { constantTimeEquals } from "../utils/security";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Read-only endpoints that use POST purely to carry a request body (e.g. the
// homepage feed sends anonymous reading-history in the body instead of the URL).
// They never mutate server state, so CSRF protection does not apply — and
// enforcing it breaks logged-in users when the CSRF cookie hasn't been set yet.
const CSRF_EXEMPT_POST_PATHS = new Set<string>([
  "/api/home/feed",
  "/api/home/main-article",
]);

function requestHasApiPath(req: Request): boolean {
  return req.path.startsWith("/api/");
}

function requestHasBearerAuth(req: Request): boolean {
  const header = req.headers.authorization;
  return typeof header === "string" && header.startsWith("Bearer ");
}

function requestHasSessionCookie(req: Request): boolean {
  return Boolean(getCookie(req, ACCESS_COOKIE_NAME) || getCookie(req, REFRESH_COOKIE_NAME));
}

function requestCsrfHeader(req: Request): string | null {
  const value = req.header("x-csrf-token");
  if (!value || typeof value !== "string") return null;
  return value;
}

export function attachCsrfCookie(req: Request, res: Response, next: NextFunction): void {
  if (requestHasApiPath(req) && !getCookie(req, CSRF_COOKIE_NAME)) {
    ensureCsrfCookie(req, res);
  }
  next();
}

export function requireCsrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!requestHasApiPath(req) || SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Read-only POST endpoints (feed/main-article) carry a body but mutate
  // nothing, so they are exempt from the double-submit CSRF check.
  if (CSRF_EXEMPT_POST_PATHS.has(req.path)) {
    next();
    return;
  }

  if (requestHasBearerAuth(req) || !requestHasSessionCookie(req)) {
    next();
    return;
  }

  const cookieToken = getCookie(req, CSRF_COOKIE_NAME);
  const headerToken = requestCsrfHeader(req);

  if (!cookieToken || !headerToken || !constantTimeEquals(cookieToken, headerToken)) {
    res.status(403).json({ error: "CSRF token missing or invalid" });
    return;
  }

  next();
}
