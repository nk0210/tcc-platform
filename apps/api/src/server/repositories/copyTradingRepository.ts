/**
 * Copy Trading Repository
 * Sole Prisma layer for master trader applications, master profiles, copy
 * relationships, fee models, and copy trade history. No business logic.
 */
import db from "../../lib/prisma";
import type {
  Prisma,
  ApplicationStatus,
  MasterStatus,
  RelationshipStatus,
  CopyMode,
  CopyLotMode,
  CopyTradeStatus,
  TradeSide,
} from "@prisma/client";

export interface PageParams {
  page:     number;
  pageSize: number;
}

// ── Application input types ────────────────────────────────────────────────

export interface CreateApplicationInput {
  userId:      string;
  tccId:       string;
  displayName: string;
}

export interface UpdateApplicationInput {
  marketsTraded?:                     string[];
  strategiesUsed?:                    string[];
  experienceSummary?:                 string;
  riskManagementSummary?:             string;
  reasonForApplying?:                 string;
  hasAcceptedRiskDisclosure?:         boolean;
  hasAcceptedPerformanceTruthPolicy?: boolean;
  hasAcceptedCopyTradingTerms?:       boolean;
}

export interface ApplicationStatusUpdateInput {
  status:           ApplicationStatus;
  reviewedBy?:       string;
  reviewedAt?:       Date;
  rejectionReason?:  string | null;
  moreInfoRequest?:  string | null;
  adminNotes?:       string | null;
}

export interface ApplicationFilterParams extends PageParams {
  status?: ApplicationStatus;
}

// ── Master input types ─────────────────────────────────────────────────────

export interface CreateMasterProfileInput {
  userId:         string;
  applicationId:  string;
  tccId:          string;
  displayName:    string;
  approvedBy:     string;
  marketsTraded:  string[];
  strategiesUsed: string[];
}

export interface UpdateMasterProfileInput {
  marketsTraded?:         string[];
  strategiesUsed?:        string[];
  brokerName?:            string | null;
  sameBrokerRequired?:    boolean;
  brokerStatus?:          string;
  publicProfileRequired?: boolean;
  trustScoreStatus?:      string;
}

export interface MasterFilterParams extends PageParams {
  status?:          MasterStatus;
  marketsTraded?:   string[];
  strategiesUsed?:  string[];
}

// ── Relationship input types ───────────────────────────────────────────────

export interface RiskSettingsInput {
  maxRiskPerTradePercent?:  number;
  maxDailyLossPercent?:     number;
  maxTotalDrawdownPercent?: number;
  maxOpenCopiedTrades?:     number;
  copyLotMode?:             CopyLotMode;
  fixedLotSize?:            number;
  riskMultiplier?:          number;
  maxSlippagePoints?:       number;
  requireStopLoss?:         boolean;
  newsFilterEnabled?:       boolean;
}

export interface UpdateRelationshipInput extends RiskSettingsInput {
  status?: RelationshipStatus;
}

export interface CreateRelationshipInput extends RiskSettingsInput {
  followerUserId:    string;
  masterTraderId:    string;
  masterDisplayName: string;
  mode?:             CopyMode;
}

export interface CreateOrUpdateFeeModelInput {
  relationshipId:         string;
  userId:                 string;
  performanceFeePercent?: number;
  highWaterMark:          number;
  currentBalanceSnapshot: number;
}

export interface RecordCopyTradeInput {
  relationshipId:   string;
  masterUserId:     string;
  followerUserId:   string;
  symbol:           string;
  displayName:      string;
  side:             TradeSide;
  lotSize:          number;
  entryPrice:       number;
  status:           CopyTradeStatus;
  reason?:          string | null;
  mode?:            CopyMode;
  riskCheckResult?: Prisma.InputJsonValue;
}

// ── Repository ────────────────────────────────────────────────────────────

export const copyTradingRepository = {
  // ── User snapshot (denormalized tccId/displayName/roles for applications) ──

  findUserSnapshot(userId: string) {
    return db.user.findUnique({
      where:  { id: userId },
      select: { id: true, tccId: true, displayName: true, roles: true },
    });
  },

  // ── Applications ────────────────────────────────────────────────────────

  findApplicationByUserId(userId: string) {
    return db.masterTraderApplication.findUnique({ where: { userId } });
  },

  findApplicationById(id: string) {
    return db.masterTraderApplication.findUnique({ where: { id } });
  },

  createApplication(input: CreateApplicationInput) {
    return db.masterTraderApplication.create({
      data: { userId: input.userId, tccId: input.tccId, displayName: input.displayName, status: "DRAFT" },
    });
  },

  updateApplication(userId: string, input: UpdateApplicationInput) {
    return db.masterTraderApplication.update({
      where: { userId },
      data: {
        ...(input.marketsTraded                    !== undefined ? { marketsTraded:                    input.marketsTraded }                    : {}),
        ...(input.strategiesUsed                   !== undefined ? { strategiesUsed:                   input.strategiesUsed }                   : {}),
        ...(input.experienceSummary                !== undefined ? { experienceSummary:                input.experienceSummary }                : {}),
        ...(input.riskManagementSummary             !== undefined ? { riskManagementSummary:            input.riskManagementSummary }            : {}),
        ...(input.reasonForApplying                 !== undefined ? { reasonForApplying:                input.reasonForApplying }                : {}),
        ...(input.hasAcceptedRiskDisclosure         !== undefined ? { hasAcceptedRiskDisclosure:        input.hasAcceptedRiskDisclosure }        : {}),
        ...(input.hasAcceptedPerformanceTruthPolicy !== undefined ? { hasAcceptedPerformanceTruthPolicy: input.hasAcceptedPerformanceTruthPolicy } : {}),
        ...(input.hasAcceptedCopyTradingTerms       !== undefined ? { hasAcceptedCopyTradingTerms:      input.hasAcceptedCopyTradingTerms }       : {}),
      },
    });
  },

  submitApplication(userId: string) {
    return db.masterTraderApplication.update({
      where: { userId },
      data:  { status: "SUBMITTED", submittedAt: new Date() },
    });
  },

  updateApplicationStatus(id: string, input: ApplicationStatusUpdateInput) {
    return db.masterTraderApplication.update({
      where: { id },
      data: {
        status: input.status,
        ...(input.reviewedBy      !== undefined ? { reviewedBy:      input.reviewedBy }      : {}),
        ...(input.reviewedAt      !== undefined ? { reviewedAt:      input.reviewedAt }      : {}),
        ...(input.rejectionReason !== undefined ? { rejectionReason: input.rejectionReason } : {}),
        ...(input.moreInfoRequest !== undefined ? { moreInfoRequest: input.moreInfoRequest } : {}),
        ...(input.adminNotes      !== undefined ? { adminNotes:      input.adminNotes }      : {}),
      },
    });
  },

  async findAllApplications(params: ApplicationFilterParams) {
    const { page, pageSize, status } = params;
    const where: Prisma.MasterTraderApplicationWhereInput = { ...(status ? { status } : {}) };

    const [items, total] = await Promise.all([
      db.masterTraderApplication.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      db.masterTraderApplication.count({ where }),
    ]);

    return { items, total };
  },

  // ── Master profiles ────────────────────────────────────────────────────

  findMasterByUserId(userId: string) {
    return db.masterTrader.findUnique({ where: { userId } });
  },

  findMasterById(id: string) {
    return db.masterTrader.findUnique({ where: { id } });
  },

  async findAllMasters(params: MasterFilterParams) {
    const { page, pageSize, status, marketsTraded, strategiesUsed } = params;
    const where: Prisma.MasterTraderWhereInput = {
      ...(status                                      ? { status }                                       : {}),
      ...(marketsTraded && marketsTraded.length > 0    ? { marketsTraded:  { hasSome: marketsTraded } }   : {}),
      ...(strategiesUsed && strategiesUsed.length > 0  ? { strategiesUsed: { hasSome: strategiesUsed } }  : {}),
    };

    const [items, total] = await Promise.all([
      db.masterTrader.findMany({
        where,
        orderBy: { approvedAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      db.masterTrader.count({ where }),
    ]);

    return { items, total };
  },

  createMasterProfile(input: CreateMasterProfileInput) {
    return db.masterTrader.create({
      data: {
        userId:         input.userId,
        applicationId:  input.applicationId,
        tccId:          input.tccId,
        displayName:    input.displayName,
        approvedBy:     input.approvedBy,
        marketsTraded:  input.marketsTraded,
        strategiesUsed: input.strategiesUsed,
      },
    });
  },

  updateMasterProfile(id: string, input: UpdateMasterProfileInput) {
    return db.masterTrader.update({
      where: { id },
      data: {
        ...(input.marketsTraded         !== undefined ? { marketsTraded:         input.marketsTraded }         : {}),
        ...(input.strategiesUsed        !== undefined ? { strategiesUsed:        input.strategiesUsed }        : {}),
        ...(input.brokerName            !== undefined ? { brokerName:            input.brokerName }            : {}),
        ...(input.sameBrokerRequired    !== undefined ? { sameBrokerRequired:    input.sameBrokerRequired }    : {}),
        ...(input.brokerStatus          !== undefined ? { brokerStatus:          input.brokerStatus }          : {}),
        ...(input.publicProfileRequired !== undefined ? { publicProfileRequired: input.publicProfileRequired } : {}),
        ...(input.trustScoreStatus      !== undefined ? { trustScoreStatus:      input.trustScoreStatus }      : {}),
      },
    });
  },

  suspendMaster(id: string) {
    return db.masterTrader.update({ where: { id }, data: { status: "SUSPENDED" } });
  },

  removeMaster(id: string) {
    return db.masterTrader.update({ where: { id }, data: { status: "REMOVED" } });
  },

  // ── Copy relationships ─────────────────────────────────────────────────

  findRelationshipByIds(followerUserId: string, masterTraderId: string) {
    return db.copyRelationship.findUnique({
      where: { followerUserId_masterTraderId: { followerUserId, masterTraderId } },
    });
  },

  findRelationshipById(id: string) {
    return db.copyRelationship.findUnique({ where: { id } });
  },

  async findActiveRelationshipsForFollower(followerUserId: string, params: PageParams) {
    const { page, pageSize } = params;
    const where: Prisma.CopyRelationshipWhereInput = { followerUserId, status: { not: "STOPPED" } };

    const [items, total] = await Promise.all([
      db.copyRelationship.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { feeModel: true },
      }),
      db.copyRelationship.count({ where }),
    ]);

    return { items, total };
  },

  async findActiveRelationshipsForMaster(masterTraderId: string, params: PageParams) {
    const { page, pageSize } = params;
    const where: Prisma.CopyRelationshipWhereInput = { masterTraderId, status: { not: "STOPPED" } };

    const [items, total] = await Promise.all([
      db.copyRelationship.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      db.copyRelationship.count({ where }),
    ]);

    return { items, total };
  },

  createRelationship(input: CreateRelationshipInput) {
    return db.copyRelationship.create({
      data: {
        followerUserId:          input.followerUserId,
        masterTraderId:          input.masterTraderId,
        masterDisplayName:       input.masterDisplayName,
        mode:                    input.mode ?? "PAPER_COPY",
        status:                  "ACTIVE",
        maxRiskPerTradePercent:  input.maxRiskPerTradePercent  ?? 1,
        maxDailyLossPercent:     input.maxDailyLossPercent     ?? 3,
        maxTotalDrawdownPercent: input.maxTotalDrawdownPercent ?? 10,
        maxOpenCopiedTrades:     input.maxOpenCopiedTrades     ?? 3,
        copyLotMode:             input.copyLotMode             ?? "FIXED_LOT",
        fixedLotSize:            input.fixedLotSize            ?? 0.01,
        riskMultiplier:          input.riskMultiplier          ?? 1,
        maxSlippagePoints:       input.maxSlippagePoints       ?? 5,
        requireStopLoss:         input.requireStopLoss         ?? true,
        newsFilterEnabled:       input.newsFilterEnabled       ?? false,
      },
      include: { feeModel: true },
    });
  },

  updateRelationship(id: string, input: UpdateRelationshipInput) {
    return db.copyRelationship.update({
      where: { id },
      data: {
        ...(input.status !== undefined
          ? { status: input.status, ...(input.status === "ACTIVE" ? { stoppedAt: null, stopReason: null } : {}) }
          : {}),
        ...(input.maxRiskPerTradePercent  !== undefined ? { maxRiskPerTradePercent:  input.maxRiskPerTradePercent }  : {}),
        ...(input.maxDailyLossPercent     !== undefined ? { maxDailyLossPercent:     input.maxDailyLossPercent }     : {}),
        ...(input.maxTotalDrawdownPercent !== undefined ? { maxTotalDrawdownPercent: input.maxTotalDrawdownPercent } : {}),
        ...(input.maxOpenCopiedTrades     !== undefined ? { maxOpenCopiedTrades:     input.maxOpenCopiedTrades }     : {}),
        ...(input.copyLotMode             !== undefined ? { copyLotMode:             input.copyLotMode }             : {}),
        ...(input.fixedLotSize            !== undefined ? { fixedLotSize:            input.fixedLotSize }            : {}),
        ...(input.riskMultiplier          !== undefined ? { riskMultiplier:          input.riskMultiplier }          : {}),
        ...(input.maxSlippagePoints       !== undefined ? { maxSlippagePoints:       input.maxSlippagePoints }       : {}),
        ...(input.requireStopLoss         !== undefined ? { requireStopLoss:         input.requireStopLoss }         : {}),
        ...(input.newsFilterEnabled       !== undefined ? { newsFilterEnabled:       input.newsFilterEnabled }       : {}),
      },
    });
  },

  pauseRelationship(id: string) {
    return db.copyRelationship.update({ where: { id }, data: { status: "PAUSED" } });
  },

  stopRelationship(id: string, stopReason?: string) {
    return db.copyRelationship.update({
      where: { id },
      data:  { status: "STOPPED", stoppedAt: new Date(), stopReason: stopReason ?? null },
    });
  },

  // ── Fee model ──────────────────────────────────────────────────────────

  findFeeModelByRelationshipId(relationshipId: string) {
    return db.copyFeeModel.findUnique({ where: { relationshipId } });
  },

  createOrUpdateFeeModel(input: CreateOrUpdateFeeModelInput) {
    return db.copyFeeModel.upsert({
      where:  { relationshipId: input.relationshipId },
      create: {
        relationshipId:         input.relationshipId,
        userId:                 input.userId,
        performanceFeePercent:  input.performanceFeePercent ?? 0,
        highWaterMark:          input.highWaterMark,
        currentBalanceSnapshot: input.currentBalanceSnapshot,
      },
      update: {
        highWaterMark:          input.highWaterMark,
        currentBalanceSnapshot: input.currentBalanceSnapshot,
        ...(input.performanceFeePercent !== undefined ? { performanceFeePercent: input.performanceFeePercent } : {}),
      },
    });
  },

  // ── Copy trade history ────────────────────────────────────────────────

  recordCopyTradeHistory(input: RecordCopyTradeInput) {
    return db.copyTradeHistory.create({
      data: {
        relationshipId:  input.relationshipId,
        masterUserId:    input.masterUserId,
        followerUserId:  input.followerUserId,
        symbol:          input.symbol,
        displayName:     input.displayName,
        side:            input.side,
        lotSize:         input.lotSize,
        entryPrice:      input.entryPrice,
        status:          input.status,
        reason:          input.reason ?? null,
        mode:            input.mode ?? "PAPER_COPY",
        riskCheckResult: input.riskCheckResult,
      },
    });
  },

  async findCopyHistory(params: PageParams & { relationshipId?: string; followerUserId?: string }) {
    const { page, pageSize, relationshipId, followerUserId } = params;
    const where: Prisma.CopyTradeHistoryWhereInput = {
      ...(relationshipId ? { relationshipId } : {}),
      ...(followerUserId ? { followerUserId } : {}),
    };

    const [items, total] = await Promise.all([
      db.copyTradeHistory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      db.copyTradeHistory.count({ where }),
    ]);

    return { items, total };
  },
};
