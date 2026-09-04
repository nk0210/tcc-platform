-- AlterTable
ALTER TABLE "CommunityPost" ADD COLUMN     "repostOfId" TEXT;

-- CreateIndex
CREATE INDEX "CommunityPost_repostOfId_idx" ON "CommunityPost"("repostOfId");

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_repostOfId_fkey" FOREIGN KEY ("repostOfId") REFERENCES "CommunityPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
