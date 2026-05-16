-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('ARTICLE', 'AMA', 'DISCUSSION');

-- CreateEnum
CREATE TYPE "ArticleRequestStatus" AS ENUM ('OPEN', 'CLAIMED', 'FULFILLED', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReactionEmoji" ADD VALUE 'HUNDRED';
ALTER TYPE "ReactionEmoji" ADD VALUE 'QUESTION';

-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "amaExpiresAt" TIMESTAMP(3),
ADD COLUMN     "articleType" "ArticleType" NOT NULL DEFAULT 'ARTICLE',
ADD COLUMN     "isPinnedToHome" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "comment_reactions" (
    "id" TEXT NOT NULL,
    "emoji" "ReactionEmoji" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_follows" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ArticleRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requesterId" TEXT NOT NULL,
    "claimedById" TEXT,
    "fulfilledArticleId" TEXT,

    CONSTRAINT "article_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_request_votes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_request_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_lists" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_list_items" (
    "id" TEXT NOT NULL,
    "readingListId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_list_follows" (
    "id" TEXT NOT NULL,
    "readingListId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_list_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "articleId" TEXT,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "pollId" TEXT NOT NULL,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comment_reactions_commentId_idx" ON "comment_reactions"("commentId");

-- CreateIndex
CREATE INDEX "comment_reactions_userId_idx" ON "comment_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reactions_userId_commentId_key" ON "comment_reactions"("userId", "commentId");

-- CreateIndex
CREATE INDEX "tag_follows_tagId_idx" ON "tag_follows"("tagId");

-- CreateIndex
CREATE INDEX "tag_follows_userId_idx" ON "tag_follows"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tag_follows_userId_tagId_key" ON "tag_follows"("userId", "tagId");

-- CreateIndex
CREATE INDEX "article_requests_status_idx" ON "article_requests"("status");

-- CreateIndex
CREATE INDEX "article_requests_requesterId_idx" ON "article_requests"("requesterId");

-- CreateIndex
CREATE INDEX "article_request_votes_requestId_idx" ON "article_request_votes"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "article_request_votes_userId_requestId_key" ON "article_request_votes"("userId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "reading_lists_slug_key" ON "reading_lists"("slug");

-- CreateIndex
CREATE INDEX "reading_lists_userId_idx" ON "reading_lists"("userId");

-- CreateIndex
CREATE INDEX "reading_list_items_readingListId_idx" ON "reading_list_items"("readingListId");

-- CreateIndex
CREATE UNIQUE INDEX "reading_list_items_readingListId_articleId_key" ON "reading_list_items"("readingListId", "articleId");

-- CreateIndex
CREATE INDEX "reading_list_follows_readingListId_idx" ON "reading_list_follows"("readingListId");

-- CreateIndex
CREATE UNIQUE INDEX "reading_list_follows_userId_readingListId_key" ON "reading_list_follows"("userId", "readingListId");

-- CreateIndex
CREATE INDEX "polls_articleId_idx" ON "polls"("articleId");

-- CreateIndex
CREATE INDEX "poll_options_pollId_idx" ON "poll_options"("pollId");

-- CreateIndex
CREATE INDEX "poll_votes_pollId_idx" ON "poll_votes"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_pollId_userId_key" ON "poll_votes"("pollId", "userId");

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_follows" ADD CONSTRAINT "tag_follows_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_follows" ADD CONSTRAINT "tag_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_requests" ADD CONSTRAINT "article_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_requests" ADD CONSTRAINT "article_requests_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_requests" ADD CONSTRAINT "article_requests_fulfilledArticleId_fkey" FOREIGN KEY ("fulfilledArticleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_request_votes" ADD CONSTRAINT "article_request_votes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "article_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_request_votes" ADD CONSTRAINT "article_request_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_lists" ADD CONSTRAINT "reading_lists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_list_items" ADD CONSTRAINT "reading_list_items_readingListId_fkey" FOREIGN KEY ("readingListId") REFERENCES "reading_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_list_items" ADD CONSTRAINT "reading_list_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_list_follows" ADD CONSTRAINT "reading_list_follows_readingListId_fkey" FOREIGN KEY ("readingListId") REFERENCES "reading_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_list_follows" ADD CONSTRAINT "reading_list_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
