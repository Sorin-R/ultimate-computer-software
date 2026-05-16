-- CreateTable
CREATE TABLE "article_views" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT,
    "timeRange" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "article_views_articleId_idx" ON "article_views"("articleId");

-- CreateIndex
CREATE INDEX "article_views_userId_idx" ON "article_views"("userId");

-- CreateIndex
CREATE INDEX "article_views_createdAt_idx" ON "article_views"("createdAt");

-- AddForeignKey
ALTER TABLE "article_views" ADD CONSTRAINT "article_views_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_views" ADD CONSTRAINT "article_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
