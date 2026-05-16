import {
  ContentReportStatus,
  ContentReportTargetType,
  ReportReason,
  Role,
} from "@prisma/client";
import { Request, Response } from "express";
import prisma from "../config/db";
import { param } from "../utils/params";
import { stripHtml } from "../utils/sanitize";
import { hasUserBlockBetween } from "../utils/userBlocks";

const VALID_TARGET_TYPES: ContentReportTargetType[] = ["ARTICLE", "COMMENT", "USER", "DM"];
const VALID_REASONS: ReportReason[] = [
  "SPAM",
  "HARASSMENT",
  "HATE_SPEECH",
  "MISINFORMATION",
  "OFF_TOPIC",
  "OTHER",
];

const VALID_STATUSES: ContentReportStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACTION_TAKEN",
  "NO_VIOLATION_FOUND",
  "DISMISSED",
];

function isModerator(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}

type ModerationTarget =
  | { type: "ARTICLE"; label: string; path: string }
  | { type: "COMMENT"; label: string; path: string }
  | { type: "USER"; label: string; path: string };

async function resolveTargetOwner(
  targetType: ContentReportTargetType,
  targetId: string
): Promise<{ exists: boolean; ownerUserId: string | null }> {
  if (targetType === "ARTICLE") {
    const article = await prisma.article.findUnique({
      where: { id: targetId },
      select: { userId: true, status: true },
    });
    if (!article || article.status !== "PUBLISHED") return { exists: false, ownerUserId: null };
    return { exists: true, ownerUserId: article.userId };
  }

  if (targetType === "COMMENT") {
    const comment = await prisma.comment.findUnique({
      where: { id: targetId },
      select: { userId: true },
    });
    if (!comment) return { exists: false, ownerUserId: null };
    return { exists: true, ownerUserId: comment.userId };
  }

  if (targetType === "USER") {
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) return { exists: false, ownerUserId: null };
    return { exists: true, ownerUserId: user.id };
  }

  // DM target is intentionally placeholder until DM subsystem exists.
  return { exists: false, ownerUserId: null };
}

export async function createReport(req: Request, res: Response): Promise<void> {
  const reporterId = req.user?.userId;
  if (!reporterId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const body = req.body as {
    targetType?: unknown;
    targetId?: unknown;
    reason?: unknown;
    description?: unknown;
  };

  const targetType = body.targetType as ContentReportTargetType;
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const reason = body.reason as ReportReason;
  const description =
    typeof body.description === "string"
      ? stripHtml(body.description).trim().slice(0, 1000)
      : null;

  if (!VALID_TARGET_TYPES.includes(targetType)) {
    res.status(400).json({ error: "Invalid report target type" });
    return;
  }

  if (!targetId) {
    res.status(400).json({ error: "Target id is required" });
    return;
  }

  if (!VALID_REASONS.includes(reason)) {
    res.status(400).json({ error: "Invalid report reason" });
    return;
  }

  if (targetType === "DM") {
    // TODO(trust-safety): connect this flow to the DM storage layer when DM APIs land.
    res.status(501).json({ error: "DM reporting is not available yet" });
    return;
  }

  const target = await resolveTargetOwner(targetType, targetId);
  if (!target.exists) {
    res.status(404).json({ error: "Target not found" });
    return;
  }

  if (target.ownerUserId && target.ownerUserId === reporterId) {
    res.status(400).json({ error: "You cannot report your own content" });
    return;
  }

  if (target.ownerUserId) {
    const blockedEitherWay = await hasUserBlockBetween(reporterId, target.ownerUserId);
    if (blockedEitherWay) {
      // Still allow reporting but do not expose any extra data.
    }
  }

  const report = await prisma.contentReport.create({
    data: {
      reporterId,
      targetType,
      targetId,
      targetUserId: target.ownerUserId,
      reason,
      description,
      status: "UNDER_REVIEW",
      statusUpdatedAt: new Date(),
    },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      reason: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });

  res.status(201).json({ report });
}

export async function getMyReports(req: Request, res: Response): Promise<void> {
  const reporterId = req.user!.userId;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const [reports, total] = await Promise.all([
    prisma.contentReport.findMany({
      where: { reporterId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        description: true,
        status: true,
        publicUpdate: true,
        statusUpdatedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.contentReport.count({ where: { reporterId } }),
  ]);

  res.json({
    reports,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function listReportsForModeration(req: Request, res: Response): Promise<void> {
  if (!isModerator(req.user?.role)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const statusRaw = req.query.status as string | undefined;
  const reasonRaw = req.query.reason as string | undefined;
  const targetTypeRaw = req.query.targetType as string | undefined;

  const where: {
    status?: ContentReportStatus;
    reason?: ReportReason;
    targetType?: ContentReportTargetType;
  } = {};

  if (statusRaw && VALID_STATUSES.includes(statusRaw as ContentReportStatus)) {
    where.status = statusRaw as ContentReportStatus;
  }
  if (reasonRaw && VALID_REASONS.includes(reasonRaw as ReportReason)) {
    where.reason = reasonRaw as ReportReason;
  }
  if (targetTypeRaw && VALID_TARGET_TYPES.includes(targetTypeRaw as ContentReportTargetType)) {
    where.targetType = targetTypeRaw as ContentReportTargetType;
  }

  const [reportsRaw, total] = await Promise.all([
    prisma.contentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        targetUser: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true } },
      },
    }),
    prisma.contentReport.count({ where }),
  ]);

  const articleTargetIds = reportsRaw
    .filter((report) => report.targetType === "ARTICLE")
    .map((report) => report.targetId);
  const commentTargetIds = reportsRaw
    .filter((report) => report.targetType === "COMMENT")
    .map((report) => report.targetId);
  const userTargetIds = reportsRaw
    .filter((report) => report.targetType === "USER")
    .map((report) => report.targetId);

  const [articleTargets, commentTargets, userTargets] = await Promise.all([
    articleTargetIds.length > 0
      ? prisma.article.findMany({
          where: { id: { in: articleTargetIds } },
          select: { id: true, title: true, slug: true },
        })
      : Promise.resolve([]),
    commentTargetIds.length > 0
      ? prisma.comment.findMany({
          where: { id: { in: commentTargetIds } },
          select: {
            id: true,
            article: {
              select: { slug: true, title: true },
            },
          },
        })
      : Promise.resolve([]),
    userTargetIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userTargetIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const articleById = new Map(articleTargets.map((article) => [article.id, article]));
  const commentById = new Map(commentTargets.map((comment) => [comment.id, comment]));
  const userById = new Map(userTargets.map((user) => [user.id, user]));

  const reports = reportsRaw.map((report) => {
    let moderationTarget: ModerationTarget | null = null;

    if (report.targetType === "ARTICLE") {
      const article = articleById.get(report.targetId);
      if (article) {
        moderationTarget = {
          type: "ARTICLE",
          label: article.title,
          path: `/${article.slug}`,
        };
      }
    } else if (report.targetType === "COMMENT") {
      const comment = commentById.get(report.targetId);
      if (comment) {
        moderationTarget = {
          type: "COMMENT",
          label: `Comment on: ${comment.article.title}`,
          path: `/${comment.article.slug}`,
        };
      }
    } else if (report.targetType === "USER") {
      const user = userById.get(report.targetId);
      if (user) {
        moderationTarget = {
          type: "USER",
          label: user.name,
          path: `/author/${user.id}`,
        };
      }
    }

    return {
      ...report,
      moderationTarget,
    };
  });

  res.json({ reports, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

export async function updateReportForModeration(req: Request, res: Response): Promise<void> {
  if (!isModerator(req.user?.role)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  const id = param(req.params.id);
  const body = req.body as {
    status?: unknown;
    internalNote?: unknown;
    publicUpdate?: unknown;
  };

  const status =
    VALID_STATUSES.includes(body.status as ContentReportStatus)
      ? (body.status as ContentReportStatus)
      : undefined;

  if (!status) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const internalNote =
    typeof body.internalNote === "string"
      ? stripHtml(body.internalNote).trim().slice(0, 2000)
      : undefined;
  const publicUpdate =
    typeof body.publicUpdate === "string"
      ? stripHtml(body.publicUpdate).trim().slice(0, 1000)
      : undefined;

  const existing = await prisma.contentReport.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  const updated = await prisma.contentReport.update({
    where: { id },
    data: {
      status,
      reviewerId: req.user!.userId,
      internalNote,
      publicUpdate,
      statusUpdatedAt: new Date(),
    },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      targetUser: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true } },
    },
  });

  res.json({ report: updated });
}
