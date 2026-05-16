import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if ((err as any)?.type === "entity.too.large" || (err as any)?.status === 413) {
    res.status(413).json({
      error: "Request entity too large. Please reduce article body size or upload media separately.",
    });
    return;
  }

  console.error("Unhandled error:", err.message);
  res.status(500).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
}
