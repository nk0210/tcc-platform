-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CopilotToolStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "CopilotToolStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "CopilotToolStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "CopilotToolExecution" ADD COLUMN     "executedAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CopilotToolExecution_status_expiresAt_idx" ON "CopilotToolExecution"("status", "expiresAt");
