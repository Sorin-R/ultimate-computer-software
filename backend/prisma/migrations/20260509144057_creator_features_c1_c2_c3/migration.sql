-- AlterEnum
ALTER TYPE "ArticleStatus" ADD VALUE 'SCHEDULED';

-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "seriesPosition" INTEGER;

-- CreateTable
CREATE TABLE "article_versions" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "excerpt" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_series" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_series_members" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "article_series_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "article_versions_articleId_version_idx" ON "article_versions"("articleId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "article_series_slug_key" ON "article_series"("slug");

-- CreateIndex
CREATE INDEX "article_series_userId_idx" ON "article_series"("userId");

-- CreateIndex
CREATE INDEX "article_series_members_articleId_idx" ON "article_series_members"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "article_series_members_seriesId_articleId_key" ON "article_series_members"("seriesId", "articleId");

-- AddForeignKey
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_series" ADD CONSTRAINT "article_series_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_series_members" ADD CONSTRAINT "article_series_members_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "article_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_series_members" ADD CONSTRAINT "article_series_members_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
