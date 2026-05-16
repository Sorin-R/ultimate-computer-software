import { Prisma, Role } from "@prisma/client";
import prisma from "../config/db";

export interface AdminActivityInput {
  actorId: string;
  actorRole: Role;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  details?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

function trimText(value: string | null | undefined, max = 2000): string | null {
  if (!value) return null;
  const next = value.trim();
  if (!next) return null;
  return next.length > max ? next.slice(0, max) : next;
}

export async function logAdminActivity(input: AdminActivityInput): Promise<void> {
  await prisma.adminActivityLog.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType,
      targetId: trimText(input.targetId, 200),
      targetLabel: trimText(input.targetLabel, 300),
      details: trimText(input.details, 4000),
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function logAdminActivitySafe(input: AdminActivityInput): Promise<void> {
  try {
    await logAdminActivity(input);
  } catch (error) {
    console.error("Failed to write admin activity log", error);
  }
}
