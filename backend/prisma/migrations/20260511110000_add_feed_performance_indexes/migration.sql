-- Feed/listing performance indexes
CREATE INDEX IF NOT EXISTS "articles_status_publishedAt_idx"
ON "articles"("status", "publishedAt");

CREATE INDEX IF NOT EXISTS "articles_status_categoryId_publishedAt_idx"
ON "articles"("status", "categoryId", "publishedAt");

CREATE INDEX IF NOT EXISTS "article_views_articleId_createdAt_idx"
ON "article_views"("articleId", "createdAt");
