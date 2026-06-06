/**
 * TCC Copy Trading Store
 *
 * Two stores:
 *   useMasterRegistryStore — global (shared key tcc:master-registry)
 *     Approved master traders + all applications for admin review
 *
 *   useCopyTradingStore — user-scoped (tcc:{userId}:copy-trading)
 *     My application, my copy relationships, copy history, fee models
 *
 * NO FAKE DATA. NO FAKE MASTER TRADERS.
 * Paper-copy mode only — no real broker execution.
 * Phase Alpha: replace with PostgreSQL + WebSocket + broker API.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

// ── Types ─────────────────────────────────────────────────────────────────

export type MasterTraderApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "more_info_required"
  | "suspended";

export interface MasterTraderApplication {
  id: string;
  userId: string;
  tccId: string;
  displayName: string;
  status: MasterTraderApplicationStatus;
  marketsTraded: string[];
  strategiesUsed: string[];
  experienceSummary: string;
  riskManagementSummary: string;
  reasonForApplying: string;
  hasAcceptedRiskDisclosure: boolean;
  hasAcceptedPerformanceTruthPolicy: boolean;
  hasAcceptedCopyTradingTerms: boolean;
  adminNotes?: string;
  rejectionReason?: string;
  moreInfoRequest?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type MasterTraderStatus = "active" | "suspended" | "removed";

export interface BrokerCompatibility {
  requiredBrokerId?: string;
  requiredBrokerName?: string;
  sameBrokerRequired: boolean;
  status: "not_connected" | "placeholder" | "connected";
}

export type MasterTrustScoreStatus =
  | "unavailable"
  | "insufficient_verified_data"
  | "calculating"
  | "available";

export interface ApprovedMasterTrader {
  id: string;
  userId: string;
  tccId: string;
  applicationId: string;
  displayName: string;
  status: MasterTraderStatus;
  approvedAt: string;
  approvedBy: string;
  marketsTraded: string[];
  strategiesUsed: string[];
  brokerCompatibility: BrokerCompatibility;
  publicProfileRequired: boolean;
  trustScoreStatus: MasterTrustScoreStatus;
  createdAt: string;
  updatedAt: string;
}

export type CopyMode = "paper_copy" | "live_copy";

export type CopyRelationshipStatus =
  | "active"
  | "paused"
  | "stopped"
  | "blocked"
  | "pending_broker_connection";

export type CopyLotMode = "fixed_lot" | "risk_multiplier" | "equity_ratio";

export type NewsFilterImpactSetting =
  | "off"
  | "high_impact_only"
  | "medium_and_high_impact";

export type NewsFilterBufferMinutes = 15 | 30 | 60;

export interface NewsFilterSettings {
  impactLevel: NewsFilterImpactSetting;
  bufferMinutesBefore: NewsFilterBufferMinutes;
  bufferMinutesAfter: NewsFilterBufferMinutes;
}

export interface CopyRiskSettings {
  maxRiskPerTradePercent: number;
  maxDailyLossPercent: number;
  maxTotalDrawdownPercent: number;
  maxOpenCopiedTrades: number;
  copyLotMode: CopyLotMode;
  fixedLotSize: number;
  riskMultiplier: number;
  maxSlippagePoints: number;
  requireStopLoss: boolean;
  newsFilterEnabled: boolean;
  newsFilterSettings: NewsFilterSettings;
}

export interface CopyRelationship {
  id: string;
  followerUserId: string;
  masterTraderUserId: string;
  masterTraderId: string;
  masterDisplayName: string;
  mode: CopyMode;
  status: CopyRelationshipStatus;
  riskSettings: CopyRiskSettings;
  startedAt: string;
  updatedAt: string;
  stoppedAt?: string;
  stopReason?: string;
}

export type CopyTradeStatus =
  | "copied_paper"
  | "skipped"
  | "blocked"
  | "pending"
  | "failed";

export interface CopySafetyCheck {
  id: string;
  label: string;
  status: "passed" | "warning" | "failed" | "not_available";
  message: string;
}

export interface CopySafetyCheckResult {
  canCopy: boolean;
  checks: CopySafetyCheck[];
}

export interface CopyTradeHistoryItem {
  id: string;
  relationshipId: string;
  masterTraderUserId: string;
  masterDisplayName: string;
  followerUserId: string;
  sourceTradeId?: string;
  copiedTradeId?: string;
  symbol: string;
  displayName: string;
  side: "BUY" | "SELL";
  lotSize: number;
  entryPrice: number;
  status: CopyTradeStatus;
  reason?: string;
  riskCheckResult?: CopySafetyCheckResult;
  mode: CopyMode;
  createdAt: string;
}

export interface CopyFeeModel {
  relationshipId: string;
  performanceFeePercent: number;
  highWaterMark: number;
  currentBalanceSnapshot: number;
  totalFeesAccrued: number;
  lastCalculatedAt?: string;
}

// ── Default risk settings ─────────────────────────────────────────────────

export const DEFAULT_COPY_RISK_SETTINGS: CopyRiskSettings = {
  maxRiskPerTradePercent: 1,
  maxDailyLossPercent: 3,
  maxTotalDrawdownPercent: 10,
  maxOpenCopiedTrades: 3,
  copyLotMode: "fixed_lot",
  fixedLotSize: 0.01,
  riskMultiplier: 1,
  maxSlippagePoints: 5,
  requireStopLoss: true,
  newsFilterEnabled: false,
  newsFilterSettings: {
    impactLevel: "high_impact_only",
    bufferMinutesBefore: 30,
    bufferMinutesAfter: 30,
  },
};

// ── Safety check utility ──────────────────────────────────────────────────

export interface CopySafetyParams {
  relationship: CopyRelationship;
  masterTrader: ApprovedMasterTrader | null;
  followerBalance: number;
  currentOpenCopiedTrades: number;
  todayLossAmount: number;
  proposedLotSize: number;
  hasStopLoss: boolean;
  currentDrawdownPercent: number;
}

export function runCopySafetyChecks(params: CopySafetyParams): CopySafetyCheckResult {
  const {
    relationship, masterTrader, followerBalance,
    currentOpenCopiedTrades, todayLossAmount,
    proposedLotSize, hasStopLoss, currentDrawdownPercent,
  } = params;

  const checks: CopySafetyCheck[] = [];

  checks.push({
    id: "relationship_active",
    label: "Copy relationship is active",
    status: relationship.status === "active" ? "passed" : "failed",
    message: relationship.status === "active"
      ? "Relationship is active."
      : `Relationship status: ${relationship.status}.`,
  });

  checks.push({
    id: "master_approved",
    label: "Master trader approved and active",
    status: masterTrader && masterTrader.status === "active" ? "passed" : "failed",
    message: masterTrader?.status === "active"
      ? "Master trader is approved and active."
      : masterTrader
        ? `Master trader status: ${masterTrader.status}.`
        : "Master trader not found in approved registry.",
  });

  checks.push({
    id: "mode_check",
    label: "Copy mode available",
    status: relationship.mode === "paper_copy" ? "passed" : "warning",
    message: relationship.mode === "paper_copy"
      ? "Paper-copy mode — no real broker execution."
      : "Live copy requires broker API. Not available yet.",
  });

  if (relationship.riskSettings.requireStopLoss) {
    checks.push({
      id: "stop_loss",
      label: "Stop loss required by risk settings",
      status: hasStopLoss ? "passed" : "failed",
      message: hasStopLoss
        ? "Stop loss present."
        : "This copy relationship requires a stop loss on all trades.",
    });
  }

  const maxOpen = relationship.riskSettings.maxOpenCopiedTrades;
  checks.push({
    id: "max_open_trades",
    label: "Max open copied trades",
    status: currentOpenCopiedTrades < maxOpen ? "passed" : "failed",
    message: currentOpenCopiedTrades < maxOpen
      ? `${currentOpenCopiedTrades}/${maxOpen} max open trades used.`
      : `Max open copied trades (${maxOpen}) reached.`,
  });

  const dailyLossLimit = followerBalance * (relationship.riskSettings.maxDailyLossPercent / 100);
  checks.push({
    id: "daily_loss",
    label: "Daily loss limit",
    status: todayLossAmount < dailyLossLimit ? "passed" : "failed",
    message: todayLossAmount < dailyLossLimit
      ? `Daily loss $${todayLossAmount.toFixed(2)} within $${dailyLossLimit.toFixed(2)} limit.`
      : `Daily loss limit reached ($${todayLossAmount.toFixed(2)}/$${dailyLossLimit.toFixed(2)}).`,
  });

  const maxDD = relationship.riskSettings.maxTotalDrawdownPercent;
  checks.push({
    id: "drawdown",
    label: "Total drawdown limit",
    status: currentDrawdownPercent <= maxDD ? "passed" : "failed",
    message: currentDrawdownPercent <= maxDD
      ? `Drawdown ${currentDrawdownPercent.toFixed(1)}% within ${maxDD}% limit.`
      : `Drawdown limit exceeded: ${currentDrawdownPercent.toFixed(1)}% > ${maxDD}%.`,
  });

  checks.push({
    id: "lot_size_valid",
    label: "Lot size valid",
    status: proposedLotSize > 0 ? "passed" : "failed",
    message: proposedLotSize > 0 ? `Lot size ${proposedLotSize} valid.` : "Lot size must be > 0.",
  });

  checks.push({
    id: "broker_compat",
    label: "Broker compatibility",
    status: "not_available",
    message: "Broker API not connected. Paper-copy bypasses broker requirement.",
  });

  checks.push({
    id: "news_filter",
    label: "News filter",
    status: relationship.riskSettings.newsFilterEnabled ? "not_available" : "passed",
    message: relationship.riskSettings.newsFilterEnabled
      ? "News filter enabled — economic calendar not connected yet. Passing manually."
      : "News filter disabled.",
  });

  checks.push({
    id: "slippage",
    label: "Slippage check",
    status: "not_available",
    message: "Slippage check requires live broker data. Not available in paper-copy mode.",
  });

  const hasFailed = checks.some(c => c.status === "failed");
  return { canCopy: !hasFailed, checks };
}

/**
 * Slippage-adjusted lot size utility — Phase Alpha placeholder.
 *
 * Rules (when broker is connected):
 *   actual <= max              → full lot
 *   actual <= 1.5 × max       → reduced lot = finalLot × (max / actual)
 *   actual > 1.5 × max        → block trade
 */
export function calculateSlippageAdjustedLot(
  finalLot: number,
  _maxSlippagePoints: number,
  _actualSlippagePoints: number
): { adjustedLot: number | null; blocked: boolean; reason: string } {
  return {
    adjustedLot: finalLot,
    blocked: false,
    reason: "Slippage check not available — broker not connected (paper-copy mode).",
  };
}

// ── Global master registry storage ────────────────────────────────────────

const masterRegistryStorage = {
  getItem: (_: string): string | null => {
    if (typeof window === "undefined") return null;
    try   { return localStorage.getItem("tcc:master-registry"); }
    catch { return null; }
  },
  setItem: (_: string, value: string): void => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem("tcc:master-registry", value); }
    catch {}
  },
  removeItem: (_: string): void => {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem("tcc:master-registry"); }
    catch {}
  },
};

// ── Master Registry Store — global ────────────────────────────────────────

interface MasterRegistryState {
  approvedMasters:  ApprovedMasterTrader[];
  allApplications:  MasterTraderApplication[];

  upsertApplication:  (application: MasterTraderApplication) => void;
  approveApplication: (applicationId: string, adminHandle: string) => ApprovedMasterTrader | null;
  rejectApplication:  (applicationId: string, adminHandle: string, reason: string) => void;
  requestMoreInfo:    (applicationId: string, adminHandle: string, request: string) => void;
  suspendMaster:      (masterTraderId: string, adminHandle: string, reason: string) => void;
  removeMaster:       (masterTraderId: string) => void;
  addAdminNote:       (applicationId: string, note: string) => void;
  markUnderReview:    (applicationId: string, adminHandle: string) => void;

  getActiveMasters:          () => ApprovedMasterTrader[];
  getApplicationByUserId:    (userId: string) => MasterTraderApplication | undefined;
  getMasterByUserId:          (userId: string) => ApprovedMasterTrader | undefined;
  getMasterById:              (masterId: string) => ApprovedMasterTrader | undefined;
  getPendingApplications:    () => MasterTraderApplication[];
}

export const useMasterRegistryStore = create<MasterRegistryState>()(
  persist(
    (set, get) => ({
      approvedMasters: [],
      allApplications: [],

      upsertApplication: (application) => {
        set((state) => {
          const idx = state.allApplications.findIndex(a => a.id === application.id);
          if (idx >= 0) {
            const next = [...state.allApplications];
            next[idx] = application;
            return { allApplications: next };
          }
          return { allApplications: [application, ...state.allApplications] };
        });
      },

      approveApplication: (applicationId, adminHandle) => {
        const app = get().allApplications.find(a => a.id === applicationId);
        if (!app) return null;
        const now = new Date().toISOString();
        const updatedApp: MasterTraderApplication = {
          ...app, status: "approved", reviewedBy: adminHandle, reviewedAt: now, updatedAt: now,
        };
        const master: ApprovedMasterTrader = {
          id:           `master_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          userId:       app.userId,
          tccId:        app.tccId,
          applicationId: app.id,
          displayName:  app.displayName,
          status:       "active",
          approvedAt:   now,
          approvedBy:   adminHandle,
          marketsTraded:  app.marketsTraded,
          strategiesUsed: app.strategiesUsed,
          brokerCompatibility: { sameBrokerRequired: true, status: "not_connected" },
          publicProfileRequired: true,
          trustScoreStatus: "insufficient_verified_data",
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          allApplications: state.allApplications.map(a => a.id === applicationId ? updatedApp : a),
          approvedMasters: [
            master,
            ...state.approvedMasters.filter(m => m.userId !== app.userId),
          ],
        }));
        return master;
      },

      rejectApplication: (applicationId, adminHandle, reason) => {
        const now = new Date().toISOString();
        set((state) => ({
          allApplications: state.allApplications.map(a =>
            a.id !== applicationId ? a : {
              ...a, status: "rejected" as MasterTraderApplicationStatus,
              rejectionReason: reason, reviewedBy: adminHandle, reviewedAt: now, updatedAt: now,
            }
          ),
        }));
      },

      requestMoreInfo: (applicationId, adminHandle, request) => {
        const now = new Date().toISOString();
        set((state) => ({
          allApplications: state.allApplications.map(a =>
            a.id !== applicationId ? a : {
              ...a, status: "more_info_required" as MasterTraderApplicationStatus,
              moreInfoRequest: request, reviewedBy: adminHandle, reviewedAt: now, updatedAt: now,
            }
          ),
        }));
      },

      suspendMaster: (masterTraderId, adminHandle, reason) => {
        const now = new Date().toISOString();
        const master = get().approvedMasters.find(m => m.id === masterTraderId);
        set((state) => ({
          approvedMasters: state.approvedMasters.map(m =>
            m.id !== masterTraderId ? m : { ...m, status: "suspended" as MasterTraderStatus, updatedAt: now }
          ),
          allApplications: state.allApplications.map(a =>
            master && a.userId !== master.userId ? a : {
              ...a,
              status: "suspended" as MasterTraderApplicationStatus,
              adminNotes: `Suspended by ${adminHandle}: ${reason}`,
              updatedAt: now,
            }
          ),
        }));
      },

      removeMaster: (masterTraderId) => {
        const now = new Date().toISOString();
        set((state) => ({
          approvedMasters: state.approvedMasters.map(m =>
            m.id !== masterTraderId ? m : { ...m, status: "removed" as MasterTraderStatus, updatedAt: now }
          ),
        }));
      },

      addAdminNote: (applicationId, note) => {
        const now = new Date().toISOString();
        set((state) => ({
          allApplications: state.allApplications.map(a =>
            a.id !== applicationId ? a : { ...a, adminNotes: note, updatedAt: now }
          ),
        }));
      },

      markUnderReview: (applicationId, adminHandle) => {
        const now = new Date().toISOString();
        set((state) => ({
          allApplications: state.allApplications.map(a =>
            a.id !== applicationId ? a : {
              ...a, status: "under_review" as MasterTraderApplicationStatus,
              reviewedBy: adminHandle, updatedAt: now,
            }
          ),
        }));
      },

      getActiveMasters:       () => get().approvedMasters.filter(m => m.status === "active"),
      getApplicationByUserId: (userId) => get().allApplications.find(a => a.userId === userId),
      getMasterByUserId:       (userId) => get().approvedMasters.find(m => m.userId === userId),
      getMasterById:           (id) => get().approvedMasters.find(m => m.id === id),
      getPendingApplications: () => get().allApplications.filter(
        a => a.status === "submitted" || a.status === "under_review" || a.status === "more_info_required"
      ),
    }),
    {
      name:    "master-registry",
      storage: createJSONStorage(() => masterRegistryStorage),
    }
  )
);

// ── User-scoped copy trading store ────────────────────────────────────────

interface CopyTradingState {
  myApplication: MasterTraderApplication | null;
  relationships:  CopyRelationship[];
  copyHistory:    CopyTradeHistoryItem[];
  feeModels:      CopyFeeModel[];

  submitApplication: (params: {
    userId: string; tccId: string; displayName: string;
    marketsTraded: string[]; strategiesUsed: string[];
    experienceSummary: string; riskManagementSummary: string;
    reasonForApplying: string;
    hasAcceptedRiskDisclosure: boolean;
    hasAcceptedPerformanceTruthPolicy: boolean;
    hasAcceptedCopyTradingTerms: boolean;
  }) => MasterTraderApplication;

  resubmitApplication: () => void;

  startCopyRelationship: (params: {
    followerUserId: string;
    masterTraderUserId: string;
    masterTraderId: string;
    masterDisplayName: string;
    mode: CopyMode;
    riskSettings: CopyRiskSettings;
  }) => CopyRelationship;

  updateRiskSettings:  (relationshipId: string, settings: Partial<CopyRiskSettings>) => void;
  pauseRelationship:   (relationshipId: string)                  => void;
  resumeRelationship:  (relationshipId: string)                  => void;
  stopRelationship:    (relationshipId: string, reason?: string) => void;

  executePaperCopy: (params: {
    relationshipId: string;
    masterTraderUserId: string;
    masterDisplayName: string;
    followerUserId: string;
    symbol: string;
    displayName: string;
    side: "BUY" | "SELL";
    lotSize: number;
    entryPrice: number;
    safetyResult: CopySafetyCheckResult;
  }) => CopyTradeHistoryItem;

  recordBlockedCopy: (params: {
    relationshipId: string;
    masterTraderUserId: string;
    masterDisplayName: string;
    followerUserId: string;
    symbol: string;
    displayName: string;
    side: "BUY" | "SELL";
    lotSize: number;
    entryPrice: number;
    reason: string;
    safetyResult: CopySafetyCheckResult;
  }) => void;

  initFeeModel: (relationshipId: string, balance: number, feePercent: number) => void;

  getActiveRelationships:      () => CopyRelationship[];
  getRelationshipByMaster:     (masterTraderId: string) => CopyRelationship | undefined;
  getOpenCopiedTradeCount:     (relationshipId: string) => number;
  getFeeModel:                 (relationshipId: string) => CopyFeeModel | undefined;
}

export const useCopyTradingStore = create<CopyTradingState>()(
  persist(
    (set, get) => ({
      myApplication: null,
      relationships:  [],
      copyHistory:    [],
      feeModels:      [],

      submitApplication: (params) => {
        const now = new Date().toISOString();
        const app: MasterTraderApplication = {
          id:           `app_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          userId:       params.userId,
          tccId:        params.tccId,
          displayName:  params.displayName,
          status:       "submitted",
          marketsTraded:  params.marketsTraded,
          strategiesUsed: params.strategiesUsed,
          experienceSummary:      params.experienceSummary,
          riskManagementSummary:  params.riskManagementSummary,
          reasonForApplying:      params.reasonForApplying,
          hasAcceptedRiskDisclosure:         params.hasAcceptedRiskDisclosure,
          hasAcceptedPerformanceTruthPolicy: params.hasAcceptedPerformanceTruthPolicy,
          hasAcceptedCopyTradingTerms:       params.hasAcceptedCopyTradingTerms,
          submittedAt: now,
          createdAt:   now,
          updatedAt:   now,
        };
        set({ myApplication: app });
        // Push to global registry for admin visibility
        useMasterRegistryStore.getState().upsertApplication(app);
        return app;
      },

      resubmitApplication: () => {
        const { myApplication } = get();
        if (!myApplication) return;
        const now = new Date().toISOString();
        const updated: MasterTraderApplication = {
          ...myApplication,
          status: "submitted",
          submittedAt: now,
          updatedAt: now,
        };
        set({ myApplication: updated });
        useMasterRegistryStore.getState().upsertApplication(updated);
      },

      startCopyRelationship: (params) => {
        const now = new Date().toISOString();
        const relationship: CopyRelationship = {
          id:                   `rel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          followerUserId:       params.followerUserId,
          masterTraderUserId:   params.masterTraderUserId,
          masterTraderId:       params.masterTraderId,
          masterDisplayName:    params.masterDisplayName,
          mode:                 params.mode,
          status:               "active",
          riskSettings:         params.riskSettings,
          startedAt:            now,
          updatedAt:            now,
        };
        set((state) => ({
          relationships: [
            relationship,
            ...state.relationships.filter(r => r.masterTraderId !== params.masterTraderId),
          ],
        }));
        return relationship;
      },

      updateRiskSettings: (relationshipId, settings) => {
        set((state) => ({
          relationships: state.relationships.map(r =>
            r.id !== relationshipId ? r : {
              ...r,
              riskSettings: { ...r.riskSettings, ...settings },
              updatedAt: new Date().toISOString(),
            }
          ),
        }));
      },

      pauseRelationship: (relationshipId) => {
        set((state) => ({
          relationships: state.relationships.map(r =>
            r.id !== relationshipId ? r : {
              ...r, status: "paused" as CopyRelationshipStatus, updatedAt: new Date().toISOString(),
            }
          ),
        }));
      },

      resumeRelationship: (relationshipId) => {
        set((state) => ({
          relationships: state.relationships.map(r =>
            r.id !== relationshipId ? r : {
              ...r, status: "active" as CopyRelationshipStatus, updatedAt: new Date().toISOString(),
            }
          ),
        }));
      },

      stopRelationship: (relationshipId, reason) => {
        const now = new Date().toISOString();
        set((state) => ({
          relationships: state.relationships.map(r =>
            r.id !== relationshipId ? r : {
              ...r, status: "stopped" as CopyRelationshipStatus,
              stoppedAt: now, stopReason: reason, updatedAt: now,
            }
          ),
        }));
      },

      executePaperCopy: (params) => {
        const now = new Date().toISOString();
        const item: CopyTradeHistoryItem = {
          id:                   `copy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          relationshipId:       params.relationshipId,
          masterTraderUserId:   params.masterTraderUserId,
          masterDisplayName:    params.masterDisplayName,
          followerUserId:       params.followerUserId,
          symbol:               params.symbol,
          displayName:          params.displayName,
          side:                 params.side,
          lotSize:              params.lotSize,
          entryPrice:           params.entryPrice,
          status:               "copied_paper",
          mode:                 "paper_copy",
          riskCheckResult:      params.safetyResult,
          createdAt:            now,
        };
        set((state) => ({ copyHistory: [item, ...state.copyHistory] }));
        return item;
      },

      recordBlockedCopy: (params) => {
        const now = new Date().toISOString();
        const item: CopyTradeHistoryItem = {
          id:                 `blocked_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          relationshipId:     params.relationshipId,
          masterTraderUserId: params.masterTraderUserId,
          masterDisplayName:  params.masterDisplayName,
          followerUserId:     params.followerUserId,
          symbol:             params.symbol,
          displayName:        params.displayName,
          side:               params.side,
          lotSize:            params.lotSize,
          entryPrice:         params.entryPrice,
          status:             "blocked",
          reason:             params.reason,
          mode:               "paper_copy",
          riskCheckResult:    params.safetyResult,
          createdAt:          now,
        };
        set((state) => ({ copyHistory: [item, ...state.copyHistory] }));
      },

      initFeeModel: (relationshipId, balance, feePercent) => {
        if (get().feeModels.find(f => f.relationshipId === relationshipId)) return;
        set((state) => ({
          feeModels: [
            ...state.feeModels,
            {
              relationshipId,
              performanceFeePercent:  feePercent,
              highWaterMark:          balance,
              currentBalanceSnapshot: balance,
              totalFeesAccrued:       0,
            },
          ],
        }));
      },

      getActiveRelationships: () =>
        get().relationships.filter(r => r.status === "active" || r.status === "paused"),

      getRelationshipByMaster: (masterTraderId) =>
        get().relationships.find(r => r.masterTraderId === masterTraderId),

      getOpenCopiedTradeCount: (relationshipId) =>
        get().copyHistory.filter(
          h => h.relationshipId === relationshipId && h.status === "copied_paper"
        ).length,

      getFeeModel: (relationshipId) =>
        get().feeModels.find(f => f.relationshipId === relationshipId),
    }),
    {
      name:    "copy-trading",
      storage: createJSONStorage(() => getUserScopedStorage("copy-trading")),
    }
  )
);