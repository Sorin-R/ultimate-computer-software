-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('ACCESS', 'DOWNLOAD', 'DELETE', 'PORTABILITY', 'OPTOUT');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DENIED');

-- CreateTable
CREATE TABLE "adsense_configs" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "adType" TEXT NOT NULL DEFAULT 'display',
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adsense_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_requests" (
    "id" TEXT NOT NULL,
    "requestType" "DataRequestType" NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "details" TEXT,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'PENDING',
    "confirmationId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "notes" TEXT,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "data_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adsense_configs_displayName_key" ON "adsense_configs"("displayName");

-- CreateIndex
CREATE INDEX "adsense_configs_placement_idx" ON "adsense_configs"("placement");

-- CreateIndex
CREATE INDEX "adsense_configs_isActive_idx" ON "adsense_configs"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "data_requests_confirmationId_key" ON "data_requests"("confirmationId");

-- CreateIndex
CREATE INDEX "data_requests_email_idx" ON "data_requests"("email");

-- CreateIndex
CREATE INDEX "data_requests_status_idx" ON "data_requests"("status");

-- CreateIndex
CREATE INDEX "data_requests_createdAt_idx" ON "data_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
