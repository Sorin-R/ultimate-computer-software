DO $$
BEGIN
  CREATE TYPE "AdDeviceTarget" AS ENUM ('ALL', 'DESKTOP', 'MOBILE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AlterTable
ALTER TABLE "Ad"
ADD COLUMN IF NOT EXISTS "deviceTarget" "AdDeviceTarget" NOT NULL DEFAULT 'ALL';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Ad_placement_isActive_deviceTarget_idx"
ON "Ad"("placement", "isActive", "deviceTarget");
