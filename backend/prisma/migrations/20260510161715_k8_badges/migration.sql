-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BadgeCode" ADD VALUE 'FIRST_COMMENT';
ALTER TYPE "BadgeCode" ADD VALUE 'CONVERSATIONALIST';
ALTER TYPE "BadgeCode" ADD VALUE 'DISCUSSION_LEADER';
ALTER TYPE "BadgeCode" ADD VALUE 'FIRST_BOOKMARK';
ALTER TYPE "BadgeCode" ADD VALUE 'BOOKWORM';
ALTER TYPE "BadgeCode" ADD VALUE 'SUPPORTER';
ALTER TYPE "BadgeCode" ADD VALUE 'FIRST_ARTICLE';
ALTER TYPE "BadgeCode" ADD VALUE 'PROLIFIC_WRITER';
ALTER TYPE "BadgeCode" ADD VALUE 'MASTER_AUTHOR';
ALTER TYPE "BadgeCode" ADD VALUE 'VERIFIED_AUTHOR';
ALTER TYPE "BadgeCode" ADD VALUE 'TRENDING';
ALTER TYPE "BadgeCode" ADD VALUE 'VIRAL';
ALTER TYPE "BadgeCode" ADD VALUE 'TOP_CURATOR';
