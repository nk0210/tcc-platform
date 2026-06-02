/**
 * TCC Paper Trade Store
 *
 * Manages paper positions, closed trades, and account metrics.
 * PAPER MODE ONLY — not broker-accurate.
 * This update adds sl/tp to ClosedTrade for analytics.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";
import { SymbolCategory } from "@/lib/markets/symbols";
import {
  calcMargin, calcNotional, calcGrossPnl, calcNetPnl,
  recalcAccount, isStopLossTriggered, isTakeProfitTriggered,
} from "@/lib/trading/calculations";

// ── Models ───────────────────────────────────────────────────────────────

export interface PaperPosition {
  id: string;
  mode: "paper";
  symbol: string;
  displayName: string;
  category: SymbolCategory;
  side: "BUY" | "SELL";
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  sl: number | null;
  tp: number | null;
  grossPnl: number;
  netPnl: number;
  marginUsed: number;
  notionalValue: number;
  openedAt: string;
}

export interface ClosedTrade {
  id: string;
  positionId: string;
  symbol: string;
  displayName: string;
  category: SymbolCategory;
  side: "BUY" | "SELL";
  lotSize: number;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  netPnl: number;
  marginUsed: number;
  notionalValue: number;
  openedAt: string;
  closedAt: string;
  durationMs: number;
  closeReason: "manual" | "stop_loss" | "take_profit";
  /** SL that was set when trade was open (null if not set) */
  sl: number | null;
  /** TP that was set when trade was open (null if not set) */
  tp: number | null;
}

export interface TradeEvent {
  id: string;
  type:
    | "position_opened"
    | "position_closed_manual"
    | "position_closed_sl"
    | "position_closed_tp"
    | "trade_rejected";
  position?: PaperPosition;
  closedTrade?: ClosedTrade;
  message?: string;
  timestamp: number;
}

// ── Constants ────────────────────────────────────────────────────────────

const INITIAL_BALANCE = 10000;

// ── Store ────────────────────────────────────────────────────────────────

interface TradeStore {
  balance: number;
  equity: number;
  freeMargin: number;
  marginUsed: number;
  marginLevel: number;
  floatingPnl: number;
  leverage: number;
  positions: PaperPosition[];
  closedTrades: ClosedTrade[];
  events: TradeEvent[];
  totalNetPnl: number; // legacy compat

  openPosition: (params: {
    symbol: string;
    displayName: string;
    category: SymbolCategory;
    side: "BUY" | "SELL";
    lotSize: number;
    entryPrice: number;
    sl: number | null;
    tp: number | null;
  }) => PaperPosition;

  closePosition: (positionId: string, reason?: "manual" | "stop_loss" | "take_profit") => ClosedTrade | null;
  closeAllPositions: () => void;
  updatePrices: (symbol: string, price: number) => void;
  updateSLTP: (positionId: string, sl: number | null, tp: number | null) => void;
  setLeverage: (leverage: number) => void;
  resetAccount: () => void;
  consumeEvents: () => TradeEvent[];
}

// ── Implementation ───────────────────────────────────────────────────────

export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      balance: INITIAL_BALANCE,
      equity: INITIAL_BALANCE,
      freeMargin: INITIAL_BALANCE,
      marginUsed: 0,
      marginLevel: 0,
      floatingPnl: 0,
      leverage: 10,
      positions: [],
      closedTrades: [],
      events: [],
      totalNetPnl: 0,

      openPosition: ({ symbol, displayName, category, side, lotSize, entryPrice, sl, tp }) => {
        const { balance, leverage, positions, events } = get();
        const marginUsed = calcMargin(symbol, lotSize, entryPrice, leverage);
        const notionalValue = calcNotional(symbol, lotSize, entryPrice);

        const newPos: PaperPosition = {
          id: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          mode: "paper",
          symbol, displayName, category, side, lotSize,
          entryPrice, currentPrice: entryPrice,
          sl: sl && sl > 0 ? sl : null,
          tp: tp && tp > 0 ? tp : null,
          grossPnl: 0, netPnl: 0,
          marginUsed, notionalValue,
          openedAt: new Date().toISOString(),
        };

        const updatedPositions = [...positions, newPos];
        const account = recalcAccount(updatedPositions, balance);
        const event: TradeEvent = {
          id: `evt_${Date.now()}`,
          type: "position_opened",
          position: newPos,
          timestamp: Date.now(),
        };

        set({
          positions: updatedPositions,
          ...account,
          totalNetPnl: account.floatingPnl,
          events: [...events, event],
        });

        return newPos;
      },

      closePosition: (positionId, reason = "manual") => {
        const { positions, balance, closedTrades, events } = get();
        const pos = positions.find(p => p.id === positionId);
        if (!pos) return null;

        const exitPrice = pos.currentPrice;
        const grossPnl = calcGrossPnl(pos.symbol, pos.side, pos.lotSize, pos.entryPrice, exitPrice);
        const netPnl = calcNetPnl(pos.symbol, pos.side, pos.lotSize, pos.entryPrice, exitPrice);

        const closed: ClosedTrade = {
          id: `closed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          positionId: pos.id,
          symbol: pos.symbol,
          displayName: pos.displayName,
          category: pos.category,
          side: pos.side,
          lotSize: pos.lotSize,
          entryPrice: pos.entryPrice,
          exitPrice,
          grossPnl: parseFloat(grossPnl.toFixed(4)),
          netPnl: parseFloat(netPnl.toFixed(4)),
          marginUsed: pos.marginUsed,
          notionalValue: pos.notionalValue,
          openedAt: pos.openedAt,
          closedAt: new Date().toISOString(),
          durationMs: Date.now() - new Date(pos.openedAt).getTime(),
          closeReason: reason,
          sl: pos.sl,   // ← copy SL from position
          tp: pos.tp,   // ← copy TP from position
        };

        const newBalance = parseFloat((balance + netPnl).toFixed(4));
        const updatedPositions = positions.filter(p => p.id !== positionId);
        const account = recalcAccount(updatedPositions, newBalance);

        const eventType: TradeEvent["type"] =
          reason === "stop_loss" ? "position_closed_sl"
          : reason === "take_profit" ? "position_closed_tp"
          : "position_closed_manual";

        const event: TradeEvent = {
          id: `evt_${Date.now()}`,
          type: eventType,
          closedTrade: closed,
          timestamp: Date.now(),
        };

        set({
          balance: newBalance,
          positions: updatedPositions,
          closedTrades: [closed, ...closedTrades],
          ...account,
          totalNetPnl: account.floatingPnl,
          events: [...events, event],
        });

        return closed;
      },

      closeAllPositions: () => {
        const posIds = get().positions.map(p => p.id);
        posIds.forEach(id => get().closePosition(id, "manual"));
      },

      updatePrices: (symbol, price) => {
        if (!price || price <= 0) return;
        const { positions, balance } = get();
        const slTpToClose: Array<{ id: string; reason: "stop_loss" | "take_profit" }> = [];

        const updatedPositions = positions.map(p => {
          if (p.symbol !== symbol) return p;
          if (isStopLossTriggered(p.side, price, p.sl)) {
            slTpToClose.push({ id: p.id, reason: "stop_loss" });
            return { ...p, currentPrice: price };
          }
          if (isTakeProfitTriggered(p.side, price, p.tp)) {
            slTpToClose.push({ id: p.id, reason: "take_profit" });
            return { ...p, currentPrice: price };
          }
          const gross = calcGrossPnl(p.symbol, p.side, p.lotSize, p.entryPrice, price);
          const net = calcNetPnl(p.symbol, p.side, p.lotSize, p.entryPrice, price);
          return {
            ...p,
            currentPrice: price,
            grossPnl: parseFloat(gross.toFixed(4)),
            netPnl: parseFloat(net.toFixed(4)),
          };
        });

        const account = recalcAccount(updatedPositions, balance);
        set({ positions: updatedPositions, ...account, totalNetPnl: account.floatingPnl });

        slTpToClose.forEach(({ id, reason }) => get().closePosition(id, reason));
      },

      updateSLTP: (positionId, sl, tp) => {
        set(state => ({
          positions: state.positions.map(p =>
            p.id !== positionId ? p : {
              ...p,
              sl: sl && sl > 0 ? sl : null,
              tp: tp && tp > 0 ? tp : null,
            }
          ),
        }));
      },

      setLeverage: (leverage) => {
        const { positions, balance } = get();
        const updated = positions.map(p => ({
          ...p,
          marginUsed: calcMargin(p.symbol, p.lotSize, p.entryPrice, leverage),
        }));
        const account = recalcAccount(updated, balance);
        set({ leverage, positions: updated, ...account, totalNetPnl: account.floatingPnl });
      },

      resetAccount: () => {
        set({
          balance: INITIAL_BALANCE,
          equity: INITIAL_BALANCE,
          freeMargin: INITIAL_BALANCE,
          marginUsed: 0, marginLevel: 0, floatingPnl: 0,
          positions: [], closedTrades: [], events: [], totalNetPnl: 0,
        });
      },

      consumeEvents: () => {
        const { events } = get();
        set({ events: [] });
        return events;
      },
    }),
    {
      name: "trading",
      storage: createJSONStorage(() => getUserScopedStorage("trading")),
      partialize: (state) => ({
        balance: state.balance,
        leverage: state.leverage,
        positions: state.positions,
        closedTrades: state.closedTrades,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.positions) {
          const account = recalcAccount(state.positions, state.balance);
          Object.assign(state, account);
          state.totalNetPnl = account.floatingPnl;
          state.events = [];
        }
      },
    }
  )
);