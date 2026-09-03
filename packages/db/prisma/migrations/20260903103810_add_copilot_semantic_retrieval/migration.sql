-- AlterTable
ALTER TABLE "CopilotMemory" ADD COLUMN     "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
ADD COLUMN     "embeddingModel" TEXT,
ADD COLUMN     "embeddingUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CopilotMessage" ADD COLUMN     "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[];
