/**
 * TCC Watchlist Store
 * Default is EMPTY — fresh users start with no watchlist.
 * Users add symbols from Markets page (only TCC-supported symbols).
 * Live prices for crypto are updated by useMarketPrices hook.
 * Non-crypto symbols are added but show "Chart available" — no live price.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";
import { TCC_SYMBOLS, TCC_SYMBOL_MAP, TCCSymbol } from "@/lib/markets/symbols";

export interface PriceAlert {
  id: string;
  type: "above" | "below";
  price: number;
  triggered: boolean;
  createdAt: number;
}

export interface WatchlistItem {
  symbolId: string;         // references TCC_SYMBOLS id
  displayName: string;      // e.g. "BTC/USDT"
  category: string;         // from central config
  addedAt: number;
  alerts: PriceAlert[];
  // live data — NOT persisted, reset on load, updated by hooks
  currentPrice: number;
  change24h: number;
  changePct24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

interface WatchlistStore {
  items: WatchlistItem[];
  // returns all TCC symbols NOT already in watchlist, for the Add Symbol picker
  getAvailableToAdd: () => TCCSymbol[];
  updatePrice: (symbolId: string, data: Partial<Pick<WatchlistItem, "currentPrice" | "change24h" | "changePct24h" | "high24h" | "low24h" | "volume24h">>) => void;
  addSymbol: (symbolId: string) => void;
  removeSymbol: (symbolId: string) => void;
  addAlert: (symbolId: string, type: "above" | "below", price: number) => void;
  removeAlert: (symbolId: string, alertId: string) => void;
  triggerAlert: (symbolId: string, alertId: string) => void;
}

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      items: [], // Fresh user starts with empty watchlist — NO fake defaults

      getAvailableToAdd: () => {
        const watchedIds = new Set(get().items.map(i => i.symbolId));
        return TCC_SYMBOLS.filter(s => !watchedIds.has(s.id));
      },

      updatePrice: (symbolId, data) =>
        set((state) => ({
          items: state.items.map(item =>
            item.symbolId === symbolId ? { ...item, ...data } : item
          ),
        })),

      addSymbol: (symbolId) => {
        const existing = get().items.find(i => i.symbolId === symbolId);
        if (existing) return;
        const def = TCC_SYMBOL_MAP[symbolId];
        if (!def) return; // Only add TCC-supported symbols
        set((state) => ({
          items: [
            ...state.items,
            {
              symbolId,
              displayName: def.displayName,
              category: def.category,
              addedAt: Date.now(),
              alerts: [],
              currentPrice: 0,
              change24h: 0,
              changePct24h: 0,
              high24h: 0,
              low24h: 0,
              volume24h: 0,
            },
          ],
        }));
      },

      removeSymbol: (symbolId) =>
        set((state) => ({ items: state.items.filter(i => i.symbolId !== symbolId) })),

      addAlert: (symbolId, type, price) =>
        set((state) => ({
          items: state.items.map(item =>
            item.symbolId === symbolId
              ? { ...item, alerts: [...item.alerts, { id: Date.now().toString(), type, price, triggered: false, createdAt: Date.now() }] }
              : item
          ),
        })),

      removeAlert: (symbolId, alertId) =>
        set((state) => ({
          items: state.items.map(item =>
            item.symbolId === symbolId
              ? { ...item, alerts: item.alerts.filter(a => a.id !== alertId) }
              : item
          ),
        })),

      triggerAlert: (symbolId, alertId) =>
        set((state) => ({
          items: state.items.map(item =>
            item.symbolId === symbolId
              ? { ...item, alerts: item.alerts.map(a => a.id === alertId ? { ...a, triggered: true } : a) }
              : item
          ),
        })),
    }),
    {
      name: "watchlist",
      storage: createJSONStorage(() => getUserScopedStorage("watchlist")),
      // Only persist symbolId, displayName, category, addedAt, alerts
      // Live prices are NOT persisted — they reset to 0 and are repopulated by hooks
      partialize: (state) => ({
        items: state.items.map(item => ({
          symbolId: item.symbolId,
          displayName: item.displayName,
          category: item.category,
          addedAt: item.addedAt,
          alerts: item.alerts,
          currentPrice: 0,
          change24h: 0,
          changePct24h: 0,
          high24h: 0,
          low24h: 0,
          volume24h: 0,
        })),
      }),
    }
  )
);