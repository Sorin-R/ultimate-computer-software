import { Request, Response } from "express";
import { AdDeviceTarget } from "@prisma/client";
import prisma from "../config/db";
import { param } from "../utils/params";

const DEVICE_TARGET_SET = new Set<string>(Object.values(AdDeviceTarget));

function parseDeviceTarget(value: unknown): AdDeviceTarget | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (DEVICE_TARGET_SET.has(normalized)) {
    return normalized as AdDeviceTarget;
  }
  return null;
}

function parseDimension(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

// Fetch all active ads
export async function getAdSenseConfig(req: Request, res: Response): Promise<void> {
  try {
    const requestedDevice = parseDeviceTarget(req.query.device) ?? AdDeviceTarget.ALL;
    const ads = await prisma.ad.findMany({
      where: { isActive: true },
      orderBy: [{ placement: "asc" }, { updatedAt: "desc" }],
    });

    res.json({ ads, device: requestedDevice });
  } catch (err: any) {
    if (err?.code === "P2022") {
      res.status(500).json({
        error:
          "Ad schema is out of sync. Please run backend migration and restart the server.",
      });
      return;
    }
    res.status(500).json({ error: "Failed to fetch ads" });
  }
}

// Get all ads (admin)
export async function getAllAds(req: Request, res: Response): Promise<void> {
  try {
    const ads = await prisma.ad.findMany({
      orderBy: [{ placement: "asc" }, { createdAt: "desc" }],
    });

    res.json({ ads });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ads" });
  }
}

// Create a new ad
export async function createAd(req: Request, res: Response): Promise<void> {
  try {
    const {
      placement,
      displayName,
      content,
      width,
      height,
      isActive,
      deviceTarget: rawDeviceTarget,
    } = req.body;

    if (!placement || !displayName || !content) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const deviceTarget = parseDeviceTarget(rawDeviceTarget ?? "ALL");
    if (!deviceTarget) {
      res.status(400).json({ error: "Invalid device target" });
      return;
    }

    const ad = await prisma.ad.create({
      data: {
        placement,
        deviceTarget,
        displayName,
        content,
        width: parseDimension(width),
        height: parseDimension(height),
        isActive: isActive !== false,
      },
    });

    res.status(201).json({ ad });
  } catch (err: any) {
    if (err?.code === "P2022") {
      res.status(500).json({
        error:
          "Ad schema is out of sync. Please run backend migration and restart the server.",
      });
      return;
    }
    res.status(500).json({ error: "Failed to create ad" });
  }
}

// Update an ad
export async function updateAd(req: Request, res: Response): Promise<void> {
  try {
    const id = param(req.params.id);
    const {
      placement,
      displayName,
      content,
      width,
      height,
      isActive,
      deviceTarget: rawDeviceTarget,
    } = req.body;

    const deviceTarget =
      rawDeviceTarget === undefined ? undefined : parseDeviceTarget(rawDeviceTarget);
    if (rawDeviceTarget !== undefined && !deviceTarget) {
      res.status(400).json({ error: "Invalid device target" });
      return;
    }

    const ad = await prisma.ad.update({
      where: { id },
      data: {
        ...(placement && { placement }),
        ...(deviceTarget && { deviceTarget }),
        ...(displayName && { displayName }),
        ...(content && { content }),
        ...(width !== undefined && { width: parseDimension(width) }),
        ...(height !== undefined && { height: parseDimension(height) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({ ad });
  } catch (err: any) {
    if (err.code === "P2025") {
      res.status(404).json({ error: "Ad not found" });
    } else if (err?.code === "P2022") {
      res.status(500).json({
        error:
          "Ad schema is out of sync. Please run backend migration and restart the server.",
      });
    } else {
      res.status(500).json({ error: "Failed to update ad" });
    }
  }
}

// Delete an ad
export async function deleteAd(req: Request, res: Response): Promise<void> {
  try {
    const id = param(req.params.id);

    await prisma.ad.delete({
      where: { id },
    });

    res.json({ message: "Ad deleted successfully" });
  } catch (err: any) {
    if (err.code === "P2025") {
      res.status(404).json({ error: "Ad not found" });
    } else {
      res.status(500).json({ error: "Failed to delete ad" });
    }
  }
}

// Toggle ad active status
export async function toggleAdStatus(req: Request, res: Response): Promise<void> {
  try {
    const id = param(req.params.id);

    const ad = await prisma.ad.findUnique({ where: { id } });
    if (!ad) {
      res.status(404).json({ error: "Ad not found" });
      return;
    }

    const updated = await prisma.ad.update({
      where: { id },
      data: { isActive: !ad.isActive },
    });

    res.json({ ad: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle ad status" });
  }
}
