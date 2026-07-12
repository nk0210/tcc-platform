/**
 * TCC Analytics Store — Phase Alpha
 *
 * Analytics are derived from the trade history now stored in PostgreSQL.
 *
 * Strategy:
 *   1. Primary: call the /analytics/full API endpoint for server-computed stats
 *   2. Secondary: expose raw closedTrades from tradeStore for the existing
 *      performance.ts helpers (the analytics page uses both approaches)
 *   3. The store provides a `refresh()` that fetches fresh analytics from the API
 *
 * This preserves backward compatibility with the existing analytics page UI
 * which calls performance calculation functions from lib/analytics/performance.ts
 * on the tradeStore.closedTrades array.
 */
import { create } from "zustand";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/store/authStore";

// ── Types ─────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  totalTrades:         number;
  wins:                number;
  losses:              number;
  breakevens:          number;
  winRate:             number;
  profitFactor:        number;
  avgWin:              number;
  avgLoss:             number;
  avgNetPnl:           number;
  avgRR:               number;
  avgDurationMs:       number;
  totalNetPnl:         number;
  totalGrossPnl:       number;
  totalCommission:     number;
  roiPercent:          number;
  maxDrawdownPercent:  number;
  bestTrade:           number;
  worstTrade:          number;
  slHits:              number;
  tpHits:              number;
  manualCloses:        number;
}

export interface PeriodStat {
  date:     string;
  pnl:      number;
  trades:   number;
  wins:     number;
  winRate:  number;
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
  session:  string;
  trades:   number;
  wins:     number;
  netPnl:   number;
  winRate:  number;
}

export interface FullAnalytics {
  overview:  AnalyticsOverview;
  daily:     PeriodStat[];
  monthly:   PeriodStat[];
  bySymbol:  SymbolStat[];
  bySession: SessionStat[];
}

// ── Store interface ────────────────────────────────────────────────────────

interface AnalyticsStore {
  data:          FullAnalytics | null;
  isLoading:     boolean;
  isInitialized: boolean;
  error:         string | null;
  lastFetchedAt: number | null;

  // Lifecycle
  init:    () => Promise<void>;
  reset:   () => void;
  refresh: (filters?: { from?: string; to?: string }) => Promise<void>;
}

// ── Empty/default states ──────────────────────────────────────────────────

const EMPTY_OVERVIEW: AnalyticsOverview = {
  totalTrades: 0, wins: 0, losses: 0, breakevens: 0,
  winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0, avgNetPnl: 0,
  avgRR: 0, avgDurationMs: 0, totalNetPnl: 0, totalGrossPnl: 0,
  totalCommission: 0, roiPercent: 0, maxDrawdownPercent: 0,
  bestTrade: 0, worstTrade: 0, slHits: 0, tpHits: 0, manualCloses: 0,
};

// ── Store ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 1 minute

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

  reset: () => {
    set({
      data:          null,
      isLoading:     false,
      isInitialized: false,
      error:         null,
      lastFetchedAt: null,
    });
  },

  refresh: async (filters = {}) => {
    const { lastFetchedAt } = get();
    // Respect cache unless filters are explicitly provided
    const hasFilters = filters.from || filters.to;
    if (!hasFilters && lastFetchedAt && Date.now() - lastFetchedAt < CACHE_TTL_MS) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to)   params.set("to",   filters.to);
      const qs = params.toString() ? `?${params.toString()}` : "";

      const res = await api.get<FullAnalytics>(`/analytics/full${qs}`);

      if (!res.success) {
        set({ isLoading: false, error: res.error });
        return;
      }

      set({
        data:          res.data,
        isLoading:     false,
        error:         null,
        lastFetchedAt: Date.now(),
      });
    } catch (err) {
      console.error("[analyticsStore.refresh]", err);
      set({ isLoading: false, error: "Failed to load analytics" });
    }
  },
}));

// ── Auto-init on auth state change ────────────────────────────────────────

if (typeof window !== "undefined") {
  useAuthStore.subscribe(
    (state) => state.user?.id,
    (userId) => {
      if (userId) {
        useAnalyticsStore.getState().init();
      } else {
        useAnalyticsStore.getState().reset();
      }
    }
  );
}

// ── Convenience hook ──────────────────────────────────────────────────────

export function selectOverview(state: AnalyticsStore): AnalyticsOverview {
  return state.data?.overview ?? EMPTY_OVERVIEW;
}