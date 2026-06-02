import { Request, Response, NextFunction } from "express";
import { getFromR2 } from "../services/r2Service";

// Express middleware — handles all requests under /api/media/*
export async function mediaHandler(req: Request, res: Response) {
  // req.path is relative to where this middleware is mounted
  // When mounted at /api/media, req.path will be / or /something
  let key = req.path.replace(/^\/+/, "");

  if (!key || key.includes("..")) {
    return res.status(400).json({ error: "Invalid key" });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const obj = await getFromR2(key);
    if (!obj) {
      return res.status(404).json({ error: "Not found" });
    }

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Type", obj.contentType ?? "application/octet-stream");
    res.setHeader("Content-Length", obj.body.length);
    return res.send(obj.body);
  } catch (error) {
    console.error("Media proxy error:", error);
    return res.status(500).json({ error: "Failed to serve media" });
  }
}
