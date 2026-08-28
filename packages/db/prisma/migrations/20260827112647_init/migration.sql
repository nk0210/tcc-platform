-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('NORMAL_USER', 'FOLLOWER_TRADER', 'VERIFIED_TRADER', 'MASTER_TRADER', 'MENTOR', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE', 'FOLLOWERS_ONLY');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "CloseReason" AS ENUM ('MANUAL', 'STOP_LOSS', 'TAKE_PROFIT');

-- CreateEnum
CREATE TYPE "TradeResult" AS ENUM ('WIN', 'LOSS', 'BREAKEVEN');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('TEXT', 'TRADE_IDEA', 'SHARED_TRADE', 'ACADEMY_COMPLETION', 'STRATEGY_SHARE', 'COMPETITION_UPDATE');

-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('OFFICIAL', 'EDUCATIONAL_TEMPLATE', 'CREATOR_PUBLISHED');

-- CreateEnum
CREATE TYPE "PerformanceStatus" AS ENUM ('UNVERIFIED', 'SELF_REPORTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('FREE', 'ONE_TIME', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('OFFICIAL', 'FREE_RESOURCE', 'CREATOR_PUBLISHED');

-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('UNAVAILABLE', 'COMING_SOON', 'EARNED');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('TEXT', 'VIDEO', 'QUIZ', 'EXERCISE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MasterStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "CopyMode" AS ENUM ('PAPER_COPY', 'LIVE_COPY');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED', 'BLOCKED', 'PENDING_BROKER_CONNECTION');

-- CreateEnum
CREATE TYPE "CopyLotMode" AS ENUM ('FIXED_LOT', 'RISK_MULTIPLIER', 'EQUITY_RATIO');

-- CreateEnum
CREATE TYPE "CopyTradeStatus" AS ENUM ('COPIED_PAPER', 'SKIPPED', 'BLOCKED', 'PENDING', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'ACADEMY', 'COPY_TRADE', 'COMMUNITY', 'MARKETPLACE', 'COMPETITION', 'ADMIN', 'REPORT_UPDATE', 'TRADE', 'PRICE_ALERT');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FollowStatus" AS ENUM ('ACTIVE', 'PENDING', 'BLOCKED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tccId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT,
    "roles" "UserRole"[] DEFAULT ARRAY['NORMAL_USER']::"UserRole"[],
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "profileVisibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "portfolioVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "experienceLevel" "ExperienceLevel",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSocialLinks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "website" TEXT,
    "x" TEXT,
    "linkedin" TEXT,
    "youtube" TEXT,
    "instagram" TEXT,

    CONSTRAINT "UserSocialLinks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTradingIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketsTraded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "symbolsTraded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strategiesUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredSessions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "UserTradingIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "FollowStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'paper',
    "symbol" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'crypto',
    "emoji" TEXT,
    "side" "TradeSide" NOT NULL,
    "lotSize" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "exitPrice" DOUBLE PRECISION,
    "sl" DOUBLE PRECISION,
    "tp" DOUBLE PRECISION,
    "grossPnl" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION,
    "netPnl" DOUBLE PRECISION,
    "marginUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notionalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leverage" INTEGER NOT NULL DEFAULT 10,
    "closeReason" "CloseReason",
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "result" "TradeResult",
    "session" TEXT,
    "strategy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "equity" DOUBLE PRECISION NOT NULL,
    "floatingPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginUsed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freeMargin" DOUBLE PRECISION NOT NULL,
    "marginLevel" DOUBLE PRECISION,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradeId" TEXT,
    "symbol" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'crypto',
    "emoji" TEXT,
    "side" "TradeSide" NOT NULL,
    "lotSize" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "grossPnl" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION,
    "netPnl" DOUBLE PRECISION,
    "result" "TradeResult",
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "closeReason" TEXT,
    "sl" DOUBLE PRECISION,
    "tp" DOUBLE PRECISION,
    "emotion" TEXT NOT NULL DEFAULT 'neutral',
    "confidenceLevel" INTEGER NOT NULL DEFAULT 5,
    "stressLevel" INTEGER NOT NULL DEFAULT 5,
    "entryQuality" TEXT NOT NULL DEFAULT 'unknown',
    "followedPlan" BOOLEAN,
    "strategy" TEXT NOT NULL DEFAULT 'other',
    "marketStructure" TEXT NOT NULL DEFAULT 'unknown',
    "session" TEXT NOT NULL DEFAULT 'unknown',
    "timeframe" TEXT NOT NULL DEFAULT '1H',
    "notes" TEXT NOT NULL DEFAULT '',
    "whatWentRight" TEXT NOT NULL DEFAULT '',
    "whatWentWrong" TEXT NOT NULL DEFAULT '',
    "lessonLearned" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiAnalysis" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'crypto',
    "emoji" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "PostType" NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" "PostVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isHiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "linkedTradeId" TEXT,
    "linkedStrategyId" TEXT,
    "linkedCourseId" TEXT,
    "linkedCompetitionId" TEXT,
    "tradeSnapshot" JSONB,
    "linkedStrategyTitle" TEXT,
    "linkedCourseTitle" TEXT,
    "symbol" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostShare" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostShare_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "CommunityComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isHiddenByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "likedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "CommentLike" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "likedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("userId","commentId")
);

-- CreateTable
CREATE TABLE "SavedPost" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "StrategyType" NOT NULL,
    "authorHandle" TEXT NOT NULL,
    "authorTccId" TEXT,
    "asset" TEXT NOT NULL DEFAULT 'All',
    "assetCategory" TEXT NOT NULL DEFAULT 'all',
    "timeframe" TEXT NOT NULL DEFAULT 'H1',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'FREE',
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "performanceStatus" "PerformanceStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "winRate" DOUBLE PRECISION,
    "profitFactor" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "totalTrades" INTEGER,
    "avgRR" DOUBLE PRECISION,
    "monthlyReturn" DOUBLE PRECISION,
    "rules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entryConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exitConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskManagement" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "disclaimer" TEXT NOT NULL,
    "linkedCourseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyReview" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedStrategy" (
    "userId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "savedToPlaybook" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedStrategy_pkey" PRIMARY KEY ("userId","strategyId")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "CourseType" NOT NULL,
    "level" "CourseLevel" NOT NULL,
    "category" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "totalDuration" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "certificateStatus" "CertificateStatus" NOT NULL DEFAULT 'COMING_SOON',
    "linkedStrategyId" TEXT,
    "creatorId" TEXT,
    "creatorName" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "type" "LessonType" NOT NULL,
    "content" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademyProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "completedLessons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quizScores" JSONB NOT NULL DEFAULT '{}',
    "lastLessonId" TEXT,
    "completedAt" TIMESTAMP(3),
    "certificateStatus" "CertificateStatus" NOT NULL DEFAULT 'COMING_SOON',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademyProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterTraderApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tccId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "marketsTraded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strategiesUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceSummary" TEXT NOT NULL DEFAULT '',
    "riskManagementSummary" TEXT NOT NULL DEFAULT '',
    "reasonForApplying" TEXT NOT NULL DEFAULT '',
    "hasAcceptedRiskDisclosure" BOOLEAN NOT NULL DEFAULT false,
    "hasAcceptedPerformanceTruthPolicy" BOOLEAN NOT NULL DEFAULT false,
    "hasAcceptedCopyTradingTerms" BOOLEAN NOT NULL DEFAULT false,
    "adminNotes" TEXT,
    "rejectionReason" TEXT,
    "moreInfoRequest" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterTraderApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterTrader" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "tccId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "MasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "marketsTraded" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strategiesUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brokerName" TEXT,
    "sameBrokerRequired" BOOLEAN NOT NULL DEFAULT true,
    "brokerStatus" TEXT NOT NULL DEFAULT 'not_connected',
    "publicProfileRequired" BOOLEAN NOT NULL DEFAULT true,
    "trustScoreStatus" TEXT NOT NULL DEFAULT 'insufficient_verified_data',
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterTrader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyRelationship" (
    "id" TEXT NOT NULL,
    "followerUserId" TEXT NOT NULL,
    "masterTraderId" TEXT NOT NULL,
    "masterDisplayName" TEXT NOT NULL,
    "mode" "CopyMode" NOT NULL DEFAULT 'PAPER_COPY',
    "status" "RelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxRiskPerTradePercent" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "maxDailyLossPercent" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "maxTotalDrawdownPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxOpenCopiedTrades" INTEGER NOT NULL DEFAULT 3,
    "copyLotMode" "CopyLotMode" NOT NULL DEFAULT 'FIXED_LOT',
    "fixedLotSize" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "riskMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "maxSlippagePoints" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "requireStopLoss" BOOLEAN NOT NULL DEFAULT true,
    "newsFilterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "stopReason" TEXT,

    CONSTRAINT "CopyRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyFeeModel" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "performanceFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "highWaterMark" DOUBLE PRECISION NOT NULL,
    "currentBalanceSnapshot" DOUBLE PRECISION NOT NULL,
    "totalFeesAccrued" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyFeeModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyTradeHistory" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "masterUserId" TEXT NOT NULL,
    "followerUserId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "lotSize" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "status" "CopyTradeStatus" NOT NULL,
    "reason" TEXT,
    "mode" "CopyMode" NOT NULL DEFAULT 'PAPER_COPY',
    "riskCheckResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopyTradeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'LOW',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionPath" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "reportedItemType" TEXT NOT NULL,
    "reportedItemId" TEXT NOT NULL,
    "reportedItemTitle" TEXT,
    "postId" TEXT,
    "commentId" TEXT,
    "strategyId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ReportPriority" NOT NULL DEFAULT 'MEDIUM',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "sourceFeature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorHandle" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "description" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "UserRole" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_tccId_key" ON "User"("tccId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_handle_idx" ON "User"("handle");

-- CreateIndex
CREATE INDEX "User_tccId_idx" ON "User"("tccId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_refreshToken_idx" ON "Session"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "UserSocialLinks_userId_key" ON "UserSocialLinks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTradingIdentity_userId_key" ON "UserTradingIdentity"("userId");

-- CreateIndex
CREATE INDEX "Follow_sourceId_idx" ON "Follow"("sourceId");

-- CreateIndex
CREATE INDEX "Follow_targetId_idx" ON "Follow"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_sourceId_targetId_key" ON "Follow"("sourceId", "targetId");

-- CreateIndex
CREATE INDEX "Trade_userId_idx" ON "Trade"("userId");

-- CreateIndex
CREATE INDEX "Trade_userId_isOpen_idx" ON "Trade"("userId", "isOpen");

-- CreateIndex
CREATE INDEX "Trade_userId_closedAt_idx" ON "Trade"("userId", "closedAt");

-- CreateIndex
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");

-- CreateIndex
CREATE INDEX "AccountSnapshot_userId_idx" ON "AccountSnapshot"("userId");

-- CreateIndex
CREATE INDEX "AccountSnapshot_userId_snapshotAt_idx" ON "AccountSnapshot"("userId", "snapshotAt");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tradeId_key" ON "JournalEntry"("tradeId");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_idx" ON "JournalEntry"("userId");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_closedAt_idx" ON "JournalEntry"("userId", "closedAt");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_session_idx" ON "JournalEntry"("userId", "session");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_key" ON "Watchlist"("userId");

-- CreateIndex
CREATE INDEX "WatchlistItem_watchlistId_idx" ON "WatchlistItem"("watchlistId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_watchlistId_symbol_key" ON "WatchlistItem"("watchlistId", "symbol");

-- CreateIndex
CREATE INDEX "CommunityPost_authorId_idx" ON "CommunityPost"("authorId");

-- CreateIndex
CREATE INDEX "CommunityPost_visibility_isHiddenByAdmin_createdAt_idx" ON "CommunityPost"("visibility", "isHiddenByAdmin", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_symbol_idx" ON "CommunityPost"("symbol");

-- CreateIndex
CREATE INDEX "PostShare_postId_idx" ON "PostShare"("postId");

-- CreateIndex
CREATE INDEX "PostShare_userId_idx" ON "PostShare"("userId");

-- CreateIndex
CREATE INDEX "CommunityComment_postId_idx" ON "CommunityComment"("postId");

-- CreateIndex
CREATE INDEX "CommunityComment_postId_parentId_idx" ON "CommunityComment"("postId", "parentId");

-- CreateIndex
CREATE INDEX "CommunityComment_parentId_idx" ON "CommunityComment"("parentId");

-- CreateIndex
CREATE INDEX "CommunityComment_authorId_idx" ON "CommunityComment"("authorId");

-- CreateIndex
CREATE INDEX "CommunityComment_createdAt_idx" ON "CommunityComment"("createdAt");

-- CreateIndex
CREATE INDEX "Strategy_authorId_idx" ON "Strategy"("authorId");

-- CreateIndex
CREATE INDEX "Strategy_type_idx" ON "Strategy"("type");

-- CreateIndex
CREATE INDEX "StrategyReview_strategyId_idx" ON "StrategyReview"("strategyId");

-- CreateIndex
CREATE INDEX "StrategyReview_authorId_idx" ON "StrategyReview"("authorId");

-- CreateIndex
CREATE INDEX "SavedStrategy_userId_idx" ON "SavedStrategy"("userId");

-- CreateIndex
CREATE INDEX "Lesson_courseId_idx" ON "Lesson"("courseId");

-- CreateIndex
CREATE INDEX "AcademyProgress_userId_idx" ON "AcademyProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademyProgress_userId_courseId_key" ON "AcademyProgress"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterTraderApplication_userId_key" ON "MasterTraderApplication"("userId");

-- CreateIndex
CREATE INDEX "MasterTraderApplication_status_idx" ON "MasterTraderApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MasterTrader_userId_key" ON "MasterTrader"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterTrader_applicationId_key" ON "MasterTrader"("applicationId");

-- CreateIndex
CREATE INDEX "MasterTrader_status_idx" ON "MasterTrader"("status");

-- CreateIndex
CREATE INDEX "CopyRelationship_followerUserId_idx" ON "CopyRelationship"("followerUserId");

-- CreateIndex
CREATE INDEX "CopyRelationship_masterTraderId_idx" ON "CopyRelationship"("masterTraderId");

-- CreateIndex
CREATE UNIQUE INDEX "CopyRelationship_followerUserId_masterTraderId_key" ON "CopyRelationship"("followerUserId", "masterTraderId");

-- CreateIndex
CREATE UNIQUE INDEX "CopyFeeModel_relationshipId_key" ON "CopyFeeModel"("relationshipId");

-- CreateIndex
CREATE INDEX "CopyTradeHistory_relationshipId_idx" ON "CopyTradeHistory"("relationshipId");

-- CreateIndex
CREATE INDEX "CopyTradeHistory_followerUserId_idx" ON "CopyTradeHistory"("followerUserId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Report_reportedUserId_idx" ON "Report"("reportedUserId");

-- CreateIndex
CREATE INDEX "AdminActionLog_actorId_idx" ON "AdminActionLog"("actorId");

-- CreateIndex
CREATE INDEX "AdminActionLog_targetUserId_idx" ON "AdminActionLog"("targetUserId");

-- CreateIndex
CREATE INDEX "AdminActionLog_actionType_idx" ON "AdminActionLog"("actionType");

-- CreateIndex
CREATE INDEX "AdminActionLog_createdAt_idx" ON "AdminActionLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSocialLinks" ADD CONSTRAINT "UserSocialLinks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTradingIdentity" ADD CONSTRAINT "UserTradingIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSnapshot" ADD CONSTRAINT "AccountSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostShare" ADD CONSTRAINT "PostShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostShare" ADD CONSTRAINT "PostShare_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CommunityComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPost" ADD CONSTRAINT "SavedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strategy" ADD CONSTRAINT "Strategy_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyReview" ADD CONSTRAINT "StrategyReview_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyReview" ADD CONSTRAINT "StrategyReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedStrategy" ADD CONSTRAINT "SavedStrategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedStrategy" ADD CONSTRAINT "SavedStrategy_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyProgress" ADD CONSTRAINT "AcademyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademyProgress" ADD CONSTRAINT "AcademyProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterTraderApplication" ADD CONSTRAINT "MasterTraderApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterTrader" ADD CONSTRAINT "MasterTrader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterTrader" ADD CONSTRAINT "MasterTrader_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MasterTraderApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyRelationship" ADD CONSTRAINT "CopyRelationship_followerUserId_fkey" FOREIGN KEY ("followerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyRelationship" ADD CONSTRAINT "CopyRelationship_masterTraderId_fkey" FOREIGN KEY ("masterTraderId") REFERENCES "MasterTrader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyFeeModel" ADD CONSTRAINT "CopyFeeModel_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "CopyRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyFeeModel" ADD CONSTRAINT "CopyFeeModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTradeHistory" ADD CONSTRAINT "CopyTradeHistory_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "CopyRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionLog" ADD CONSTRAINT "AdminActionLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionLog" ADD CONSTRAINT "AdminActionLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
