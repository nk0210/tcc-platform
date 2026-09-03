-- CreateEnum
CREATE TYPE "CopilotMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "CopilotToolStatus" AS ENUM ('PENDING_CONFIRMATION', 'EXECUTED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CopilotRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "CopilotConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopilotConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "CopilotMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotToolExecution" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" "CopilotToolStatus" NOT NULL,
    "riskLevel" "CopilotRiskLevel" NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotToolExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CopilotConversation_userId_idx" ON "CopilotConversation"("userId");

-- CreateIndex
CREATE INDEX "CopilotConversation_userId_updatedAt_idx" ON "CopilotConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CopilotMessage_conversationId_createdAt_idx" ON "CopilotMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotToolExecution_messageId_idx" ON "CopilotToolExecution"("messageId");

-- CreateIndex
CREATE INDEX "CopilotToolExecution_toolName_idx" ON "CopilotToolExecution"("toolName");

-- AddForeignKey
ALTER TABLE "CopilotConversation" ADD CONSTRAINT "CopilotConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotMessage" ADD CONSTRAINT "CopilotMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CopilotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotToolExecution" ADD CONSTRAINT "CopilotToolExecution_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CopilotMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
