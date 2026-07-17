/**
 * TCC Analytics Store — Phase Alpha
 * Fetches server-computed statistics from /analytics/full.
 * 60-second cache to avoid redundant calls.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  totalTrades:        number;
  wins:               number;
  losses:             number;
  breakevens:         number;
  winRate:            number;
  profitFactor:       number;
  avgWin:             number;
  avgLoss:            number;
  avgNetPnl:          number;
  avgRR:              number;
  avgDurationMs:      number;
  totalNetPnl:        number;
  totalGrossPnl:      number;
  totalCommission:    number;
  roiPercent:         number;
  maxDrawdownPercent: number;
  bestTrade:          number;
  worstTrade:         number;
  slHits:             number;
  tpHits:             number;
  manualCloses:       number;
}

export interface PeriodStat {
  date:    string;
  pnl:     number;
  trades:  number;
  wins:    number;
  winRate: number;
}

export interface SymbolStat {
  symbol:      string;
  displayName: string;
  category:    string;
  emoji:       string | null;
  trades:      number;
  wins:        number;
  losses:      number;
  netPnl:      number;
  winRate:     number;
  bestTrade:   number;
  worstTrade:  number;
}

export interface SessionStat {
  session: string;
  trades:  number;
  wins:    number;
  netPnl:  number;
  winRate: number;
}

export interface FullAnalytics {
  overview:  AnalyticsOverview;
  daily:     PeriodStat[];
  monthly:   PeriodStat[];
  bySymbol:  SymbolStat[];
  bySession: SessionStat[];
}

// ── Empty default ─────────────────────────────────────────────────────────

const EMPTY_OVERVIEW: AnalyticsOverview = {
  totalTrades: 0, wins: 0, losses: 0, breakevens: 0,
  winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0, avgNetPnl: 0,
  avgRR: 0, avgDurationMs: 0, totalNetPnl: 0, totalGrossPnl: 0,
  totalCommission: 0, roiPercent: 0, maxDrawdownPercent: 0,
  bestTrade: 0, worstTrade: 0, slHits: 0, tpHits: 0, manualCloses: 0,
};

// ── Store interface ────────────────────────────────────────────────────────

interface AnalyticsStore {
  data:          FullAnalytics | null;
  isLoading:     boolean;
  isInitialized: boolean;
  error:         string | null;
  lastFetchedAt: number | null;

  init:    () => Promise<void>;
  reset:   () => void;
  refresh: (filters?: { from?: string; to?: string }) => Promise<void>;
}

const CACHE_MS = 60_000;

// ── Store ─────────────────────────────────────────────────────────────────

export const useAnalyticsStore = create<AnalyticsStore>()((set, get) => ({
  data:          null,
  isLoading:     false,
  isInitialized: false,
  error:         null,
  lastFetchedAt: null,

  init: async () => {
    if (get().isInitialized) return;
    await get().refresh();
    set({ isInitialized: true });
  },

  reset: () =>
    set({
      data: null, isLoading: false, isInitialized: false,
      error: null, lastFetchedAt: null,
    }),

  refresh: async (filters = {}) => {
    const { lastFetchedAt } = get();
    const hasFilters = !!(filters.from || filters.to);

    if (!hasFilters && lastFetchedAt && Date.now() - lastFetchedAt < CACHE_MS) return;

    set({ isLoading: true, error: null });

    try {
      const qs  = new URLSearchParams();
      if (filters.from) qs.set("from", filters.from);
      if (filters.to)   qs.set("to",   filters.to);
      const query = qs.toString() ? `?${qs.toString()}` : "";

      const res = await api.get<FullAnalytics>(`/analytics/full${query}`);
      if (!res.success) { set({ isLoading: false, error: res.error }); return; }

      set({ data: res.data, isLoading: false, error: null, lastFetchedAt: Date.now() });
    } catch (err) {
      console.error("[analyticsStore.refresh]", err);
      set({ isLoading: false, error: "Failed to load analytics" });
    }
  },
}));

// ── Selector ──────────────────────────────────────────────────────────────

export function selectOverview(state: AnalyticsStore): AnalyticsOverview {
  return state.data?.overview ?? EMPTY_OVERVIEW;
}

// ── Auto-init / reset (single-arg subscribe) ──────────────────────────────

if (typeof window !== "undefined") {
  import("@/store/authStore").then(({ useAuthStore }) => {
    let prevUserId: string | undefined;

    useAuthStore.subscribe((state) => {
      const userId = state.user?.id;
      if (userId !== prevUserId) {
        prevUserId = userId;
        if (userId) {
          useAnalyticsStore.getState().init();
        } else {
          useAnalyticsStore.getState().reset();
        }
      }
    });
  });
}