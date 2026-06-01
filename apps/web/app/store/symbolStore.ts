/**
 * TCC Symbol Store
 * Uses central symbol config from lib/markets/symbols.ts
 * This is the single source of truth for active chart symbol.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";
import { TCCSymbol, TCC_SYMBOLS, TCC_SYMBOL_MAP } from "@/lib/markets/symbols";

// Re-export central config under legacy names for backward compat
export type { TCCSymbol };
export type Symbol = TCCSymbol;
export { TCC_SYMBOLS as SYMBOLS, TCC_SYMBOL_MAP as SYMBOL_MAP };

interface SymbolStore {
  activeSymbol: TCCSymbol;
  lastInterval: string;
  setActiveSymbol: (symbol: TCCSymbol) => void;
  setLastInterval: (interval: string) => void;
}

export const useSymbolStore = create<SymbolStore>()(
  persist(
    (set) => ({
      activeSymbol: TCC_SYMBOLS[0], // BTCUSDT default
      lastInterval: "60",
      setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
      setLastInterval: (interval) => set({ lastInterval: interval }),
    }),
    {
      name: "symbol",
      storage: createJSONStorage(() => getUserScopedStorage("symbol")),
    }
  )
);