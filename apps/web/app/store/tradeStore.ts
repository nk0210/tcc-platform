/**
 * TCC Trade Store — Phase Alpha
 * API-backed. Positions loaded from PostgreSQL on init.
 * updatePrices() is LOCAL ONLY — driven by live price WebSocket.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";
import { useJournalStore } from "@/store/journalStore";
import { calcGrossPnl, calcNetPnl, recalcAccount } from "@/lib/trading/calculations";

// ── Constants ─────────────────────────────────────────────────────────────

export const PAPER_INITIAL_BALANCE = 10_000;
export const COMMISSION_RATE       = 0.0001;
export const DEFAULT_LEVERAGE      = 10;
const MAX_EVENTS = 50;

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

/** @deprecated kept as an alias — the type was renamed to `Position`. */
export type PaperPosition = Position;

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

// ── Trade event log (local, in-memory) ─────────────────────────────────────
// Drives useSystemNotifications — a generic bridge from trade actions to
// notifications/journal, regardless of which component triggered them.

export type TradeEventType =
  | "position_opened"
  | "position_closed_manual"
  | "position_closed_sl"
  | "position_closed_tp";

export interface TradeEvent {
  id:          string;
  type:        TradeEventType;
  position?:   Position;
  closedTrade?: ClosedTrade;
  timestamp:   number;
}

function closeReasonToEventType(reason: CloseReason): TradeEventType {
  if (reason === "STOP_LOSS") return "position_closed_sl";
  if (reason === "TAKE_PROFIT") return "position_closed_tp";
  return "position_closed_manual";
}

function makeEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface TradeStore {
  positions:    Position[];
  closedTrades: ClosedTrade[];
  balance:      number;
  equity:       number;
  floatingPnl:  number;
  freeMargin:   number;
  marginUsed:   number;
  marginLevel:  number;
  leverage:     number;
  events:       TradeEvent[];

  isLoading:     boolean;
  isSyncing:     boolean;
  isInitialized: boolean;
  error:         string | null;

  init:          () => Promise<void>;
  reset:         () => void;
  setLeverage:   (leverage: number) => void;
  openPosition:  (input: OpenPositionInput)              => Promise<Position | null>;
  closePosition: (id: string, input: ClosePositionInput) => Promise<ClosedTrade | null>;
  closePositionAtMarket: (id: string, closeReason: CloseReason) => Promise<ClosedTrade | null>;
  closeAllPositions: () => Promise<void>;
  updateSLTP:    (id: string, sl: number | null, tp: number | null) => Promise<void>;
  deletePosition: (id: string)                           => Promise<void>;
  updatePrices:  (symbol: string, price: number)          => void;
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
    leverage:      t.leverage      ?? DEFAULT_LEVERAGE,
    floatingPnl:   calcNetPnl(t.symbol, t.side, t.lotSize, t.entryPrice, current),
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
  freeMargin:   PAPER_INITIAL_BALANCE,
  marginUsed:   0,
  marginLevel:  0,
  leverage:     DEFAULT_LEVERAGE,
  events:       [],

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

      const metrics = recalcAccount(positions, balance);

      set({
        positions,
        closedTrades,
        balance,
        ...metrics,
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
      freeMargin:    PAPER_INITIAL_BALANCE,
      marginUsed:    0,
      marginLevel:   0,
      leverage:      DEFAULT_LEVERAGE,
      events:        [],
      isLoading:     false,
      isSyncing:     false,
      isInitialized: false,
      error:         null,
    }),

  // ── Leverage preference (used as the default for new positions) ───────

  setLeverage: (leverage) => set({ leverage }),

  // ── Open position ─────────────────────────────────────────────────────

  openPosition: async (input) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await api.post<any>("/trade", input);
      if (!res.success) { set({ isSyncing: false, error: res.error }); return null; }

      const pos = toPosition(res.data);
      const event: TradeEvent = { id: makeEventId(), type: "position_opened", position: pos, timestamp: Date.now() };

      set((s) => {
        const positions = [pos, ...s.positions];
        return {
          positions,
          ...recalcAccount(positions, s.balance),
          events:    [...s.events, event].slice(-MAX_EVENTS),
          isSyncing: false,
        };
      });
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
      const event: TradeEvent = {
        id:        makeEventId(),
        type:      closeReasonToEventType(closed.closeReason),
        closedTrade: closed,
        timestamp: Date.now(),
      };

      set((s) => {
        const remaining = s.positions.filter((p) => p.id !== id);
        return {
          positions:    remaining,
          closedTrades: [closed, ...s.closedTrades],
          balance:      newBalance,
          ...recalcAccount(remaining, newBalance),
          events:    [...s.events, event].slice(-MAX_EVENTS),
          isSyncing: false,
          error:     null,
        };
      });

      // Backend auto-creates a journal entry on close — surface it immediately
      // instead of waiting for the journal page to refetch.
      if (res.data.journalEntry) {
        useJournalStore.getState().addEntryFromClosedTrade(res.data.journalEntry);
      }

      return closed;
    } catch (err) {
      console.error("[tradeStore.closePosition]", err);
      set({ isSyncing: false, error: "Failed to close position" });
      return null;
    }
  },

  // ── Close a single position at its current market price ───────────────

  closePositionAtMarket: async (id, closeReason) => {
    const pos = get().positions.find((p) => p.id === id);
    if (!pos) return null;

    const grossPnl   = calcGrossPnl(pos.symbol, pos.side, pos.lotSize, pos.entryPrice, pos.currentPrice);
    const durationMs = Date.now() - new Date(pos.openedAt).getTime();

    return get().closePosition(id, {
      exitPrice: pos.currentPrice,
      closeReason,
      grossPnl,
      durationMs,
    });
  },

  // ── Close every open position at market ────────────────────────────────

  closeAllPositions: async () => {
    const ids = get().positions.map((p) => p.id);
    for (const id of ids) {
      await get().closePositionAtMarket(id, "MANUAL");
    }
  },

  // ── Update SL/TP ──────────────────────────────────────────────────────

  updateSLTP: async (id, sl, tp) => {
    // Optimistic, snapshotted so a failed request can revert cleanly.
    const prev = get().positions;
    set((s) => ({
      positions: s.positions.map((p) => (p.id === id ? { ...p, sl, tp } : p)),
      error: null,
    }));
    try {
      const res = await api.put<any>(`/trade/${id}/sltp`, { sl, tp });
      if (!res.success) {
        console.error("[tradeStore.updateSLTP]", res.error);
        set({ positions: prev, error: res.error });
      }
    } catch (err) {
      console.error("[tradeStore.updateSLTP]", err);
      set({ positions: prev, error: "Failed to update SL/TP" });
    }
  },

  // ── Delete open position ──────────────────────────────────────────────

  deletePosition: async (id) => {
    const prev = get().positions;
    const next = prev.filter((p) => p.id !== id);
    set((s) => ({ positions: next, ...recalcAccount(next, s.balance), isSyncing: true, error: null }));
    try {
      const res = await api.delete<null>(`/trade/${id}`);
      if (!res.success) {
        set((s) => ({ positions: prev, ...recalcAccount(prev, s.balance), isSyncing: false, error: res.error }));
        return;
      }
      set({ isSyncing: false });
    } catch (err) {
      set((s) => ({ positions: prev, ...recalcAccount(prev, s.balance), isSyncing: false, error: "Failed to delete position" }));
      console.error("[tradeStore.deletePosition]", err);
    }
  },

  // ── Live price update (local only) ────────────────────────────────────

  updatePrices: (symbol, price) => {
    const { positions, balance } = get();
    if (positions.length === 0) return;

    let touched = false;
    const updated = positions.map((p) => {
      if (p.symbol !== symbol) return p;
      touched = true;
      const pnl = calcNetPnl(p.symbol, p.side, p.lotSize, p.entryPrice, price);
      return { ...p, currentPrice: price, floatingPnl: pnl };
    });

    if (!touched) return;
    set({ positions: updated, ...recalcAccount(updated, balance) });
  },
}));

// ── Auto-init / reset tied to auth user change ────────────────────────────
// Single-argument subscribe — compatible with all Zustand versions.

if (typeof window !== "undefined") {
  // Lazy import to avoid circular dependency on module load
  import("@/store/authStore").then(({ useAuthStore }) => {
    // Topbar imports this store directly, so this block usually runs before
    // login resolves and the subscribe callback catches the transition
    // normally. But subscribe() alone only fires on *future* changes, so if
    // the user was already logged in by the time this ran (e.g. HMR, or a
    // fast reload) it would silently never call init(). Seed prevUserId
    // from the current state and fire once up front to cover that case too.
    let prevUserId: string | undefined = useAuthStore.getState().user?.id;
    if (prevUserId) useTradeStore.getState().init();

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
