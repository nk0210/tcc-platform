/**
 * TCC Watchlist Store — Phase Alpha
 *
 * Migrated from localStorage to API-backed PostgreSQL persistence.
 * Auto-initialises on user login via authStore subscription.
 */
import { create } from "zustand";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/store/authStore";

// ── Types ─────────────────────────────────────────────────────────────────

export interface WatchlistItem {
  id:          string;
  symbol:      string;
  displayName: string;
  category:    string;
  emoji?:      string;
  addedAt:     string;
}

// ── Store interface ────────────────────────────────────────────────────────

interface WatchlistStore {
  items:         WatchlistItem[];
  isLoading:     boolean;
  isSyncing:     boolean;
  isInitialized: boolean;
  error:         string | null;

  // Lifecycle
  init:  () => Promise<void>;
  reset: () => void;

  // Mutations
  addSymbol:     (input: Omit<WatchlistItem, "id" | "addedAt">) => Promise<void>;
  removeSymbol:  (symbol: string) => Promise<void>;
  clearWatchlist: ()              => Promise<void>;

  // Selectors
  isInWatchlist: (symbol: string) => boolean;
}

// ── Mapper ────────────────────────────────────────────────────────────────

function mapApiItem(item: any): WatchlistItem {
  return {
    id:          item.id,
    symbol:      item.symbol,
    displayName: item.displayName,
    category:    item.category ?? "crypto",
    emoji:       item.emoji    ?? undefined,
    addedAt:     typeof item.addedAt === "string"
      ? item.addedAt
      : new Date(item.addedAt).toISOString(),
  };
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useWatchlistStore = create<WatchlistStore>()((set, get) => ({
  items:         [],
  isLoading:     false,
  isSyncing:     false,
  isInitialized: false,
  error:         null,

  // ── Lifecycle ──────────────────────────────────────────────────────────

  init: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      const res = await api.get<{ items: any[] }>("/watchlist");

      if (!res.success) {
        set({ isLoading: false, error: res.error, isInitialized: true });
        return;
      }

      const items = (res.data?.items ?? []).map(mapApiItem);
      set({ items, isLoading: false, isInitialized: true, error: null });
    } catch (err) {
      console.error("[watchlistStore.init]", err);
      set({ isLoading: false, error: "Failed to load watchlist", isInitialized: true });
    }
  },

  reset: () => {
    set({
      items:         [],
      isLoading:     false,
      isSyncing:     false,
      isInitialized: false,
      error:         null,
    });
  },

  // ── Add a symbol ───────────────────────────────────────────────────────

  addSymbol: async (input) => {
    if (get().isInWatchlist(input.symbol)) return;

    // Optimistic add
    const tempItem: WatchlistItem = {
      id:          `temp_${Date.now()}`,
      symbol:      input.symbol,
      displayName: input.displayName,
      category:    input.category,
      emoji:       input.emoji,
      addedAt:     new Date().toISOString(),
    };

    set((state) => ({
      items:     [tempItem, ...state.items],
      isSyncing: true,
    }));

    try {
      const res = await api.post<any>("/watchlist", {
        symbol:      input.symbol,
        displayName: input.displayName,
        category:    input.category,
        emoji:       input.emoji,
      });

      if (!res.success) {
        // Revert
        set((state) => ({
          items:     state.items.filter(i => i.id !== tempItem.id),
          isSyncing: false,
          error:     res.error,
        }));
        return;
      }

      // Replace temp with real item from server
      const serverItem = mapApiItem(res.data);
      set((state) => ({
        items:     state.items.map(i => i.id === tempItem.id ? serverItem : i),
        isSyncing: false,
        error:     null,
      }));
    } catch (err) {
      set((state) => ({
        items:     state.items.filter(i => i.id !== tempItem.id),
        isSyncing: false,
        error:     "Failed to add symbol",
      }));
      console.error("[watchlistStore.addSymbol]", err);
    }
  },

  // ── Remove a symbol ────────────────────────────────────────────────────

  removeSymbol: async (symbol) => {
    const prev = get().items;

    // Optimistic removal
    set((state) => ({
      items:     state.items.filter(i => i.symbol !== symbol),
      isSyncing: true,
    }));

    try {
      const res = await api.delete<null>(`/watchlist/${encodeURIComponent(symbol)}`);
      if (!res.success) {
        // Revert
        set({ items: prev, isSyncing: false, error: res.error });
        return;
      }
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
      const res = await api.delete<null>("/watchlist");
      if (!res.success) {
        set({ items: prev, isSyncing: false, error: res.error });
        return;
      }
      set({ isSyncing: false, error: null });
    } catch (err) {
      set({ items: prev, isSyncing: false, error: "Failed to clear watchlist" });
      console.error("[watchlistStore.clear]", err);
    }
  },

  // ── Selector ──────────────────────────────────────────────────────────

  isInWatchlist: (symbol) => {
    return get().items.some(i => i.symbol === symbol);
  },
}));

// ── Auto-init on auth state change ────────────────────────────────────────

if (typeof window !== "undefined") {
  useAuthStore.subscribe(
    (state) => state.user?.id,
    (userId) => {
      if (userId) {
        useWatchlistStore.getState().init();
      } else {
        useWatchlistStore.getState().reset();
      }
    }
  );
}