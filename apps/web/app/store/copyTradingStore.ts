/**
 * TCC Copy Trading Store — Phase Alpha
 * API-backed. Paper-copy mode only — no real broker execution.
 *
 * Replaces the old two-store split (useMasterRegistryStore + useCopyTradingStore):
 * masters now come straight from the API instead of a client-side "registry",
 * so there is a single store here. Admin moderation (approve/reject/suspend
 * applications, suspend/remove masters) is a separate concern served by
 * /copy-trading/admin/* routes and is not part of this follower-facing store.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "MORE_INFO_REQUIRED" | "SUSPENDED";

export type MasterStatus        = "ACTIVE" | "SUSPENDED" | "REMOVED";
export type CopyMode            = "PAPER_COPY" | "LIVE_COPY";
export type RelationshipStatus  = "ACTIVE" | "PAUSED" | "STOPPED" | "BLOCKED" | "PENDING_BROKER_CONNECTION";
export type CopyLotMode         = "FIXED_LOT" | "RISK_MULTIPLIER" | "EQUITY_RATIO";
export type CopyTradeStatus     = "COPIED_PAPER" | "SKIPPED" | "BLOCKED" | "PENDING" | "FAILED";

export interface MasterTraderApplication {
  id:                                 string;
  userId:                             string;
  tccId:                              string;
  displayName:                        string;
  status:                             ApplicationStatus;
  marketsTraded:                      string[];
  strategiesUsed:                     string[];
  experienceSummary:                  string;
  riskManagementSummary:              string;
  reasonForApplying:                  string;
  hasAcceptedRiskDisclosure:          boolean;
  hasAcceptedPerformanceTruthPolicy:  boolean;
  hasAcceptedCopyTradingTerms:        boolean;
  adminNotes:                         string | null;
  rejectionReason:                    string | null;
  moreInfoRequest:                    string | null;
  reviewedBy:                         string | null;
  reviewedAt:                         string | null;
  submittedAt:                        string | null;
  createdAt:                          string;
  updatedAt:                          string;
}

export interface MasterTrader {
  id:                     string;
  userId:                 string;
  applicationId:          string;
  tccId:                  string;
  displayName:            string;
  status:                 MasterStatus;
  marketsTraded:          string[];
  strategiesUsed:         string[];
  brokerName:             string | null;
  sameBrokerRequired:     boolean;
  brokerStatus:           string;
  publicProfileRequired:  boolean;
  trustScoreStatus:       string;
  approvedAt:             string;
  approvedBy:             string;
  createdAt:              string;
  updatedAt:              string;
}

export interface CopyRiskSettings {
  maxRiskPerTradePercent:  number;
  maxDailyLossPercent:     number;
  maxTotalDrawdownPercent: number;
  maxOpenCopiedTrades:     number;
  copyLotMode:             CopyLotMode;
  fixedLotSize:            number;
  riskMultiplier:          number;
  maxSlippagePoints:       number;
  requireStopLoss:         boolean;
  newsFilterEnabled:       boolean;
}

export interface CopyFeeModel {
  id:                     string;
  relationshipId:         string;
  userId:                 string;
  performanceFeePercent:  number;
  highWaterMark:          number;
  currentBalanceSnapshot: number;
  totalFeesAccrued:       number;
  lastCalculatedAt:       string | null;
  createdAt:              string;
  updatedAt:              string;
}

export interface CopyRelationship extends CopyRiskSettings {
  id:                 string;
  followerUserId:     string;
  masterTraderId:     string;
  masterDisplayName:  string;
  mode:               CopyMode;
  status:             RelationshipStatus;
  feeModel?:          CopyFeeModel | null;
  startedAt:          string;
  updatedAt:          string;
  stoppedAt:          string | null;
  stopReason:         string | null;
}

export interface CopyTradeHistory {
  id:              string;
  relationshipId:  string;
  masterUserId:    string;
  followerUserId:  string;
  symbol:          string;
  displayName:     string;
  side:            "BUY" | "SELL";
  lotSize:         number;
  entryPrice:      number;
  status:          CopyTradeStatus;
  reason:          string | null;
  mode:            CopyMode;
  riskCheckResult: unknown;
  createdAt:       string;
}

export interface ApplicationUpdateInput {
  marketsTraded?:                     string[];
  strategiesUsed?:                    string[];
  experienceSummary?:                 string;
  riskManagementSummary?:             string;
  reasonForApplying?:                 string;
  hasAcceptedRiskDisclosure?:         boolean;
  hasAcceptedPerformanceTruthPolicy?: boolean;
  hasAcceptedCopyTradingTerms?:       boolean;
}

export interface StartCopyingInput {
  masterTraderId: string;
  riskSettings?:  Partial<CopyRiskSettings>;
}

export interface MasterFilters {
  marketsTraded?:  string[];
  strategiesUsed?: string[];
}

interface PaginatedResult<T> {
  items:      T[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

const PAGE_SIZE = 20;

function buildMastersQuery(filters?: MasterFilters): string {
  const qs = new URLSearchParams();
  qs.set("page", "1");
  qs.set("pageSize", String(PAGE_SIZE));
  if (filters?.marketsTraded?.length)  qs.set("marketsTraded", filters.marketsTraded.join(","));
  if (filters?.strategiesUsed?.length) qs.set("strategiesUsed", filters.strategiesUsed.join(","));
  return qs.toString();
}

// ── Store ─────────────────────────────────────────────────────────────────

interface CopyTradingStore {
  masters:          MasterTrader[];
  myApplication:    MasterTraderApplication | null;
  myRelationships:  CopyRelationship[];
  copyHistory:      CopyTradeHistory[];
  isLoading:        boolean;
  isSyncing:        boolean;
  isInitialized:    boolean;
  error:            string | null;

  init:  () => Promise<void>;
  reset: () => void;

  getMasters: (filters?: MasterFilters) => Promise<void>;
  getMaster:  (masterId: string) => Promise<MasterTrader | null>;

  createApplication:  () => Promise<MasterTraderApplication | null>;
  updateApplication:  (input: ApplicationUpdateInput) => Promise<void>;
  submitApplication:  () => Promise<void>;

  startCopying:       (input: StartCopyingInput) => Promise<CopyRelationship | null>;
  stopCopying:        (relationshipId: string, reason?: string) => Promise<void>;
  pauseCopying:       (relationshipId: string) => Promise<void>;
  resumeCopying:      (relationshipId: string) => Promise<void>;
  updateRiskSettings: (relationshipId: string, settings: Partial<CopyRiskSettings>) => Promise<void>;

  getCopyHistory: (page?: number) => Promise<void>;
}

export const useCopyTradingStore = create<CopyTradingStore>()((set, get) => ({
  masters:         [],
  myApplication:   null,
  myRelationships: [],
  copyHistory:     [],
  isLoading:       false,
  isSyncing:       false,
  isInitialized:   false,
  error:           null,

  // ── Init ──────────────────────────────────────────────────────────────

  init: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      const [mastersRes, applicationRes, relationshipsRes] = await Promise.all([
        api.get<PaginatedResult<MasterTrader>>(`/copy-trading/masters?${buildMastersQuery()}`),
        api.get<MasterTraderApplication | null>("/copy-trading/application"),
        api.get<PaginatedResult<CopyRelationship>>(`/copy-trading/relationships?page=1&pageSize=${PAGE_SIZE}`),
      ]);

      set({
        masters:         mastersRes.success ? (mastersRes.data.items ?? []) : [],
        myApplication:   applicationRes.success ? (applicationRes.data ?? null) : null,
        myRelationships: relationshipsRes.success ? (relationshipsRes.data.items ?? []) : [],
        isLoading:       false,
        isInitialized:   true,
        error:           null,
      });
    } catch (err) {
      console.error("[copyTradingStore.init]", err);
      set({ isLoading: false, error: "Failed to load copy trading data", isInitialized: true });
    }
  },

  reset: () =>
    set({
      masters: [], myApplication: null, myRelationships: [], copyHistory: [],
      isLoading: false, isSyncing: false, isInitialized: false, error: null,
    }),

  // ── Masters ───────────────────────────────────────────────────────────

  getMasters: async (filters) => {
    try {
      const res = await api.get<PaginatedResult<MasterTrader>>(`/copy-trading/masters?${buildMastersQuery(filters)}`);
      if (res.success) set({ masters: res.data.items ?? [] });
      else set({ error: res.error });
    } catch (err) {
      console.error("[copyTradingStore.getMasters]", err);
      set({ error: "Failed to load masters" });
    }
  },

  getMaster: async (masterId) => {
    try {
      const res = await api.get<MasterTrader>(`/copy-trading/masters/${masterId}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[copyTradingStore.getMaster]", err);
      return null;
    }
  },

  // ── Application ───────────────────────────────────────────────────────

  createApplication: async () => {
    set({ isSyncing: true, error: null });
    try {
      const res = await api.post<MasterTraderApplication>("/copy-trading/application");
      if (!res.success) { set({ isSyncing: false, error: res.error }); return null; }
      set({ myApplication: res.data, isSyncing: false });
      return res.data;
    } catch (err) {
      console.error("[copyTradingStore.createApplication]", err);
      set({ isSyncing: false, error: "Failed to create application" });
      return null;
    }
  },

  updateApplication: async (input) => {
    const prev = get().myApplication;
    if (prev) set({ myApplication: { ...prev, ...input } });
    set({ isSyncing: true, error: null });

    try {
      const res = await api.put<MasterTraderApplication>("/copy-trading/application", input);
      if (!res.success) { set({ myApplication: prev, isSyncing: false, error: res.error }); return; }
      set({ myApplication: res.data, isSyncing: false });
    } catch (err) {
      console.error("[copyTradingStore.updateApplication]", err);
      set({ myApplication: prev, isSyncing: false, error: "Failed to update application" });
    }
  },

  submitApplication: async () => {
    const prev = get().myApplication;
    if (prev) set({ myApplication: { ...prev, status: "SUBMITTED" } });
    set({ isSyncing: true, error: null });

    try {
      const res = await api.post<MasterTraderApplication>("/copy-trading/application/submit");
      if (!res.success) { set({ myApplication: prev, isSyncing: false, error: res.error }); return; }
      set({ myApplication: res.data, isSyncing: false });
    } catch (err) {
      console.error("[copyTradingStore.submitApplication]", err);
      set({ myApplication: prev, isSyncing: false, error: "Failed to submit application" });
    }
  },

  // ── Copy relationships ────────────────────────────────────────────────

  startCopying: async (input) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await api.post<CopyRelationship>("/copy-trading/relationships", input);
      if (!res.success) { set({ isSyncing: false, error: res.error }); return null; }
      set((s) => ({
        myRelationships: [res.data, ...s.myRelationships.filter((r) => r.id !== res.data.id)],
        isSyncing:       false,
      }));
      return res.data;
    } catch (err) {
      console.error("[copyTradingStore.startCopying]", err);
      set({ isSyncing: false, error: "Failed to start copying" });
      return null;
    }
  },

  stopCopying: async (relationshipId, reason) => {
    const prev = get().myRelationships;
    set({
      myRelationships: prev.map((r) => (r.id === relationshipId ? { ...r, status: "STOPPED" as const, stopReason: reason ?? null } : r)),
    });

    try {
      const res = await api.post<CopyRelationship>(`/copy-trading/relationships/${relationshipId}/stop`, { stopReason: reason });
      if (!res.success) { set({ myRelationships: prev, error: res.error }); return; }
      set((s) => ({ myRelationships: s.myRelationships.map((r) => (r.id === relationshipId ? res.data : r)) }));
    } catch (err) {
      console.error("[copyTradingStore.stopCopying]", err);
      set({ myRelationships: prev, error: "Failed to stop copying" });
    }
  },

  pauseCopying: async (relationshipId) => {
    const prev = get().myRelationships;
    set({ myRelationships: prev.map((r) => (r.id === relationshipId ? { ...r, status: "PAUSED" as const } : r)) });

    try {
      const res = await api.post<CopyRelationship>(`/copy-trading/relationships/${relationshipId}/pause`);
      if (!res.success) { set({ myRelationships: prev, error: res.error }); return; }
      set((s) => ({ myRelationships: s.myRelationships.map((r) => (r.id === relationshipId ? res.data : r)) }));
    } catch (err) {
      console.error("[copyTradingStore.pauseCopying]", err);
      set({ myRelationships: prev, error: "Failed to pause copying" });
    }
  },

  resumeCopying: async (relationshipId) => {
    const prev = get().myRelationships;
    set({ myRelationships: prev.map((r) => (r.id === relationshipId ? { ...r, status: "ACTIVE" as const } : r)) });

    try {
      const res = await api.post<CopyRelationship>(`/copy-trading/relationships/${relationshipId}/resume`);
      if (!res.success) { set({ myRelationships: prev, error: res.error }); return; }
      set((s) => ({ myRelationships: s.myRelationships.map((r) => (r.id === relationshipId ? res.data : r)) }));
    } catch (err) {
      console.error("[copyTradingStore.resumeCopying]", err);
      set({ myRelationships: prev, error: "Failed to resume copying" });
    }
  },

  updateRiskSettings: async (relationshipId, settings) => {
    const prev = get().myRelationships;
    set({ myRelationships: prev.map((r) => (r.id === relationshipId ? { ...r, ...settings } : r)) });

    try {
      const res = await api.put<CopyRelationship>(`/copy-trading/relationships/${relationshipId}/risk`, settings);
      if (!res.success) { set({ myRelationships: prev, error: res.error }); return; }
      set((s) => ({ myRelationships: s.myRelationships.map((r) => (r.id === relationshipId ? res.data : r)) }));
    } catch (err) {
      console.error("[copyTradingStore.updateRiskSettings]", err);
      set({ myRelationships: prev, error: "Failed to update risk settings" });
    }
  },

  // ── History ───────────────────────────────────────────────────────────

  getCopyHistory: async (page = 1) => {
    try {
      const res = await api.get<PaginatedResult<CopyTradeHistory>>(`/copy-trading/history?page=${page}&pageSize=${PAGE_SIZE}`);
      if (res.success) set({ copyHistory: res.data.items ?? [] });
      else set({ error: res.error });
    } catch (err) {
      console.error("[copyTradingStore.getCopyHistory]", err);
      set({ error: "Failed to load copy history" });
    }
  },
}));

// ── Auto-init / reset (single-arg subscribe) ──────────────────────────────

if (typeof window !== "undefined") {
  import("@/store/authStore").then(({ useAuthStore }) => {
    let prevUserId: string | undefined;

    useAuthStore.subscribe((state) => {
      const userId = state.user?.id;
      if (userId !== prevUserId) {
        prevUserId = userId;
        if (userId) {
          useCopyTradingStore.getState().init();
        } else {
          useCopyTradingStore.getState().reset();
        }
      }
    });
  });
}
