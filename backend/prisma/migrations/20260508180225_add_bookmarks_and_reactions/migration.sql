-- CreateEnum
CREATE TYPE "ReactionEmoji" AS ENUM ('LIKE', 'LOVE', 'WOW', 'THINK');

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_reactions" (
    "id" TEXT NOT NULL,
    "emoji" "ReactionEmoji" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "article_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookmarks_userId_idx" ON "bookmarks"("userId");

-- CreateIndex
CREATE INDEX "bookmarks_articleId_idx" ON "bookmarks"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_articleId_key" ON "bookmarks"("userId", "articleId");

-- CreateIndex
CREATE INDEX "article_reactions_articleId_idx" ON "article_reactions"("articleId");

-- CreateIndex
CREATE INDEX "article_reactions_userId_idx" ON "article_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "article_reactions_userId_articleId_key" ON "article_reactions"("userId", "articleId");

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_reactions" ADD CONSTRAINT "article_reactions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_reactions" ADD CONSTRAINT "article_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
