/**
 * TCC Journal Store — Phase Alpha
 *
 * Migrated from localStorage to API-backed PostgreSQL persistence.
 *
 * Journal entries are auto-created by the backend when a trade closes
 * (see tradeService.closePosition). Users edit the reflection fields
 * (notes, emotion, followedPlan, etc.) via updateEntry().
 *
 * Auto-initialises on user login via authStore subscription.
 */
import { create } from "zustand";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/store/authStore";

// ── Types ─────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id:             string;
  tradeId:        string | null;
  symbol:         string;
  displayName:    string;
  category:       string;
  emoji?:         string;
  side:           "BUY" | "SELL";
  lotSize:        number;
  entryPrice:     number;
  exitPrice:      number | null;
  grossPnl:       number | null;
  commission:     number | null;
  netPnl:         number | null;
  result:         "WIN" | "LOSS" | "BREAKEVEN" | null;
  openedAt:       string | null;
  closedAt:       string | null;
  durationMs:     number | null;
  closeReason:    string | null;
  sl:             number | null;
  tp:             number | null;

  // Reflection fields
  emotion:         string;
  confidenceLevel: number;
  stressLevel:     number;
  entryQuality:    string;
  followedPlan:    boolean | null;
  strategy:        string;
  marketStructure: string;
  session:         string;
  timeframe:       string;
  notes:           string;
  whatWentRight:   string;
  whatWentWrong:   string;
  lessonLearned:   string;
  tags:            string[];
  aiAnalysis:      string;

  createdAt: string;
  updatedAt: string;
}

export interface UpdateJournalInput {
  emotion?:         string;
  confidenceLevel?: number;
  stressLevel?:     number;
  entryQuality?:    string;
  followedPlan?:    boolean | null;
  strategy?:        string;
  marketStructure?: string;
  session?:         string;
  timeframe?:       string;
  notes?:           string;
  whatWentRight?:   string;
  whatWentWrong?:   string;
  lessonLearned?:   string;
  tags?:            string[];
  aiAnalysis?:      string;
}

// ── Store interface ────────────────────────────────────────────────────────

interface JournalStore {
  entries:       JournalEntry[];
  total:         number;
  page:          number;
  pageSize:      number;
  hasMore:       boolean;
  isLoading:     boolean;
  isSyncing:     boolean;
  isInitialized: boolean;
  error:         string | null;

  // Lifecycle
  init:     () => Promise<void>;
  reset:    () => void;
  loadMore: () => Promise<void>;

  // Mutations
  updateEntry: (id: string, input: UpdateJournalInput) => Promise<void>;

  // Selectors
  getEntryByTradeId: (tradeId: string) => JournalEntry | undefined;
}

// ── Mapper ────────────────────────────────────────────────────────────────

function mapApiEntry(e: any): JournalEntry {
  return {
    id:             e.id,
    tradeId:        e.tradeId        ?? null,
    symbol:         e.symbol,
    displayName:    e.displayName,
    category:       e.category       ?? "crypto",
    emoji:          e.emoji          ?? undefined,
    side:           e.side,
    lotSize:        e.lotSize,
    entryPrice:     e.entryPrice,
    exitPrice:      e.exitPrice      ?? null,
    grossPnl:       e.grossPnl       ?? null,
    commission:     e.commission     ?? null,
    netPnl:         e.netPnl         ?? null,
    result:         e.result         ?? null,
    openedAt:       e.openedAt       ? new Date(e.openedAt).toISOString()  : null,
    closedAt:       e.closedAt       ? new Date(e.closedAt).toISOString()  : null,
    durationMs:     e.durationMs     ?? null,
    closeReason:    e.closeReason    ?? null,
    sl:             e.sl             ?? null,
    tp:             e.tp             ?? null,
    emotion:        e.emotion        ?? "neutral",
    confidenceLevel: e.confidenceLevel ?? 5,
    stressLevel:    e.stressLevel    ?? 5,
    entryQuality:   e.entryQuality   ?? "unknown",
    followedPlan:   e.followedPlan   ?? null,
    strategy:       e.strategy       ?? "other",
    marketStructure: e.marketStructure ?? "unknown",
    session:        e.session        ?? "unknown",
    timeframe:      e.timeframe      ?? "1H",
    notes:          e.notes          ?? "",
    whatWentRight:  e.whatWentRight  ?? "",
    whatWentWrong:  e.whatWentWrong  ?? "",
    lessonLearned:  e.lessonLearned  ?? "",
    tags:           e.tags           ?? [],
    aiAnalysis:     e.aiAnalysis     ?? "",
    createdAt:      typeof e.createdAt === "string" ? e.createdAt : new Date(e.createdAt).toISOString(),
    updatedAt:      typeof e.updatedAt === "string" ? e.updatedAt : new Date(e.updatedAt).toISOString(),
  };
}

// ── Store ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export const useJournalStore = create<JournalStore>()((set, get) => ({
  entries:       [],
  total:         0,
  page:          1,
  pageSize:      PAGE_SIZE,
  hasMore:       false,
  isLoading:     false,
  isSyncing:     false,
  isInitialized: false,
  error:         null,

  // ── Lifecycle ──────────────────────────────────────────────────────────

  init: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      const res = await api.get<{ items: any[]; total: number; hasNext: boolean }>(
        `/journal?pageSize=${PAGE_SIZE}&page=1`
      );

      if (!res.success) {
        set({ isLoading: false, error: res.error, isInitialized: true });
        return;
      }

      set({
        entries:       (res.data.items ?? []).map(mapApiEntry),
        total:         res.data.total  ?? 0,
        page:          1,
        hasMore:       res.data.hasNext ?? false,
        isLoading:     false,
        isInitialized: true,
        error:         null,
      });
    } catch (err) {
      console.error("[journalStore.init]", err);
      set({ isLoading: false, error: "Failed to load journal", isInitialized: true });
    }
  },

  reset: () => {
    set({
      entries:       [],
      total:         0,
      page:          1,
      hasMore:       false,
      isLoading:     false,
      isSyncing:     false,
      isInitialized: false,
      error:         null,
    });
  },

  loadMore: async () => {
    const { page, hasMore, isLoading } = get();
    if (!hasMore || isLoading) return;

    const nextPage = page + 1;
    set({ isLoading: true });

    try {
      const res = await api.get<{ items: any[]; total: number; hasNext: boolean }>(
        `/journal?pageSize=${PAGE_SIZE}&page=${nextPage}`
      );

      if (!res.success) {
        set({ isLoading: false });
        return;
      }

      set((state) => ({
        entries:  [...state.entries, ...(res.data.items ?? []).map(mapApiEntry)],
        total:    res.data.total   ?? state.total,
        page:     nextPage,
        hasMore:  res.data.hasNext ?? false,
        isLoading: false,
      }));
    } catch (err) {
      console.error("[journalStore.loadMore]", err);
      set({ isLoading: false });
    }
  },

  // ── Update a journal entry ─────────────────────────────────────────────

  updateEntry: async (id, input) => {
    // Optimistic update
    set((state) => ({
      entries: state.entries.map(e =>
        e.id === id
          ? { ...e, ...input, updatedAt: new Date().toISOString() }
          : e
      ),
    }));

    try {
      const res = await api.put<any>(`/journal/${id}`, input);
      if (!res.success) {
        console.error("[journalStore.updateEntry]", res.error);
        // Re-fetch on failure to restore server state
        const fresh = await api.get<any>(`/journal/${id}`);
        if (fresh.success) {
          const updated = mapApiEntry(fresh.data);
          set((state) => ({
            entries: state.entries.map(e => e.id === id ? updated : e),
          }));
        }
      } else {
        // Sync server response into store
        const updated = mapApiEntry(res.data);
        set((state) => ({
          entries: state.entries.map(e => e.id === id ? updated : e),
        }));
      }
    } catch (err) {
      console.error("[journalStore.updateEntry]", err);
    }
  },

  // ── Selectors ─────────────────────────────────────────────────────────

  getEntryByTradeId: (tradeId) => {
    return get().entries.find(e => e.tradeId === tradeId);
  },
}));

// ── Sync new entries when trades close ───────────────────────────────────
// When the tradeStore closes a position, the backend auto-creates a
// journal entry. We add it to the store by fetching the latest entry.
export async function syncLatestJournalEntry(): Promise<void> {
  const store = useJournalStore.getState();
  if (!store.isInitialized) return;

  try {
    const res = await api.get<{ items: any[] }>("/journal?pageSize=1&page=1");
    if (res.success && res.data.items.length > 0) {
      const latest = mapApiEntry(res.data.items[0]);
      store.entries.findIndex(e => e.id === latest.id) === -1 &&
        useJournalStore.setState((state) => ({
          entries: [latest, ...state.entries],
          total:   state.total + 1,
        }));
    }
  } catch (err) {
    console.error("[journalStore.syncLatest]", err);
  }
}

// ── Auto-init on auth state change ────────────────────────────────────────

if (typeof window !== "undefined") {
  useAuthStore.subscribe(
    (state) => state.user?.id,
    (userId) => {
      if (userId) {
        useJournalStore.getState().init();
      } else {
        useJournalStore.getState().reset();
      }
    }
  );
}