import { create } from "zustand";

export interface Position {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  entryPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  pnl: number;
  openTime: Date;
}

interface TradeStore {
  positions: Position[];
  balance: number;
  totalPnl: number;
  openPosition: (position: Omit<Position, "id" | "pnl" | "openTime">) => void;
  closePosition: (id: string) => void;
  updatePrices: (symbol: string, price: number) => void;
  updateSlTp: (id: string, sl: number, tp: number) => void;
}

export const useTradeStore = create<TradeStore>((set, get) => ({
  positions: [],
  balance: 10000,
  totalPnl: 0,

  openPosition: (position) => {
    const newPosition: Position = {
      ...position,
      id: Date.now().toString(),
      pnl: 0,
      openTime: new Date(),
    };
    set((state) => ({ positions: [...state.positions, newPosition] }));
  },

  closePosition: (id) => {
    const pos = get().positions.find((p) => p.id === id);
    if (!pos) return;
    set((state) => ({
      positions: state.positions.filter((p) => p.id !== id),
      balance: state.balance + pos.pnl,
    }));
  },

  updateSlTp: (id: string, sl: number, tp: number) => {
    set((state) => ({
      positions: state.positions.map((p) =>
        p.id === id ? { ...p, sl, tp } : p
      ),
    }));
  },

  updatePrices: (symbol, price) => {
    set((state) => {
      const updated = state.positions.map((p) => {
        if (p.symbol !== symbol) return p;
        const diff = price - p.entryPrice;
        const pnl = p.direction === "BUY"
          ? diff * p.lots * 100
          : -diff * p.lots * 100;
        return { ...p, currentPrice: price, pnl: parseFloat(pnl.toFixed(2)) };
      });
      const totalPnl = updated.reduce((sum, p) => sum + p.pnl, 0);
      return { positions: updated, totalPnl: parseFloat(totalPnl.toFixed(2)) };
    });
  },
}));