import { Request, Response } from "express";
import prisma from "../config/db";
import { param } from "../utils/params";

export async function blockUser(req: Request, res: Response): Promise<void> {
  const blockerUserId = req.user!.userId;
  const blockedUserId = param(req.params.id || req.params.userId);

  if (!blockedUserId) {
    res.status(400).json({ error: "User id is required" });
    return;
  }

  if (blockerUserId === blockedUserId) {
    res.status(400).json({ error: "You cannot block yourself" });
    return;
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: blockedUserId },
    select: { id: true, isActive: true },
  });

  if (!targetUser || !targetUser.isActive) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await prisma.$transaction([
    prisma.userBlock.upsert({
      where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId } },
      update: {},
      create: { blockerUserId, blockedUserId },
    }),
    prisma.subscription.deleteMany({
      where: {
        OR: [
          { subscriberId: blockerUserId, creatorId: blockedUserId },
          { subscriberId: blockedUserId, creatorId: blockerUserId },
        ],
      },
    }),
  ]);

  res.status(201).json({ ok: true });
}

export async function unblockUser(req: Request, res: Response): Promise<void> {
  const blockerUserId = req.user!.userId;
  const blockedUserId = param(req.params.id || req.params.userId);

  await prisma.userBlock.deleteMany({
    where: { blockerUserId, blockedUserId },
  });

  res.json({ ok: true });
}

export async function listBlockedUsers(req: Request, res: Response): Promise<void> {
  const blockerUserId = req.user!.userId;

  const blocked = await prisma.userBlock.findMany({
    where: { blockerUserId },
    orderBy: { createdAt: "desc" },
    include: {
      blockedUser: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
  });

  res.json({
    blockedUsers: blocked.map((entry) => ({
      blockedAt: entry.createdAt,
      user: entry.blockedUser,
    })),
  });
}
