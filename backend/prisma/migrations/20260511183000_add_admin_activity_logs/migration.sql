-- CreateTable
CREATE TABLE "admin_activity_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "details" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_activity_logs_actorId_createdAt_idx" ON "admin_activity_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_activity_logs_actorRole_createdAt_idx" ON "admin_activity_logs"("actorRole", "createdAt");

-- CreateIndex
CREATE INDEX "admin_activity_logs_targetType_createdAt_idx" ON "admin_activity_logs"("targetType", "createdAt");

-- CreateIndex
CREATE INDEX "admin_activity_logs_createdAt_idx" ON "admin_activity_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "admin_activity_logs" ADD CONSTRAINT "admin_activity_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
