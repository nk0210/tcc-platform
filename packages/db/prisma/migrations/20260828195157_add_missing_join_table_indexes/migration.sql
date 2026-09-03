-- DropIndex
DROP INDEX "SavedStrategy_userId_idx";

-- CreateIndex
CREATE INDEX "CommentLike_commentId_idx" ON "CommentLike"("commentId");

-- CreateIndex
CREATE INDEX "PostLike_postId_idx" ON "PostLike"("postId");

-- CreateIndex
CREATE INDEX "SavedPost_postId_idx" ON "SavedPost"("postId");

-- CreateIndex
CREATE INDEX "SavedStrategy_strategyId_idx" ON "SavedStrategy"("strategyId");
