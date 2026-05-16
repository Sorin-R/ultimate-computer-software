import prisma from "../config/db";

export async function hasUserBlockBetween(userAId: string, userBId: string): Promise<boolean> {
  if (!userAId || !userBId || userAId === userBId) return false;

  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerUserId: userAId, blockedUserId: userBId },
        { blockerUserId: userBId, blockedUserId: userAId },
      ],
    },
    select: { blockerUserId: true },
  });

  return !!block;
}

export async function blockedByUserIds(blockerUserId: string): Promise<string[]> {
  if (!blockerUserId) return [];
  const blocks = await prisma.userBlock.findMany({
    where: { blockerUserId },
    select: { blockedUserId: true },
  });
  return blocks.map((block) => block.blockedUserId);
}
