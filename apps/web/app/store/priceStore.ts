import { create } from "zustand";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface PriceStore {
  symbol: string;
  currentPrice: number;
  change: number;
  changePct: number;
  candles: Candle[];
  setPrice: (price: number, change: number, changePct: number) => void;
  setCandles: (candles: Candle[]) => void;
  addCandle: (candle: Candle) => void;
}

export const usePriceStore = create<PriceStore>((set) => ({
  symbol: "XAUUSD",
  currentPrice: 0,
  change: 0,
  changePct: 0,
  candles: [],
  setPrice: (price, change, changePct) =>
    set({ currentPrice: price, change, changePct }),
  setCandles: (candles) => set({ candles }),
  addCandle: (candle) =>
    set((state) => ({
      candles: [...state.candles.slice(-199), candle],
    })),
}));