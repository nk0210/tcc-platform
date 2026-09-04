-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'INSIGHTFUL', 'BULLISH', 'BEARISH', 'CELEBRATE', 'INTERESTING');

-- AlterTable
ALTER TABLE "PostLike" ADD COLUMN     "type" "ReactionType" NOT NULL DEFAULT 'LIKE';

-- CreateIndex
CREATE INDEX "PostLike_postId_type_idx" ON "PostLike"("postId", "type");
