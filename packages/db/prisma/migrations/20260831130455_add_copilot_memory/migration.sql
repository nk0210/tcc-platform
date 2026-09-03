-- CreateEnum
CREATE TYPE "CopilotMemoryType" AS ENUM ('PREFERENCE', 'GOAL', 'TRADING_PREFERENCE', 'COPILOT_PREFERENCE', 'EXPLICIT_FACT');

-- CreateEnum
CREATE TYPE "CopilotMemorySource" AS ENUM ('EXPLICIT', 'USER_APPROVED');

-- CreateEnum
CREATE TYPE "CopilotMemoryStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'DELETED');

-- CreateTable
CREATE TABLE "CopilotMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CopilotMemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "normalizedContent" TEXT NOT NULL,
    "source" "CopilotMemorySource" NOT NULL,
    "status" "CopilotMemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "CopilotMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CopilotMemory_userId_status_type_idx" ON "CopilotMemory"("userId", "status", "type");

-- CreateIndex
CREATE INDEX "CopilotMemory_userId_status_updatedAt_idx" ON "CopilotMemory"("userId", "status", "updatedAt");

-- AddForeignKey
ALTER TABLE "CopilotMemory" ADD CONSTRAINT "CopilotMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
