import { Request } from "express";

export function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;

  const entries = raw.split(";");
  for (const entry of entries) {
    const [key, ...rest] = entry.trim().split("=");
    if (key !== name) continue;
    return decodeURIComponent(rest.join("="));
  }

  return null;
}
