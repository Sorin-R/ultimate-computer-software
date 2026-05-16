import {
  PolicyComplianceActionType,
  PolicyComplianceStatus,
  Role,
} from "@prisma/client";
import { Request, Response } from "express";
import prisma from "../config/db";
import { param } from "../utils/params";
import { stripHtml } from "../utils/sanitize";

const VALID_ACTION_TYPES: PolicyComplianceActionType[] = [
  "WARNING",
  "CONTENT_REMOVED",
  "TEMP_RESTRICTION",
  "PERMANENT_BAN",
  "APPEAL_ACCEPTED",
  "APPEAL_REJECTED",
];

const VALID_STATUSES: PolicyComplianceStatus[] = ["ACTIVE", "RESOLVED"];

function isModerator(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}

export async function getPublicPolicyCompliance(req: Request, res: Response): Promise<void> {
  const userId = param(req.params.id || req.params.userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const entries = await prisma.policyComplianceLog.findMany({
    where: { userId, isPublic: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      actionType: true,
      publicReason: true,
      status: true,
      createdAt: true,
    },
  });

  res.json({ entries });
}

export async function createPolicyComplianceEntry(req: Request, res: Response): Promise<void> {
  if (!isModerator(req.user?.role)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  const userId = param(req.params.id || req.params.userId);
  const actionTypeRaw = (req.body as { actionType?: unknown }).actionType;
  const publicReasonRaw = (req.body as { publicReason?: unknown }).publicReason;
  const statusRaw = (req.body as { status?: unknown }).status;
  const isPublicRaw = (req.body as { isPublic?: unknown }).isPublic;

  if (!VALID_ACTION_TYPES.includes(actionTypeRaw as PolicyComplianceActionType)) {
    res.status(400).json({ error: "Invalid action type" });
    return;
  }

  const publicReason =
    typeof publicReasonRaw === "string" ? stripHtml(publicReasonRaw).trim().slice(0, 2000) : "";

  if (!publicReason) {
    res.status(400).json({ error: "Public reason is required" });
    return;
  }

  const status = VALID_STATUSES.includes(statusRaw as PolicyComplianceStatus)
    ? (statusRaw as PolicyComplianceStatus)
    : "ACTIVE";

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const entry = await prisma.policyComplianceLog.create({
    data: {
      userId,
      actionType: actionTypeRaw as PolicyComplianceActionType,
      publicReason,
      status,
      createdByModeratorId: req.user!.userId,
      isPublic: typeof isPublicRaw === "boolean" ? isPublicRaw : true,
    },
    select: {
      id: true,
      userId: true,
      actionType: true,
      publicReason: true,
      status: true,
      isPublic: true,
      createdAt: true,
    },
  });

  res.status(201).json({ entry });
}
