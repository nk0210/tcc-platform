/**
 * TCC Trade Store — Phase Alpha
 *
 * Migrated from localStorage-only (Beta) to API-backed (Alpha).
 *
 * Architecture:
 *   - Positions and closedTrades loaded from PostgreSQL via REST API on init
 *   - All mutations (open/close/SL-TP update) call API first, then update local state
 *   - updatePrices() is LOCAL ONLY — called by live price feed, no API call
 *   - floatingPnl and equity are computed locally from live prices
 *   - Auto-initialises when user logs in via authStore subscription
 *   - Resets to initial state on logout
 *
 * Paper trading:
 *   - PAPER_INITIAL_BALANCE = $10,000
 *   - Commission = 0.01% of |grossPnl|
 *   - Balance = initial + Σ(netPnl of all closed trades) — computed server-side
 */
import { create } from "zustand";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/store/authStore";

// ── Constants ─────────────────────────────────────────────────────────────

export const PAPER_INITIAL_BALANCE = 10_000;
export const COMMISSION_RATE       = 0.0001; // 0.01%

// ── Types ─────────────────────────────────────────────────────────────────

export type TradeSide    = "BUY" | "SELL";
export type CloseReason  = "MANUAL" | "STOP_LOSS" | "TAKE_PROFIT";
export type TradeResult  = "WIN" | "LOSS" | "BREAKEVEN";

export interface Position {
  id:           string;
  symbol:       string;
  displayName:  string;
  category:     string;
  emoji?:       string;
  side:         TradeSide;
  lotSize:      number;
  entryPrice:   number;
  currentPrice: number;
  sl:           number | null;
  tp:           number | null;
  marginUsed:   number;
  notionalValue: number;
  leverage:     number;
  floatingPnl:  number; // computed locally
  openedAt:     string;
}

export interface ClosedTrade {
  id:           string;
  symbol:       string;
  displayName:  string;
  category:     string;
  emoji?:       string;
  side:         TradeSide;
  lotSize:      number;
  entryPrice:   number;
  exitPrice:    number;
  sl:           number | null;
  tp:           number | null;
  grossPnl:     number;
  commission:   number;
  netPnl:       number;
  closeReason:  CloseReason;
  result:       TradeResult;
  openedAt:     string;
  closedAt:     string;
  durationMs:   number;
  session?:     string;
  strategy?:    string;
}

export interface OpenPositionInput {
  symbol:        string;
  displayName:   string;
  category:      string;
  emoji?:        string;
  side:          TradeSide;
  lotSize:       number;
  entryPrice:    number;
  sl?:           number | null;
  tp?:           number | null;
  marginUsed:    number;
  notionalValue: number;
  leverage:      number;
}

export interface ClosePositionInput {
  exitPrice:   number;
  closeReason: CloseReason;
  grossPnl:    number;   // calculated by the frontend
  durationMs:  number;
}

// ── Store interface ────────────────────────────────────────────────────────

interface TradeStore {
  positions:    Position[];
  closedTrades: ClosedTrade[];
  balance:      number;
  equity:       number;
  floatingPnl:  number;

  isLoading:      boolean;
  isSyncing:      boolean;
  isInitialized:  boolean;
  error:          string | null;

  // Lifecycle
  init:  () => Promise<void>;
  reset: () => void;

  // Mutations — API-backed with optimistic local updates
  openPosition:    (input: OpenPositionInput)                      => Promise<Position | null>;
  closePosition:   (id: string, input: ClosePositionInput)         => Promise<ClosedTrade | null>;
  updateSLTP:      (id: string, sl: number | null, tp: number | null) => Promise<void>;
  deletePosition:  (id: string)                                    => Promise<void>;

  // Local only — called by price feed
  updatePrices: (prices: Record<string, number>) => void;
}

// ── PnL calculation helper ─────────────────────────────────────────────────

function computePositionPnl(
  side:         TradeSide,
  entryPrice:   number,
  currentPrice: number,
  lotSize:      number
): number {
  // Simplified: lotSize × (exit − entry) for BUY; reversed for SELL
  // Works for USD-settled instruments (crypto perpetuals, forex CFD)
  if (side === "BUY")  return (currentPrice - entryPrice) * lotSize;
  return (entryPrice - currentPrice) * lotSize;
}

function mapApiTrade(t: any): Position {
  return {
    id:           t.id,
    symbol:       t.symbol,
    displayName:  t.displayName,
    category:     t.category ?? "crypto",
    emoji:        t.emoji    ?? undefined,
    side:         t.side,
    lotSize:      t.lotSize,
    entryPrice:   t.entryPrice,
    currentPrice: t.currentPrice ?? t.entryPrice,
    sl:           t.sl ?? null,
    tp:           t.tp ?? null,
    marginUsed:   t.marginUsed   ?? 0,
    notionalValue: t.notionalValue ?? 0,
    leverage:     t.leverage     ?? 10,
    floatingPnl:  computePositionPnl(t.side, t.entryPrice, t.currentPrice ?? t.entryPrice, t.lotSize),
    openedAt:     typeof t.openedAt === "string" ? t.openedAt : new Date(t.openedAt).toISOString(),
  };
}

function mapApiClosed(t: any): ClosedTrade {
  return {
    id:          t.id,
    symbol:      t.symbol,
    displayName: t.displayName,
    category:    t.category   ?? "crypto",
    emoji:       t.emoji      ?? undefined,
    side:        t.side,
    lotSize:     t.lotSize,
    entryPrice:  t.entryPrice,
    exitPrice:   t.exitPrice  ?? 0,
    sl:          t.sl         ?? null,
    tp:          t.tp         ?? null,
    grossPnl:    t.grossPnl   ?? 0,
    commission:  t.commission ?? 0,
    netPnl:      t.netPnl     ?? 0,
    closeReason: t.closeReason,
    result:      t.result,
    openedAt:    typeof t.openedAt  === "string" ? t.openedAt  : new Date(t.openedAt).toISOString(),
    closedAt:    typeof t.closedAt  === "string" ? t.closedAt  : new Date(t.closedAt).toISOString(),
    durationMs:  t.durationMs ?? 0,
    session:     t.session    ?? undefined,
    strategy:    t.strategy   ?? undefined,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useTradeStore = create<TradeStore>()((set, get) => ({
  positions:    [],
  closedTrades: [],
  balance:      PAPER_INITIAL_BALANCE,
  equity:       PAPER_INITIAL_BALANCE,
  floatingPnl:  0,

  isLoading:     false,
  isSyncing:     false,
  isInitialized: false,
  error:         null,

  // ── Lifecycle ──────────────────────────────────────────────────────────

  init: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      // Fetch in parallel
      const [openRes, closedRes, accountRes] = await Promise.all([
        api.get<any[]>("/trade"),
        api.get<{ items: any[] }>("/trade/closed?pageSize=200"),
        api.get<any>("/trade/account"),
      ]);

      const positions    = openRes.success   ? (openRes.data   ?? []).map(mapApiTrade)  : [];
      const closedTrades = closedRes.success  ? (closedRes.data?.items ?? []).map(mapApiClosed) : [];
      const balance      = accountRes.success ? (accountRes.data?.balance ?? PAPER_INITIAL_BALANCE) : PAPER_INITIAL_BALANCE;

      const totalFloating = positions.reduce((sum, p) => sum + p.floatingPnl, 0);

      set({
        positions,
        closedTrades,
        balance,
        floatingPnl: totalFloating,
        equity:      balance + totalFloating,
        isLoading:   false,
        isInitialized: true,
        error: null,
      });
    } catch (err) {
      console.error("[tradeStore.init]", err);
      set({ isLoading: false, error: "Failed to load trading data", isInitialized: true });
    }
  },

  reset: () => {
    set({
      positions:     [],
      closedTrades:  [],
      balance:       PAPER_INITIAL_BALANCE,
      equity:        PAPER_INITIAL_BALANCE,
      floatingPnl:   0,
      isLoading:     false,
      isSyncing:     false,
      isInitialized: false,
      error:         null,
    });
  },

  // ── Open a position ────────────────────────────────────────────────────

  openPosition: async (input) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await api.post<any>("/trade", {
        symbol:        input.symbol,
        displayName:   input.displayName,
        category:      input.category,
        emoji:         input.emoji,
        side:          input.side,
        lotSize:       input.lotSize,
        entryPrice:    input.entryPrice,
        sl:            input.sl ?? null,
        tp:            input.tp ?? null,
        marginUsed:    input.marginUsed,
        notionalValue: input.notionalValue,
        leverage:      input.leverage,
      });

      if (!res.success) {
        set({ isSyncing: false, error: res.error });
        return null;
      }

      const newPosition = mapApiTrade(res.data);
      set((state) => ({
        positions: [newPosition, ...state.positions],
        isSyncing: false,
      }));
      return newPosition;
    } catch (err) {
      console.error("[tradeStore.openPosition]", err);
      set({ isSyncing: false, error: "Failed to open position" });
      return null;
    }
  },

  // ── Close a position ────────────────────────────────────────────────────

  closePosition: async (id, input) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await api.post<{ trade: any; journalEntry: any; newBalance: number }>(
        `/trade/${id}/close`,
        {
          exitPrice:   input.exitPrice,
          closeReason: input.closeReason,
          grossPnl:    input.grossPnl,
          durationMs:  input.durationMs,
        }
      );

      if (!res.success) {
        set({ isSyncing: false, error: res.error });
        return null;
      }

      const closedTrade = mapApiClosed(res.data.trade);
      const newBalance  = res.data.newBalance ?? get().balance;

      set((state) => {
        const remaining   = state.positions.filter(p => p.id !== id);
        const totalFloat  = remaining.reduce((s, p) => s + p.floatingPnl, 0);
        return {
          positions:    remaining,
          closedTrades: [closedTrade, ...state.closedTrades],
          balance:      newBalance,
          floatingPnl:  totalFloat,
          equity:       newBalance + totalFloat,
          isSyncing:    false,
          error:        null,
        };
      });

      return closedTrade;
    } catch (err) {
      console.error("[tradeStore.closePosition]", err);
      set({ isSyncing: false, error: "Failed to close position" });
      return null;
    }
  },

  // ── Update SL/TP ───────────────────────────────────────────────────────

  updateSLTP: async (id, sl, tp) => {
    // Optimistic update
    set((state) => ({
      positions: state.positions.map(p =>
        p.id === id ? { ...p, sl, tp } : p
      ),
    }));

    try {
      const res = await api.put<any>(`/trade/${id}/sltp`, { sl, tp });
      if (!res.success) {
        // Revert optimistic update on failure
        console.error("[tradeStore.updateSLTP]", res.error);
      }
    } catch (err) {
      console.error("[tradeStore.updateSLTP]", err);
    }
  },

  // ── Delete open position ───────────────────────────────────────────────

  deletePosition: async (id) => {
    set({ isSyncing: true, error: null });

    // Optimistic removal
    const prev = get().positions;
    set((state) => ({
      positions: state.positions.filter(p => p.id !== id),
    }));

    try {
      const res = await api.delete<null>(`/trade/${id}`);
      if (!res.success) {
        // Revert
        set({ positions: prev, isSyncing: false, error: res.error });
        return;
      }
      set({ isSyncing: false });
    } catch (err) {
      set({ positions: prev, isSyncing: false, error: "Failed to delete position" });
      console.error("[tradeStore.deletePosition]", err);
    }
  },

  // ── Local only — called by live price feed ─────────────────────────────

  updatePrices: (prices: Record<string, number>) => {
    const { positions, balance } = get();
    if (positions.length === 0) return;

    let totalFloat = 0;
    const updatedPositions = positions.map(pos => {
      const currentPrice = prices[pos.symbol] ?? pos.currentPrice;
      const floatingPnl  = computePositionPnl(pos.side, pos.entryPrice, currentPrice, pos.lotSize);
      totalFloat += floatingPnl;
      return { ...pos, currentPrice, floatingPnl };
    });

    set({
      positions:   updatedPositions,
      floatingPnl: totalFloat,
      equity:      balance + totalFloat,
    });
  },
}));

// ── Auto-init on auth state change ────────────────────────────────────────
// Subscribe to the auth store; initialize when user logs in, reset on logout.

if (typeof window !== "undefined") {
  useAuthStore.subscribe(
    (state) => state.user?.id,
    (userId) => {
      if (userId) {
        useTradeStore.getState().init();
      } else {
        useTradeStore.getState().reset();
      }
    }
  );
}