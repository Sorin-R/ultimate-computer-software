-- CreateEnum
CREATE TYPE "ContentReportTargetType" AS ENUM ('ARTICLE', 'COMMENT', 'USER', 'DM');

-- CreateEnum
CREATE TYPE "ContentReportStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACTION_TAKEN', 'NO_VIOLATION_FOUND', 'DISMISSED');

-- CreateEnum
CREATE TYPE "PolicyComplianceActionType" AS ENUM ('WARNING', 'CONTENT_REMOVED', 'TEMP_RESTRICTION', 'PERMANENT_BAN', 'APPEAL_ACCEPTED', 'APPEAL_REJECTED');

-- CreateEnum
CREATE TYPE "PolicyComplianceStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('REGISTERED', 'REWARDED');

-- AlterEnum
ALTER TYPE "BadgeCode" ADD VALUE 'COMMUNITY_BUILDER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorRecoveryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "twoFactorSetupRecoveryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "twoFactorSetupSecretEncrypted" TEXT,
ADD COLUMN     "twoFactorSecretEncrypted" TEXT;

-- CreateTable
CREATE TABLE "user_blocks" (
    "blockerUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blockerUserId","blockedUserId")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_compliance_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" "PolicyComplianceActionType" NOT NULL,
    "publicReason" TEXT NOT NULL,
    "status" "PolicyComplianceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByModeratorId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_compliance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ContentReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ContentReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewerId" TEXT,
    "internalNote" TEXT,
    "publicUpdate" TEXT,
    "statusUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardedAt" TIMESTAMP(3),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_blocks_blockerUserId_idx" ON "user_blocks"("blockerUserId");

-- CreateIndex
CREATE INDEX "user_blocks_blockedUserId_idx" ON "user_blocks"("blockedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_createdAt_idx" ON "password_reset_tokens"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "policy_compliance_logs_userId_createdAt_idx" ON "policy_compliance_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "policy_compliance_logs_isPublic_createdAt_idx" ON "policy_compliance_logs"("isPublic", "createdAt");

-- CreateIndex
CREATE INDEX "policy_compliance_logs_createdByModeratorId_idx" ON "policy_compliance_logs"("createdByModeratorId");

-- CreateIndex
CREATE INDEX "content_reports_reporterId_createdAt_idx" ON "content_reports"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "content_reports_status_createdAt_idx" ON "content_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "content_reports_targetType_status_idx" ON "content_reports"("targetType", "status");

-- CreateIndex
CREATE INDEX "content_reports_targetType_targetId_idx" ON "content_reports"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "content_reports_targetUserId_idx" ON "content_reports"("targetUserId");

-- CreateIndex
CREATE INDEX "content_reports_reason_createdAt_idx" ON "content_reports"("reason", "createdAt");

-- CreateIndex
CREATE INDEX "referrals_referrerUserId_createdAt_idx" ON "referrals"("referrerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "referrals_referralCode_idx" ON "referrals"("referralCode");

-- CreateIndex
CREATE INDEX "referrals_status_createdAt_idx" ON "referrals"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referredUserId_key" ON "referrals"("referredUserId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referrerUserId_referredUserId_key" ON "referrals"("referrerUserId", "referredUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_compliance_logs" ADD CONSTRAINT "policy_compliance_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_compliance_logs" ADD CONSTRAINT "policy_compliance_logs_createdByModeratorId_fkey" FOREIGN KEY ("createdByModeratorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
