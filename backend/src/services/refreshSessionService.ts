import { Request } from "express";
import prisma from "../config/db";
import { randomTokenUrlSafe } from "../utils/security";

const MAX_USER_AGENT_LENGTH = 512;
const MAX_IP_LENGTH = 128;

function requestUserAgent(req: Request): string | null {
  const value = req.header("user-agent");
  if (!value) return null;
  return value.slice(0, MAX_USER_AGENT_LENGTH);
}

function requestIp(req: Request): string | null {
  if (!req.ip) return null;
  return req.ip.slice(0, MAX_IP_LENGTH);
}

export function newRefreshSessionId(): string {
  return randomTokenUrlSafe(24);
}

export async function createRefreshSession(params: {
  req: Request;
  sessionId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  rotatedFromSessionId?: string;
}): Promise<void> {
  await prisma.refreshSession.create({
    data: {
      id: params.sessionId,
      userId: params.userId,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
      rotatedFromSessionId: params.rotatedFromSessionId,
      userAgent: requestUserAgent(params.req),
      ipAddress: requestIp(params.req),
    },
  });
}

export async function findRefreshSession(sessionId: string) {
  return prisma.refreshSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      tokenHash: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          role: true,
          isActive: true,
          emailVerified: true,
          name: true,
          email: true,
          twoFactorEnabled: true,
          referralCode: true,
        },
      },
    },
  });
}

export async function rotateRefreshSession(params: {
  currentSessionId: string;
  newSessionId: string;
  userId: string;
  newTokenHash: string;
  newExpiresAt: Date;
  req: Request;
}): Promise<void> {
  const now = new Date();

  await prisma.$transaction([
    prisma.refreshSession.update({
      where: { id: params.currentSessionId },
      data: {
        revokedAt: now,
        revokeReason: "ROTATED",
        lastUsedAt: now,
      },
    }),
    prisma.refreshSession.create({
      data: {
        id: params.newSessionId,
        userId: params.userId,
        tokenHash: params.newTokenHash,
        expiresAt: params.newExpiresAt,
        rotatedFromSessionId: params.currentSessionId,
        userAgent: requestUserAgent(params.req),
        ipAddress: requestIp(params.req),
      },
    }),
  ]);
}

export async function revokeRefreshSession(sessionId: string, reason: string): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: {
      id: sessionId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokeReason: reason,
    },
  });
}

export async function revokeAllUserRefreshSessions(userId: string, reason: string): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokeReason: reason,
    },
  });
}
