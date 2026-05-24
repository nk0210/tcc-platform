import { create } from "zustand";

export interface Symbol {
  id: string;
  label: string;
  source: "binance" | "twelvedata";
  binanceSymbol?: string;
  contractSize: number;
  tickSize: number;
  category: "crypto" | "forex" | "commodity";
}

export const SYMBOLS: Symbol[] = [
  { id: "BTCUSDT", label: "BTC/USDT", source: "binance", binanceSymbol: "BTCUSDT", contractSize: 1, tickSize: 0.01, category: "crypto" },
  { id: "ETHUSDT", label: "ETH/USDT", source: "binance", binanceSymbol: "ETHUSDT", contractSize: 1, tickSize: 0.01, category: "crypto" },
  { id: "SOLUSDT", label: "SOL/USDT", source: "binance", binanceSymbol: "SOLUSDT", contractSize: 1, tickSize: 0.01, category: "crypto" },
  { id: "XRPUSDT", label: "XRP/USDT", source: "binance", binanceSymbol: "XRPUSDT", contractSize: 1, tickSize: 0.0001, category: "crypto" },
  { id: "BNBUSDT", label: "BNB/USDT", source: "binance", binanceSymbol: "BNBUSDT", contractSize: 1, tickSize: 0.01, category: "crypto" },
];

interface SymbolStore {
  activeSymbol: Symbol;
  setActiveSymbol: (symbol: Symbol) => void;
}

export const useSymbolStore = create<SymbolStore>((set) => ({
  activeSymbol: SYMBOLS[0],
  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
}));