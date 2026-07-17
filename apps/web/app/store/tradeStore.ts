/**
 * TCC Trade Store — Phase Alpha
 * API-backed. Positions loaded from PostgreSQL on init.
 * updatePrices() is LOCAL ONLY — driven by live price WebSocket.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";

// ── Constants ─────────────────────────────────────────────────────────────

export const PAPER_INITIAL_BALANCE = 10_000;
export const COMMISSION_RATE       = 0.0001;

// ── Types ─────────────────────────────────────────────────────────────────

export type TradeSide   = "BUY" | "SELL";
export type CloseReason = "MANUAL" | "STOP_LOSS" | "TAKE_PROFIT";
export type TradeResult = "WIN" | "LOSS" | "BREAKEVEN";

export interface Position {
  id:            string;
  symbol:        string;
  displayName:   string;
  category:      string;
  emoji?:        string;
  side:          TradeSide;
  lotSize:       number;
  entryPrice:    number;
  currentPrice:  number;
  sl:            number | null;
  tp:            number | null;
  marginUsed:    number;
  notionalValue: number;
  leverage:      number;
  floatingPnl:   number;
  openedAt:      string;
}

export interface ClosedTrade {
  id:          string;
  symbol:      string;
  displayName: string;
  category:    string;
  emoji?:      string;
  side:        TradeSide;
  lotSize:     number;
  entryPrice:  number;
  exitPrice:   number;
  sl:          number | null;
  tp:          number | null;
  grossPnl:    number;
  commission:  number;
  netPnl:      number;
  closeReason: CloseReason;
  result:      TradeResult;
  openedAt:    string;
  closedAt:    string;
  durationMs:  number;
  session?:    string;
  strategy?:   string;
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
  grossPnl:    number;
  durationMs:  number;
}

interface TradeStore {
  positions:    Position[];
  closedTrades: ClosedTrade[];
  balance:      number;
  equity:       number;
  floatingPnl:  number;

  isLoading:     boolean;
  isSyncing:     boolean;
  isInitialized: boolean;
  error:         string | null;

  init:          () => Promise<void>;
  reset:         () => void;
  openPosition:  (input: OpenPositionInput)              => Promise<Position | null>;
  closePosition: (id: string, input: ClosePositionInput) => Promise<ClosedTrade | null>;
  updateSLTP:    (id: string, sl: number | null, tp: number | null) => Promise<void>;
  deletePosition: (id: string)                           => Promise<void>;
  updatePrices:  (prices: Record<string, number>)        => void;
}

// ── PnL helper ────────────────────────────────────────────────────────────

function calcPnl(side: TradeSide, entry: number, current: number, lots: number): number {
  return side === "BUY"
    ? (current - entry) * lots
    : (entry - current) * lots;
}

// ── Mappers ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPosition(t: any): Position {
  const current = t.currentPrice ?? t.entryPrice;
  return {
    id:            t.id,
    symbol:        t.symbol,
    displayName:   t.displayName,
    category:      t.category   ?? "crypto",
    emoji:         t.emoji      ?? undefined,
    side:          t.side,
    lotSize:       t.lotSize,
    entryPrice:    t.entryPrice,
    currentPrice:  current,
    sl:            t.sl         ?? null,
    tp:            t.tp         ?? null,
    marginUsed:    t.marginUsed    ?? 0,
    notionalValue: t.notionalValue ?? 0,
    leverage:      t.leverage      ?? 10,
    floatingPnl:   calcPnl(t.side, t.entryPrice, current, t.lotSize),
    openedAt:      typeof t.openedAt === "string" ? t.openedAt : new Date(t.openedAt).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClosed(t: any): ClosedTrade {
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
    openedAt:  typeof t.openedAt === "string" ? t.openedAt  : new Date(t.openedAt).toISOString(),
    closedAt:  typeof t.closedAt === "string" ? t.closedAt  : new Date(t.closedAt).toISOString(),
    durationMs: t.durationMs ?? 0,
    session:   t.session     ?? undefined,
    strategy:  t.strategy    ?? undefined,
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

  // ── Init ──────────────────────────────────────────────────────────────

  init: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      const [openRes, closedRes, accountRes] = await Promise.all([
        api.get<any[]>("/trade"),
        api.get<{ items: any[] }>("/trade/closed?pageSize=200"),
        api.get<any>("/trade/account"),
      ]);

      const positions    = openRes.success   ? (openRes.data ?? []).map(toPosition)          : [];
      const closedTrades = closedRes.success  ? (closedRes.data?.items ?? []).map(toClosed)  : [];
      const balance      = accountRes.success
        ? (accountRes.data?.balance ?? PAPER_INITIAL_BALANCE)
        : PAPER_INITIAL_BALANCE;

      const totalFloat = positions.reduce((s, p) => s + p.floatingPnl, 0);

      set({
        positions,
        closedTrades,
        balance,
        floatingPnl:   totalFloat,
        equity:        balance + totalFloat,
        isLoading:     false,
        isInitialized: true,
        error:         null,
      });
    } catch (err) {
      console.error("[tradeStore.init]", err);
      set({ isLoading: false, error: "Failed to load trading data", isInitialized: true });
    }
  },

  reset: () =>
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
    }),

  // ── Open position ─────────────────────────────────────────────────────

  openPosition: async (input) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await api.post<any>("/trade", input);
      if (!res.success) { set({ isSyncing: false, error: res.error }); return null; }

      const pos = toPosition(res.data);
      set((s) => ({ positions: [pos, ...s.positions], isSyncing: false }));
      return pos;
    } catch (err) {
      console.error("[tradeStore.openPosition]", err);
      set({ isSyncing: false, error: "Failed to open position" });
      return null;
    }
  },

  // ── Close position ────────────────────────────────────────────────────

  closePosition: async (id, input) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await api.post<{ trade: any; journalEntry: any; newBalance: number }>(
        `/trade/${id}/close`,
        input
      );
      if (!res.success) { set({ isSyncing: false, error: res.error }); return null; }

      const closed     = toClosed(res.data.trade);
      const newBalance = res.data.newBalance ?? get().balance;

      set((s) => {
        const remaining  = s.positions.filter((p) => p.id !== id);
        const totalFloat = remaining.reduce((acc, p) => acc + p.floatingPnl, 0);
        return {
          positions:    remaining,
          closedTrades: [closed, ...s.closedTrades],
          balance:      newBalance,
          floatingPnl:  totalFloat,
          equity:       newBalance + totalFloat,
          isSyncing:    false,
          error:        null,
        };
      });

      return closed;
    } catch (err) {
      console.error("[tradeStore.closePosition]", err);
      set({ isSyncing: false, error: "Failed to close position" });
      return null;
    }
  },

  // ── Update SL/TP ──────────────────────────────────────────────────────

  updateSLTP: async (id, sl, tp) => {
    // Optimistic
    set((s) => ({
      positions: s.positions.map((p) => (p.id === id ? { ...p, sl, tp } : p)),
    }));
    try {
      const res = await api.put<any>(`/trade/${id}/sltp`, { sl, tp });
      if (!res.success) console.error("[tradeStore.updateSLTP]", res.error);
    } catch (err) {
      console.error("[tradeStore.updateSLTP]", err);
    }
  },

  // ── Delete open position ──────────────────────────────────────────────

  deletePosition: async (id) => {
    const prev = get().positions;
    set((s) => ({ positions: s.positions.filter((p) => p.id !== id), isSyncing: true }));
    try {
      const res = await api.delete<null>(`/trade/${id}`);
      if (!res.success) { set({ positions: prev, isSyncing: false, error: res.error }); return; }
      set({ isSyncing: false });
    } catch (err) {
      set({ positions: prev, isSyncing: false, error: "Failed to delete position" });
      console.error("[tradeStore.deletePosition]", err);
    }
  },

  // ── Live price update (local only) ────────────────────────────────────

  updatePrices: (prices) => {
    const { positions, balance } = get();
    if (positions.length === 0) return;

    let totalFloat = 0;
    const updated = positions.map((p) => {
      const cur = prices[p.symbol] ?? p.currentPrice;
      const pnl = calcPnl(p.side, p.entryPrice, cur, p.lotSize);
      totalFloat += pnl;
      return { ...p, currentPrice: cur, floatingPnl: pnl };
    });

    set({ positions: updated, floatingPnl: totalFloat, equity: balance + totalFloat });
  },
}));

// ── Auto-init / reset tied to auth user change ────────────────────────────
// Single-argument subscribe — compatible with all Zustand versions.

if (typeof window !== "undefined") {
  // Lazy import to avoid circular dependency on module load
  import("@/store/authStore").then(({ useAuthStore }) => {
    let prevUserId: string | undefined;

    useAuthStore.subscribe((state) => {
      const userId = state.user?.id;
      if (userId !== prevUserId) {
        prevUserId = userId;
        if (userId) {
          useTradeStore.getState().init();
        } else {
          useTradeStore.getState().reset();
        }
      }
    });
  });
}