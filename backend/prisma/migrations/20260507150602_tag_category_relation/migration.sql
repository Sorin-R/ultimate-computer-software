-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "tags_categoryId_idx" ON "tags"("categoryId");

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
