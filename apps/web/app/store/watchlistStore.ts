/**
 * TCC Watchlist Store — Phase Alpha
 * API-backed for membership (which symbols are watched).
 * Live price fields + alerts are LOCAL ONLY — driven by useMarketPrices, never
 * sent to the API — matching tradeStore.updatePrices's local-only pattern.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";
import { TCC_SYMBOLS, TCC_SYMBOL_MAP, type TCCSymbol } from "@/lib/markets/symbols";

// ── Types ─────────────────────────────────────────────────────────────────

export interface PriceAlert {
  id:        string;
  type:      "above" | "below";
  price:     number;
  triggered: boolean;
  createdAt: string;
}

export interface WatchlistItem {
  id:          string;
  symbolId:    string;
  displayName: string;
  category:    string;
  emoji?:      string;
  addedAt:     string;

  // ── Local-only live market data (never persisted to the API) ────────────
  currentPrice: number;
  change24h:    number;
  changePct24h: number;
  high24h:      number;
  low24h:       number;
  volume24h:    number;
  alerts:       PriceAlert[];
}

export interface LiveTickerUpdate {
  currentPrice: number;
  change24h:    number;
  changePct24h: number;
  high24h:      number;
  low24h:       number;
  volume24h:    number;
}

interface WatchlistStore {
  items:         WatchlistItem[];
  isLoading:     boolean;
  isSyncing:     boolean;
  isInitialized: boolean;
  error:         string | null;

  init:           () => Promise<void>;
  reset:          () => void;
  addSymbol:      (symbolId: string) => Promise<void>;
  removeSymbol:   (symbolId: string) => Promise<void>;
  clearWatchlist: () => Promise<void>;
  isInWatchlist:  (symbolId: string) => boolean;
  /** TCC-supported symbols not already on the watchlist. */
  getAvailableToAdd: () => TCCSymbol[];

  // ── Local-only live data + alerts ───────────────────────────────────────
  updatePrice:  (symbolId: string, update: LiveTickerUpdate) => void;
  addAlert:     (symbolId: string, type: "above" | "below", price: number) => void;
  removeAlert:  (symbolId: string, alertId: string) => void;
  triggerAlert: (symbolId: string, alertId: string) => void;
}

// ── Mapper ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(i: any): WatchlistItem {
  return {
    id:          i.id,
    symbolId:    i.symbol,
    displayName: i.displayName,
    category:    i.category ?? "crypto",
    emoji:       i.emoji    ?? undefined,
    addedAt:     typeof i.addedAt === "string" ? i.addedAt : new Date(i.addedAt).toISOString(),
    currentPrice: 0,
    change24h:    0,
    changePct24h: 0,
    high24h:      0,
    low24h:       0,
    volume24h:    0,
    alerts:       [],
  };
}

function makeAlertId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useWatchlistStore = create<WatchlistStore>()((set, get) => ({
  items:         [],
  isLoading:     false,
  isSyncing:     false,
  isInitialized: false,
  error:         null,

  // ── Init ──────────────────────────────────────────────────────────────

  init: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      const res = await api.get<{ id: string; items: any[] }>("/watchlist");
      if (!res.success) {
        set({ isLoading: false, error: res.error, isInitialized: true });
        return;
      }

      set({
        items:         (res.data?.items ?? []).map(mapItem),
        isLoading:     false,
        isInitialized: true,
        error:         null,
      });
    } catch (err) {
      console.error("[watchlistStore.init]", err);
      set({ isLoading: false, error: "Failed to load watchlist", isInitialized: true });
    }
  },

  reset: () =>
    set({
      items: [], isLoading: false, isSyncing: false,
      isInitialized: false, error: null,
    }),

  // ── Add symbol ────────────────────────────────────────────────────────

  addSymbol: async (symbolId) => {
    if (get().isInWatchlist(symbolId)) return;

    const def = TCC_SYMBOL_MAP[symbolId];
    if (!def) return;

    const temp: WatchlistItem = {
      ...mapItem({ id: `temp_${Date.now()}`, symbol: symbolId, displayName: def.displayName, category: def.category, emoji: def.emoji, addedAt: new Date().toISOString() }),
    };

    set((s) => ({ items: [temp, ...s.items], isSyncing: true }));

    try {
      const res = await api.post<any>("/watchlist", {
        symbol:      symbolId,
        displayName: def.displayName,
        category:    def.category,
        emoji:       def.emoji ?? null,
      });

      if (!res.success) {
        set((s) => ({ items: s.items.filter((i) => i.id !== temp.id), isSyncing: false, error: res.error }));
        return;
      }

      const serverItem = mapItem(res.data);
      set((s) => ({
        items:     s.items.map((i) => (i.id === temp.id ? serverItem : i)),
        isSyncing: false,
        error:     null,
      }));
    } catch (err) {
      set((s) => ({ items: s.items.filter((i) => i.id !== temp.id), isSyncing: false, error: "Failed to add symbol" }));
      console.error("[watchlistStore.addSymbol]", err);
    }
  },

  // ── Remove symbol ─────────────────────────────────────────────────────

  removeSymbol: async (symbolId) => {
    const prev = get().items;
    set((s) => ({ items: s.items.filter((i) => i.symbolId !== symbolId), isSyncing: true }));

    try {
      const res = await api.delete<null>(`/watchlist/${encodeURIComponent(symbolId)}`);
      if (!res.success) { set({ items: prev, isSyncing: false, error: res.error }); return; }
      set({ isSyncing: false, error: null });
    } catch (err) {
      set({ items: prev, isSyncing: false, error: "Failed to remove symbol" });
      console.error("[watchlistStore.removeSymbol]", err);
    }
  },

  // ── Clear all ─────────────────────────────────────────────────────────

  clearWatchlist: async () => {
    const prev = get().items;
    set({ items: [], isSyncing: true });

    try {
      const res = await api.delete<null>("/watchlist/clear");
      if (!res.success) { set({ items: prev, isSyncing: false, error: res.error }); return; }
      set({ isSyncing: false, error: null });
    } catch (err) {
      set({ items: prev, isSyncing: false, error: "Failed to clear watchlist" });
      console.error("[watchlistStore.clearWatchlist]", err);
    }
  },

  // ── Selectors ─────────────────────────────────────────────────────────

  isInWatchlist: (symbolId) => get().items.some((i) => i.symbolId === symbolId),

  getAvailableToAdd: () => {
    const watched = new Set(get().items.map((i) => i.symbolId));
    return TCC_SYMBOLS.filter((s) => !watched.has(s.id));
  },

  // ── Local-only live data ──────────────────────────────────────────────

  updatePrice: (symbolId, update) => {
    set((s) => ({
      items: s.items.map((i) => (i.symbolId === symbolId ? { ...i, ...update } : i)),
    }));
  },

  // ── Local-only alerts ─────────────────────────────────────────────────

  addAlert: (symbolId, type, price) => {
    const alert: PriceAlert = { id: makeAlertId(), type, price, triggered: false, createdAt: new Date().toISOString() };
    set((s) => ({
      items: s.items.map((i) => (i.symbolId === symbolId ? { ...i, alerts: [...i.alerts, alert] } : i)),
    }));
  },

  removeAlert: (symbolId, alertId) => {
    set((s) => ({
      items: s.items.map((i) =>
        i.symbolId === symbolId ? { ...i, alerts: i.alerts.filter((a) => a.id !== alertId) } : i
      ),
    }));
  },

  triggerAlert: (symbolId, alertId) => {
    set((s) => ({
      items: s.items.map((i) =>
        i.symbolId === symbolId
          ? { ...i, alerts: i.alerts.map((a) => (a.id === alertId ? { ...a, triggered: true } : a)) }
          : i
      ),
    }));
  },
}));

// ── Auto-init / reset (single-arg subscribe) ──────────────────────────────

if (typeof window !== "undefined") {
  import("@/store/authStore").then(({ useAuthStore }) => {
    let prevUserId: string | undefined;

    useAuthStore.subscribe((state) => {
      const userId = state.user?.id;
      if (userId !== prevUserId) {
        prevUserId = userId;
        if (userId) {
          useWatchlistStore.getState().init();
        } else {
          useWatchlistStore.getState().reset();
        }
      }
    });
  });
}
