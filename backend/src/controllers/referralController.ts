import prisma from "../config/db";
import { Request, Response } from "express";

function buildReferralCode(name: string, userId: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
  const suffix = userId.slice(-6).toUpperCase();
  return `${base || "USER"}${suffix}`;
}

async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, referralCode: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.referralCode) {
    return user.referralCode;
  }

  let attempt = 0;
  let candidate = "";
  while (attempt < 5) {
    attempt += 1;
    candidate = attempt === 1 ? buildReferralCode(user.name, user.id) : `${buildReferralCode(user.name, user.id)}${attempt}`;
    const exists = await prisma.user.findUnique({ where: { referralCode: candidate }, select: { id: true } });
    if (!exists) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { referralCode: candidate },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    }
  }

  const fallback = `${buildReferralCode(user.name, user.id)}${Date.now().toString().slice(-4)}`;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { referralCode: fallback },
    select: { referralCode: true },
  });
  return updated.referralCode!;
}

export async function getMyReferralOverview(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const referralCode = await ensureReferralCode(userId);

  const [referrals, badge] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerUserId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        referredUser: { select: { id: true, name: true, createdAt: true } },
      },
    }),
    prisma.userBadge.findUnique({
      where: { userId_code: { userId, code: "COMMUNITY_BUILDER" } },
      select: { earnedAt: true },
    }),
  ]);

  res.json({
    referralCode,
    referralCount: referrals.length,
    badge: {
      key: "COMMUNITY_BUILDER",
      label: "Community Builder",
      earned: !!badge,
      awardedAt: badge?.earnedAt ?? null,
    },
    referrals: referrals.map((entry) => ({
      id: entry.id,
      status: entry.status,
      createdAt: entry.createdAt,
      rewardedAt: entry.rewardedAt,
      referredUser: entry.referredUser,
    })),
  });
}

export async function ensureReferralCodeForUser(userId: string): Promise<string> {
  return ensureReferralCode(userId);
}
