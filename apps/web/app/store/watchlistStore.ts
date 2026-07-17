/**
 * TCC Watchlist Store — Phase Alpha
 * API-backed. Optimistic updates with revert on failure.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

export interface WatchlistItem {
  id:          string;
  symbol:      string;
  displayName: string;
  category:    string;
  emoji?:      string;
  addedAt:     string;
}

interface WatchlistStore {
  items:         WatchlistItem[];
  isLoading:     boolean;
  isSyncing:     boolean;
  isInitialized: boolean;
  error:         string | null;

  init:          () => Promise<void>;
  reset:         () => void;
  addSymbol:     (input: Omit<WatchlistItem, "id" | "addedAt">) => Promise<void>;
  removeSymbol:  (symbol: string)                               => Promise<void>;
  clearWatchlist: ()                                            => Promise<void>;
  isInWatchlist: (symbol: string)                              => boolean;
}

// ── Mapper ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItem(i: any): WatchlistItem {
  return {
    id:          i.id,
    symbol:      i.symbol,
    displayName: i.displayName,
    category:    i.category ?? "crypto",
    emoji:       i.emoji    ?? undefined,
    addedAt:     typeof i.addedAt === "string" ? i.addedAt : new Date(i.addedAt).toISOString(),
  };
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

  addSymbol: async (input) => {
    if (get().isInWatchlist(input.symbol)) return;

    const temp: WatchlistItem = {
      id:      `temp_${Date.now()}`,
      addedAt: new Date().toISOString(),
      ...input,
    };

    set((s) => ({ items: [temp, ...s.items], isSyncing: true }));

    try {
      const res = await api.post<any>("/watchlist", {
        symbol:      input.symbol,
        displayName: input.displayName,
        category:    input.category,
        emoji:       input.emoji ?? null,
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

  removeSymbol: async (symbol) => {
    const prev = get().items;
    set((s) => ({ items: s.items.filter((i) => i.symbol !== symbol), isSyncing: true }));

    try {
      const res = await api.delete<null>(`/watchlist/${encodeURIComponent(symbol)}`);
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

  // ── Selector ──────────────────────────────────────────────────────────

  isInWatchlist: (symbol) => get().items.some((i) => i.symbol === symbol),
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