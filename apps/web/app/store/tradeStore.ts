import { create } from "zustand";
import { useJournalStore } from "./journalStore";

export interface Position {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  contractSize: number;
  entryPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  leverage: number;
  spreadCost: number;
  commission: number;
  grossPnl: number;
  netPnl: number;
  positionValue: number;
  requiredMargin: number;
  rrRatio: number | null;
  breakeven: number;
  openTime: Date;
}

interface TradeStore {
  positions: Position[];
  balance: number;
  equity: number;
  freeMargin: number;
  marginLevel: number;
  totalNetPnl: number;
  leverage: number;
  openPosition: (params: {
    symbol: string;
    direction: "BUY" | "SELL";
    lots: number;
    entryPrice: number;
    sl: number;
    tp: number;
  }) => void;
  closePosition: (id: string) => void;
  updatePrices: (symbol: string, price: number) => void;
  updateSlTp: (id: string, sl: number, tp: number) => void;
  setLeverage: (leverage: number) => void;
}

const CONTRACT_SIZE = 1;
const SPREAD_PCT = 0.0001;
const COMMISSION_PCT = 0.0005;

function calcPosition(
  direction: "BUY" | "SELL",
  lots: number,
  entryPrice: number,
  currentPrice: number,
  sl: number,
  tp: number,
  leverage: number
) {
  const positionValue = lots * CONTRACT_SIZE * entryPrice;
  const requiredMargin = positionValue / leverage;
  const spreadCost = SPREAD_PCT * lots * CONTRACT_SIZE * entryPrice;
  const commission = COMMISSION_PCT * positionValue;

  const grossPnl = direction === "BUY"
    ? lots * CONTRACT_SIZE * (currentPrice - entryPrice)
    : lots * CONTRACT_SIZE * (entryPrice - currentPrice);

  const netPnl = parseFloat((grossPnl - spreadCost - commission).toFixed(2));

  const slDistance = direction === "BUY"
    ? entryPrice - sl
    : sl - entryPrice;
  const tpDistance = direction === "BUY"
    ? tp - entryPrice
    : entryPrice - tp;
  const rrRatio = sl > 0 && tp > 0 && slDistance > 0
    ? parseFloat((tpDistance / slDistance).toFixed(2))
    : null;

  const breakeven = direction === "BUY"
    ? entryPrice + (spreadCost + commission) / (lots * CONTRACT_SIZE)
    : entryPrice - (spreadCost + commission) / (lots * CONTRACT_SIZE);

  return {
    positionValue: parseFloat(positionValue.toFixed(2)),
    requiredMargin: parseFloat(requiredMargin.toFixed(2)),
    spreadCost: parseFloat(spreadCost.toFixed(2)),
    commission: parseFloat(commission.toFixed(2)),
    grossPnl: parseFloat(grossPnl.toFixed(2)),
    netPnl,
    rrRatio,
    breakeven: parseFloat(breakeven.toFixed(2)),
  };
}

function recalcAccount(positions: Position[], balance: number) {
  const totalNetPnl = parseFloat(positions.reduce((sum, p) => sum + p.netPnl, 0).toFixed(2));
  const equity = parseFloat((balance + totalNetPnl).toFixed(2));
  const totalMargin = positions.reduce((sum, p) => sum + p.requiredMargin, 0);
  const freeMargin = parseFloat((equity - totalMargin).toFixed(2));
  const marginLevel = totalMargin > 0
    ? parseFloat(((equity / totalMargin) * 100).toFixed(2))
    : 0;
  return { totalNetPnl, equity, freeMargin, marginLevel };
}

export const useTradeStore = create<TradeStore>((set, get) => ({
  positions: [],
  balance: 10000,
  equity: 10000,
  freeMargin: 10000,
  marginLevel: 0,
  totalNetPnl: 0,
  leverage: 10,

  openPosition: ({ symbol, direction, lots, entryPrice, sl, tp }) => {
    const { leverage, balance, positions } = get();
    const calc = calcPosition(direction, lots, entryPrice, entryPrice, sl, tp, leverage);
    const newPos: Position = {
      id: Date.now().toString(),
      symbol, direction, lots,
      contractSize: CONTRACT_SIZE,
      entryPrice, currentPrice: entryPrice,
      sl, tp, leverage,
      openTime: new Date(),
      ...calc,
    };
    const updated = [...positions, newPos];
    const account = recalcAccount(updated, balance);
    set({ positions: updated, ...account });
  },

  closePosition: (id) => {
    const { positions, balance } = get();
    const pos = positions.find(p => p.id === id);
    if (!pos) return;
    const updated = positions.filter(p => p.id !== id);
    const newBalance = parseFloat((balance + pos.netPnl).toFixed(2));
    const account = recalcAccount(updated, newBalance);
    set({ positions: updated, balance: newBalance, ...account });

    // Update journal entry with final P&L
    const { entries, updateEntry } = useJournalStore.getState();
    const journalEntry = entries.find(e => e.symbol === pos.symbol && !e.pnl);
    if (journalEntry) {
      updateEntry(journalEntry.id, {
        exitPrice: pos.currentPrice,
        pnl: pos.netPnl,
      });
    }
  },

  updatePrices: (symbol, price) => {
    const { positions, balance, leverage } = get();
    const updated = positions.map(p => {
      if (p.symbol !== symbol) return p;
      const calc = calcPosition(p.direction, p.lots, p.entryPrice, price, p.sl, p.tp, leverage);
      return { ...p, currentPrice: price, ...calc };
    });
    const account = recalcAccount(updated, balance);
    set({ positions: updated, ...account });
  },

  updateSlTp: (id, sl, tp) => {
    const { positions, balance, leverage } = get();
    const updated = positions.map(p => {
      if (p.id !== id) return p;
      const calc = calcPosition(p.direction, p.lots, p.entryPrice, p.currentPrice, sl, tp, leverage);
      return { ...p, sl, tp, ...calc };
    });
    const account = recalcAccount(updated, balance);
    set({ positions: updated, ...account });
  },

  setLeverage: (leverage) => set({ leverage }),
}));