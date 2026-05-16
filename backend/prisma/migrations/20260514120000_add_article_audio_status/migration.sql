CREATE TYPE "ArticleAudioStatus" AS ENUM ('NONE', 'PROCESSING', 'READY', 'FAILED');

ALTER TABLE "articles"
  ADD COLUMN "audioUrl" TEXT,
  ADD COLUMN "audioStatus" "ArticleAudioStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "audioGeneratedAt" TIMESTAMP(3),
  ADD COLUMN "audioError" TEXT;
