import { create } from "zustand";

interface PriceStore {
  currentPrice: number;
  change: number;
  changePct: number;
  setPrice: (price: number, change: number, changePct: number) => void;
  // kept for compatibility - no longer used for chart
  candles: any[];
  setCandles: (candles: any[]) => void;
  addCandle: (candle: any) => void;
}

export const usePriceStore = create<PriceStore>((set) => ({
  currentPrice: 0,
  change: 0,
  changePct: 0,
  candles: [],
  setPrice: (price, change, changePct) => set({ currentPrice: price, change, changePct }),
  setCandles: (candles) => set({ candles }),
  addCandle: (candle) => set((state) => ({ candles: [...state.candles.slice(-199), candle] })),
}));