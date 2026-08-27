/**
 * Copy Trading Service
 * All business logic for master trader applications, admin review, master
 * profile management, copy relationships, and copy trade recording.
 */
import {
  copyTradingRepository,
  type UpdateApplicationInput,
  type ApplicationFilterParams,
  type MasterFilterParams,
  type RiskSettingsInput,
  type PageParams,
} from "../repositories/copyTradingRepository";
import { tradeRepository }        from "../repositories/tradeRepository";
import { PAPER_INITIAL_BALANCE }  from "./tradeService";
import { userRepository }         from "../repositories/userRepository";
import { createNotification }     from "../notifications/notificationService";
import { createAuditLog }         from "../audit/auditService";
import type { CopyLotMode, TradeSide, UserRole } from "@prisma/client";

export interface Actor {
  actorId:     string;
  actorHandle: string;
  actorRole:   string;
}

// ── Errors ────────────────────────────────────────────────────────────────

export class ApplicationNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("APPLICATION_NOT_FOUND"); }
}
export class ApplicationAlreadyExistsError extends Error {
  statusCode = 400;
  constructor() { super("APPLICATION_ALREADY_EXISTS"); }
}
export class ApplicationNotEditableError extends Error {
  statusCode = 400;
  constructor() { super("APPLICATION_NOT_EDITABLE"); }
}
export class ApplicationIncompleteError extends Error {
  statusCode = 400;
  constructor() { super("APPLICATION_INCOMPLETE"); }
}
export class ApplicationInvalidStatusError extends Error {
  statusCode = 400;
  constructor() { super("APPLICATION_INVALID_STATUS"); }
}
export class MasterNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("MASTER_NOT_FOUND"); }
}
export class MasterNotActiveError extends Error {
  statusCode = 400;
  constructor() { super("MASTER_NOT_ACTIVE"); }
}
export class NotMasterOwnerError extends Error {
  statusCode = 403;
  constructor() { super("NOT_MASTER_OWNER"); }
}
export class RelationshipNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("RELATIONSHIP_NOT_FOUND"); }
}
export class NotRelationshipOwnerError extends Error {
  statusCode = 403;
  constructor() { super("NOT_RELATIONSHIP_OWNER"); }
}
export class AlreadyCopyingError extends Error {
  statusCode = 400;
  constructor() { super("ALREADY_COPYING"); }
}
export class RelationshipNotActiveError extends Error {
  statusCode = 400;
  constructor() { super("RELATIONSHIP_NOT_ACTIVE"); }
}
export class RelationshipNotPausedError extends Error {
  statusCode = 400;
  constructor() { super("RELATIONSHIP_NOT_PAUSED"); }
}
export class RelationshipAlreadyStoppedError extends Error {
  statusCode = 400;
  constructor() { super("RELATIONSHIP_ALREADY_STOPPED"); }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function paginate(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize);
  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

function addRole<T extends string>(roles: T[], role: T): T[] {
  return roles.includes(role) ? roles : [...roles, role];
}

function removeRole<T extends string>(roles: T[], role: T): T[] {
  return roles.filter((r) => r !== role);
}

// Current paper balance for a user — mirrors tradeService.getAccountState's
// balance derivation without pulling in that service's full response shape.
async function getCurrentBalance(userId: string): Promise<number> {
  const [snapshot, totalPnl] = await Promise.all([
    tradeRepository.getLatestSnapshot(userId),
    tradeRepository.sumClosedNetPnl(userId),
  ]);
  if (snapshot) return snapshot.balance;
  return parseFloat((PAPER_INITIAL_BALANCE + totalPnl).toFixed(6));
}

function deriveCopyLotSize(
  relationship: { copyLotMode: CopyLotMode; fixedLotSize: number; riskMultiplier: number },
  masterLotSize: number
): number {
  switch (relationship.copyLotMode) {
    case "RISK_MULTIPLIER":
      return parseFloat((masterLotSize * relationship.riskMultiplier).toFixed(2));
    case "EQUITY_RATIO":
      // True equity-ratio sizing needs the follower's live equity relative to
      // the master's — not tracked yet, so fall back to the fixed lot as a
      // conservative proxy.
      return relationship.fixedLotSize;
    case "FIXED_LOT":
    default:
      return relationship.fixedLotSize;
  }
}

function isApplicationComplete(app: {
  marketsTraded: string[];
  strategiesUsed: string[];
  experienceSummary: string;
  riskManagementSummary: string;
  reasonForApplying: string;
  hasAcceptedRiskDisclosure: boolean;
  hasAcceptedPerformanceTruthPolicy: boolean;
  hasAcceptedCopyTradingTerms: boolean;
}): boolean {
  return (
    app.marketsTraded.length > 0 &&
    app.strategiesUsed.length > 0 &&
    app.experienceSummary.trim().length > 0 &&
    app.riskManagementSummary.trim().length > 0 &&
    app.reasonForApplying.trim().length > 0 &&
    app.hasAcceptedRiskDisclosure &&
    app.hasAcceptedPerformanceTruthPolicy &&
    app.hasAcceptedCopyTradingTerms
  );
}

async function getApplicationOrThrow(id: string) {
  const application = await copyTradingRepository.findApplicationById(id);
  if (!application) throw new ApplicationNotFoundError();
  return application;
}

async function getOwnedRelationshipOrThrow(relationshipId: string, followerUserId: string) {
  const relationship = await copyTradingRepository.findRelationshipById(relationshipId);
  if (!relationship) throw new RelationshipNotFoundError();
  if (relationship.followerUserId !== followerUserId) throw new NotRelationshipOwnerError();
  return relationship;
}

// ── Service ───────────────────────────────────────────────────────────────

export const copyTradingService = {
  // ── Application flow ────────────────────────────────────────────────────

  getMyApplication(userId: string) {
    return copyTradingRepository.findApplicationByUserId(userId);
  },

  async createApplication(userId: string) {
    const existing = await copyTradingRepository.findApplicationByUserId(userId);
    if (existing) throw new ApplicationAlreadyExistsError();

    const user = await copyTradingRepository.findUserSnapshot(userId);
    if (!user) throw new ApplicationNotFoundError();

    return copyTradingRepository.createApplication({ userId, tccId: user.tccId, displayName: user.displayName });
  },

  async updateApplication(userId: string, input: UpdateApplicationInput) {
    const application = await copyTradingRepository.findApplicationByUserId(userId);
    if (!application) throw new ApplicationNotFoundError();
    if (application.status !== "DRAFT") throw new ApplicationNotEditableError();

    return copyTradingRepository.updateApplication(userId, input);
  },

  async submitApplication(userId: string) {
    const application = await copyTradingRepository.findApplicationByUserId(userId);
    if (!application) throw new ApplicationNotFoundError();
    if (application.status !== "DRAFT") throw new ApplicationNotEditableError();
    if (!isApplicationComplete(application)) throw new ApplicationIncompleteError();

    return copyTradingRepository.submitApplication(userId);
  },

  // ── Admin application management ────────────────────────────────────────

  async getAllApplications(params: ApplicationFilterParams) {
    const { items, total } = await copyTradingRepository.findAllApplications(params);
    return { items, ...paginate(total, params.page, params.pageSize) };
  },

  async reviewApplication(applicationId: string, actor: Actor) {
    const application = await getApplicationOrThrow(applicationId);
    if (application.status !== "SUBMITTED") throw new ApplicationInvalidStatusError();

    const updated = await copyTradingRepository.updateApplicationStatus(applicationId, {
      status:     "UNDER_REVIEW",
      reviewedBy: actor.actorId,
    });

    await createAuditLog({
      actorId:      actor.actorId,
      actorHandle:  actor.actorHandle,
      actorRole:    actor.actorRole,
      actionType:   "master_application_reviewed",
      targetType:   "master_trader_application",
      targetId:     applicationId,
      targetUserId: application.userId,
      description:  `Marked master trader application for ${application.displayName} under review`,
    });

    return updated;
  },

  async requestMoreInfo(applicationId: string, actor: Actor, message: string) {
    const application = await getApplicationOrThrow(applicationId);
    if (application.status !== "SUBMITTED" && application.status !== "UNDER_REVIEW") {
      throw new ApplicationInvalidStatusError();
    }

    const updated = await copyTradingRepository.updateApplicationStatus(applicationId, {
      status:          "MORE_INFO_REQUIRED",
      moreInfoRequest: message,
      reviewedBy:      actor.actorId,
    });

    await createAuditLog({
      actorId:      actor.actorId,
      actorHandle:  actor.actorHandle,
      actorRole:    actor.actorRole,
      actionType:   "master_application_more_info_requested",
      targetType:   "master_trader_application",
      targetId:     applicationId,
      targetUserId: application.userId,
      description:  `Requested more info on master trader application for ${application.displayName}`,
      reason:       message,
    });

    await createNotification({
      userId:      application.userId,
      type:        "COPY_TRADE",
      priority:    "HIGH",
      title:       "More information needed on your Master Trader application",
      message,
      actionLabel: "View Application",
      actionPath:  "/copy-trading/application",
    });

    return updated;
  },

  async approveApplication(applicationId: string, actor: Actor) {
    const application = await getApplicationOrThrow(applicationId);
    if (application.status !== "SUBMITTED" && application.status !== "UNDER_REVIEW") {
      throw new ApplicationInvalidStatusError();
    }

    const now = new Date();
    const [, master] = await Promise.all([
      copyTradingRepository.updateApplicationStatus(applicationId, {
        status:     "APPROVED",
        reviewedBy: actor.actorId,
        reviewedAt: now,
      }),
      copyTradingRepository.createMasterProfile({
        userId:         application.userId,
        applicationId:  application.id,
        tccId:          application.tccId,
        displayName:    application.displayName,
        approvedBy:     actor.actorId,
        marketsTraded:  application.marketsTraded,
        strategiesUsed: application.strategiesUsed,
      }),
    ]);

    const user = await copyTradingRepository.findUserSnapshot(application.userId);
    if (user) {
      await userRepository.updateRoles(application.userId, addRole<UserRole>(user.roles, "MASTER_TRADER"));
    }

    await createAuditLog({
      actorId:      actor.actorId,
      actorHandle:  actor.actorHandle,
      actorRole:    actor.actorRole,
      actionType:   "master_application_approved",
      targetType:   "master_trader_application",
      targetId:     applicationId,
      targetUserId: application.userId,
      description:  `Approved master trader application for ${application.displayName}`,
    });

    await createNotification({
      userId:      application.userId,
      type:        "COPY_TRADE",
      priority:    "HIGH",
      title:       "🎉 You're approved as a Master Trader!",
      message:     "Your Master Trader application has been approved. Your profile is now live.",
      actionLabel: "View Profile",
      actionPath:  `/copy-trading/masters/${master.id}`,
    });

    return master;
  },

  async rejectApplication(applicationId: string, actor: Actor, reason: string) {
    const application = await getApplicationOrThrow(applicationId);
    if (application.status !== "SUBMITTED" && application.status !== "UNDER_REVIEW") {
      throw new ApplicationInvalidStatusError();
    }

    const updated = await copyTradingRepository.updateApplicationStatus(applicationId, {
      status:          "REJECTED",
      rejectionReason: reason,
      reviewedBy:      actor.actorId,
      reviewedAt:      new Date(),
    });

    await createAuditLog({
      actorId:      actor.actorId,
      actorHandle:  actor.actorHandle,
      actorRole:    actor.actorRole,
      actionType:   "master_application_rejected",
      targetType:   "master_trader_application",
      targetId:     applicationId,
      targetUserId: application.userId,
      description:  `Rejected master trader application for ${application.displayName}`,
      reason,
    });

    await createNotification({
      userId:      application.userId,
      type:        "COPY_TRADE",
      priority:    "HIGH",
      title:       "Your Master Trader application was not approved",
      message:     reason,
      actionLabel: "View Application",
      actionPath:  "/copy-trading/application",
    });

    return updated;
  },

  // ── Master trader management ────────────────────────────────────────────

  async getAllMasters(params: MasterFilterParams) {
    // Public discovery endpoint — always scoped to currently-active masters.
    const { items, total } = await copyTradingRepository.findAllMasters({ ...params, status: "ACTIVE" });
    return { items, ...paginate(total, params.page, params.pageSize) };
  },

  async getMaster(idOrUserId: string, by: "id" | "userId" = "id") {
    const master =
      by === "userId"
        ? await copyTradingRepository.findMasterByUserId(idOrUserId)
        : await copyTradingRepository.findMasterById(idOrUserId);
    if (!master) throw new MasterNotFoundError();
    return master;
  },

  async suspendMaster(masterId: string, actor: Actor, reason?: string) {
    const master = await copyTradingRepository.findMasterById(masterId);
    if (!master) throw new MasterNotFoundError();

    const updated = await copyTradingRepository.suspendMaster(masterId);

    await createAuditLog({
      actorId:      actor.actorId,
      actorHandle:  actor.actorHandle,
      actorRole:    actor.actorRole,
      actionType:   "master_suspended",
      targetType:   "master_trader",
      targetId:     masterId,
      targetUserId: master.userId,
      description:  `Suspended master trader ${master.displayName}`,
      reason,
    });

    await createNotification({
      userId:   master.userId,
      type:     "COPY_TRADE",
      priority: "CRITICAL",
      title:    "Your Master Trader status has been suspended",
      message:  reason ?? "Your master trader profile has been suspended by a moderator.",
    });

    return updated;
  },

  async removeMaster(masterId: string, actor: Actor, reason?: string) {
    const master = await copyTradingRepository.findMasterById(masterId);
    if (!master) throw new MasterNotFoundError();

    const updated = await copyTradingRepository.removeMaster(masterId);

    const user = await copyTradingRepository.findUserSnapshot(master.userId);
    if (user) {
      await userRepository.updateRoles(master.userId, removeRole<UserRole>(user.roles, "MASTER_TRADER"));
    }

    await createAuditLog({
      actorId:      actor.actorId,
      actorHandle:  actor.actorHandle,
      actorRole:    actor.actorRole,
      actionType:   "master_removed",
      targetType:   "master_trader",
      targetId:     masterId,
      targetUserId: master.userId,
      description:  `Removed master trader ${master.displayName}`,
      reason,
    });

    await createNotification({
      userId:   master.userId,
      type:     "COPY_TRADE",
      priority: "CRITICAL",
      title:    "Your Master Trader status has been removed",
      message:  reason ?? "Your master trader profile has been removed by a moderator.",
    });

    return updated;
  },

  // ── Copy relationship management ────────────────────────────────────────

  async startCopying(followerUserId: string, masterTraderId: string, riskSettings?: RiskSettingsInput) {
    const master = await copyTradingRepository.findMasterById(masterTraderId);
    if (!master) throw new MasterNotFoundError();
    if (master.status !== "ACTIVE") throw new MasterNotActiveError();

    const existing = await copyTradingRepository.findRelationshipByIds(followerUserId, masterTraderId);
    if (existing && existing.status !== "STOPPED") throw new AlreadyCopyingError();

    const balance = await getCurrentBalance(followerUserId);

    const relationship = existing
      ? await copyTradingRepository.updateRelationship(existing.id, { status: "ACTIVE", ...riskSettings })
      : await copyTradingRepository.createRelationship({
          followerUserId,
          masterTraderId,
          masterDisplayName: master.displayName,
          ...riskSettings,
        });

    await copyTradingRepository.createOrUpdateFeeModel({
      relationshipId:         relationship.id,
      userId:                 followerUserId,
      highWaterMark:          balance,
      currentBalanceSnapshot: balance,
    });

    return relationship;
  },

  async stopCopying(followerUserId: string, relationshipId: string, stopReason?: string) {
    const relationship = await getOwnedRelationshipOrThrow(relationshipId, followerUserId);
    if (relationship.status === "STOPPED") throw new RelationshipAlreadyStoppedError();

    return copyTradingRepository.stopRelationship(relationshipId, stopReason);
  },

  async pauseCopying(followerUserId: string, relationshipId: string) {
    const relationship = await getOwnedRelationshipOrThrow(relationshipId, followerUserId);
    if (relationship.status !== "ACTIVE") throw new RelationshipNotActiveError();

    return copyTradingRepository.pauseRelationship(relationshipId);
  },

  async resumeCopying(followerUserId: string, relationshipId: string) {
    const relationship = await getOwnedRelationshipOrThrow(relationshipId, followerUserId);
    if (relationship.status !== "PAUSED") throw new RelationshipNotPausedError();

    return copyTradingRepository.updateRelationship(relationshipId, { status: "ACTIVE" });
  },

  async updateRiskSettings(followerUserId: string, relationshipId: string, input: RiskSettingsInput) {
    await getOwnedRelationshipOrThrow(relationshipId, followerUserId);
    return copyTradingRepository.updateRelationship(relationshipId, input);
  },

  async getMyRelationships(followerUserId: string, params: PageParams) {
    const { items, total } = await copyTradingRepository.findActiveRelationshipsForFollower(followerUserId, params);
    return { items, ...paginate(total, params.page, params.pageSize) };
  },

  async getMasterFollowers(callerUserId: string, masterId: string, params: PageParams) {
    const master = await copyTradingRepository.findMasterById(masterId);
    if (!master) throw new MasterNotFoundError();
    if (master.userId !== callerUserId) throw new NotMasterOwnerError();

    const { items, total } = await copyTradingRepository.findActiveRelationshipsForMaster(masterId, params);
    return { items, ...paginate(total, params.page, params.pageSize) };
  },

  // ── Safety checks (internal — used by recordCopyTrade) ──────────────────

  async runSafetyChecks(
    relationship: { id: string; maxOpenCopiedTrades: number; requireStopLoss: boolean },
    trade: { sl?: number | null }
  ): Promise<{ passed: boolean; reason?: string }> {
    if (relationship.requireStopLoss && !trade.sl) {
      return { passed: false, reason: "Master trade has no stop-loss and this relationship requires one" };
    }

    // The schema does not yet link copy history rows back to live positions,
    // so "open" trades are approximated as this relationship's total recorded
    // copies — a conservative proxy until that link exists.
    const { total: copiedCount } = await copyTradingRepository.findCopyHistory({
      relationshipId: relationship.id,
      page:           1,
      pageSize:       1,
    });
    if (copiedCount >= relationship.maxOpenCopiedTrades) {
      return { passed: false, reason: "Maximum open copied trades reached for this relationship" };
    }

    return { passed: true };
  },

  // ── Copy trade recording (internal — call from tradeService on open) ────

  async recordCopyTrade(
    masterUserId: string,
    trade: { symbol: string; displayName: string; side: TradeSide; lotSize: number; entryPrice: number; sl?: number | null }
  ) {
    const master = await copyTradingRepository.findMasterByUserId(masterUserId);
    if (!master || master.status !== "ACTIVE") return [];

    const { items: relationships } = await copyTradingRepository.findActiveRelationshipsForMaster(master.id, {
      page:     1,
      pageSize: 1000,
    });

    const results = [];
    for (const relationship of relationships) {
      if (relationship.status !== "ACTIVE") {
        results.push(
          await copyTradingRepository.recordCopyTradeHistory({
            relationshipId: relationship.id,
            masterUserId,
            followerUserId: relationship.followerUserId,
            symbol:         trade.symbol,
            displayName:    trade.displayName,
            side:           trade.side,
            lotSize:        trade.lotSize,
            entryPrice:     trade.entryPrice,
            status:         "SKIPPED",
            reason:         `Relationship is ${relationship.status.toLowerCase()}`,
          })
        );
        continue;
      }

      const check   = await copyTradingService.runSafetyChecks(relationship, trade);
      const lotSize = deriveCopyLotSize(relationship, trade.lotSize);

      results.push(
        await copyTradingRepository.recordCopyTradeHistory({
          relationshipId: relationship.id,
          masterUserId,
          followerUserId: relationship.followerUserId,
          symbol:         trade.symbol,
          displayName:    trade.displayName,
          side:           trade.side,
          lotSize,
          entryPrice:     trade.entryPrice,
          status:         check.passed ? "COPIED_PAPER" : "BLOCKED",
          reason:         check.passed ? null : check.reason,
        })
      );
    }

    return results;
  },

  async getCopyHistory(params: PageParams & { relationshipId?: string; followerUserId?: string }) {
    const { items, total } = await copyTradingRepository.findCopyHistory(params);
    return { items, ...paginate(total, params.page, params.pageSize) };
  },
};
