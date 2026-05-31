import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

export interface Position {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  entryPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  positionValue: number;
  requiredMargin: number;
  spreadCost: number;
  commission: number;
  grossPnl: number;
  netPnl: number;
  rrRatio: number;
  breakeven: number;
  openedAt: number; // timestamp ms for JSON serialization
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  entryPrice: number;
  exitPrice: number;
  sl: number;
  tp: number;
  grossPnl: number;
  netPnl: number;
  spreadCost: number;
  commission: number;
  rrRatio: number;
  openedAt: number;
  closedAt: number;
}

const CONTRACT_SIZE = 1;

function calcPosition(
  symbol: string,
  direction: "BUY" | "SELL",
  lots: number,
  entryPrice: number,
  currentPrice: number,
  sl: number,
  tp: number,
  leverage: number
): Omit<Position, "id" | "openedAt"> {
  const positionValue = lots * CONTRACT_SIZE * entryPrice;
  const requiredMargin = positionValue / leverage;
  const spreadCost = 0.0001 * lots * entryPrice;
  const commission = 0.0005 * positionValue;

  const grossPnl =
    direction === "BUY"
      ? lots * (currentPrice - entryPrice)
      : lots * (entryPrice - currentPrice);
  const netPnl = grossPnl - spreadCost - commission;

  const slDistance = Math.abs(entryPrice - sl);
  const tpDistance = Math.abs(tp - entryPrice);
  const rrRatio = slDistance > 0 && tpDistance > 0 ? tpDistance / slDistance : 0;

  const breakeven = direction === "BUY"
    ? entryPrice + (spreadCost + commission) / lots
    : entryPrice - (spreadCost + commission) / lots;

  return {
    symbol, direction, lots, entryPrice, currentPrice, sl, tp,
    positionValue, requiredMargin, spreadCost, commission,
    grossPnl, netPnl, rrRatio, breakeven,
  };
}

function recalcAccount(positions: Position[], balance: number) {
  const totalMargin = positions.reduce((sum, p) => sum + p.requiredMargin, 0);
  const totalNetPnl = positions.reduce((sum, p) => sum + p.netPnl, 0);
  const equity = balance + totalNetPnl;
  const freeMargin = equity - totalMargin;
  const marginLevel = totalMargin > 0 ? Math.round((equity / totalMargin) * 100) : 0;
  return { equity, freeMargin, marginLevel, totalNetPnl };
}

interface TradeStore {
  balance: number;
  equity: number;
  freeMargin: number;
  marginLevel: number;
  totalNetPnl: number;
  leverage: number;
  positions: Position[];
  closedTrades: ClosedTrade[];

  openPosition: (params: {
    symbol: string;
    direction: "BUY" | "SELL";
    lots: number;
    entryPrice: number;
    sl: number;
    tp: number;
  }) => void;
  closePosition: (id: string) => void;
  closeAllPositions: () => void;
  updatePrices: (symbol: string, price: number) => void;
  updateSLTP: (id: string, sl: number, tp: number) => void;
  setLeverage: (leverage: number) => void;
  resetAccount: () => void;
}

const INITIAL_BALANCE = 10000;

export const useTradeStore = create<TradeStore>()(
  persist(
    (set, get) => ({
      balance: INITIAL_BALANCE,
      equity: INITIAL_BALANCE,
      freeMargin: INITIAL_BALANCE,
      marginLevel: 0,
      totalNetPnl: 0,
      leverage: 10,
      positions: [],
      closedTrades: [],

      openPosition: ({ symbol, direction, lots, entryPrice, sl, tp }) => {
        const { positions, balance, leverage } = get();
        const calc = calcPosition(symbol, direction, lots, entryPrice, entryPrice, sl, tp, leverage);
        const newPos: Position = {
          ...calc,
          id: Date.now().toString(),
          openedAt: Date.now(),
        };
        const updated = [...positions, newPos];
        const account = recalcAccount(updated, balance);
        set({ positions: updated, ...account });
      },

      closePosition: (id) => {
        const { positions, balance, closedTrades } = get();
        const pos = positions.find(p => p.id === id);
        if (!pos) return;

        const closed: ClosedTrade = {
          id: pos.id,
          symbol: pos.symbol,
          direction: pos.direction,
          lots: pos.lots,
          entryPrice: pos.entryPrice,
          exitPrice: pos.currentPrice,
          sl: pos.sl,
          tp: pos.tp,
          grossPnl: pos.grossPnl,
          netPnl: pos.netPnl,
          spreadCost: pos.spreadCost,
          commission: pos.commission,
          rrRatio: pos.rrRatio,
          openedAt: pos.openedAt,
          closedAt: Date.now(),
        };

        const updated = positions.filter(p => p.id !== id);
        const newBalance = parseFloat((balance + pos.netPnl).toFixed(2));
        const account = recalcAccount(updated, newBalance);

        set({
          positions: updated,
          balance: newBalance,
          closedTrades: [closed, ...closedTrades],
          ...account,
        });

        // Update journal entry with exit data
        try {
          import("@/store/journalStore").then(({ useJournalStore }) => {
            const { entries, updateEntry } = useJournalStore.getState();
            const journalEntry = entries.find(
              e => e.symbol === pos.symbol && e.pnl === undefined
            );
            if (journalEntry) {
              updateEntry(journalEntry.id, {
                exitPrice: pos.currentPrice,
                pnl: pos.netPnl,
              });
            }
          });
        } catch {}
      },

      closeAllPositions: () => {
        const { positions } = get();
        positions.forEach(p => get().closePosition(p.id));
      },

      updatePrices: (symbol, price) => {
        const { positions, balance, leverage } = get();
        const updated = positions.map(p => {
          if (p.symbol !== symbol) return p;
          const calc = calcPosition(
            p.symbol, p.direction, p.lots,
            p.entryPrice, price, p.sl, p.tp, leverage
          );
          return { ...p, ...calc, currentPrice: price };
        });
        const account = recalcAccount(updated, balance);
        set({ positions: updated, ...account });
      },

      updateSLTP: (id, sl, tp) => {
        const { positions, balance, leverage } = get();
        const updated = positions.map(p => {
          if (p.id !== id) return p;
          const calc = calcPosition(
            p.symbol, p.direction, p.lots,
            p.entryPrice, p.currentPrice, sl, tp, leverage
          );
          return { ...p, ...calc, sl, tp };
        });
        const account = recalcAccount(updated, balance);
        set({ positions: updated, ...account });
      },

      setLeverage: (leverage) => {
        const { positions, balance } = get();
        const updated = positions.map(p => ({
          ...p,
          requiredMargin: (p.lots * CONTRACT_SIZE * p.entryPrice) / leverage,
        }));
        const account = recalcAccount(updated, balance);
        set({ leverage, positions: updated, ...account });
      },

      resetAccount: () => {
        set({
          balance: INITIAL_BALANCE,
          equity: INITIAL_BALANCE,
          freeMargin: INITIAL_BALANCE,
          marginLevel: 0,
          totalNetPnl: 0,
          positions: [],
          closedTrades: [],
        });
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
        // Recalculate account after restore
        if (state && state.positions) {
          const account = recalcAccount(state.positions, state.balance);
          Object.assign(state, account);
        }
      },
    }
  )
);