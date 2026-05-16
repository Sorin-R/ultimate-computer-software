-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ad_placement_idx" ON "Ad"("placement");

-- CreateIndex
CREATE INDEX "Ad_isActive_idx" ON "Ad"("isActive");
