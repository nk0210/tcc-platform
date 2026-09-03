/**
 * TCC Journal Store — Phase Alpha
 * API-backed. Entries auto-created by backend on trade close.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

export type Emotion         = "neutral" | "confident" | "fearful" | "greedy" | "hesitant" | "frustrated";
export type EntryQuality    = "good" | "early" | "late" | "impulsive" | "missed" | "unknown";
export type Strategy        = "other" | "smc" | "ema_pullback" | "breakout" | "reversal" | "scalp" | "news" | "fibonacci" | "support_resistance";
export type MarketStructure = "trending_up" | "trending_down" | "ranging" | "choppy" | "unknown";

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
  /** Local-only UI flag — true while an AI analysis request is in flight. Never persisted. */
  aiLoading:       boolean;
  createdAt:       string;
  updatedAt:       string;
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

interface JournalStore {
  entries:       JournalEntry[];
  total:         number;
  page:          number;
  hasMore:       boolean;
  isLoading:     boolean;
  isSyncing:     boolean;
  isInitialized: boolean;
  error:         string | null;

  init:     () => Promise<void>;
  reset:    () => void;
  loadMore: () => Promise<void>;

  updateEntry: (id: string, input: UpdateJournalInput) => Promise<void>;
  addEntryToTop: (entry: JournalEntry) => void;
  /** Maps a raw journal entry returned by the API (e.g. from closing a trade) and prepends it. */
  addEntryFromClosedTrade: (raw: unknown) => void;
  /** Persists an AI coaching analysis and clears the local aiLoading flag. */
  updateAiAnalysis: (id: string, analysis: string) => Promise<void>;
  /** Local-only — toggles the transient "AI analysis in progress" flag. Never hits the API. */
  setAiLoading: (id: string, loading: boolean) => void;

  getEntryByTradeId: (tradeId: string) => JournalEntry | undefined;
}

// ── Mapper ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEntry(e: any): JournalEntry {
  return {
    id:              e.id,
    tradeId:         e.tradeId         ?? null,
    symbol:          e.symbol,
    displayName:     e.displayName,
    category:        e.category        ?? "crypto",
    emoji:           e.emoji           ?? undefined,
    side:            e.side,
    lotSize:         e.lotSize,
    entryPrice:      e.entryPrice,
    exitPrice:       e.exitPrice       ?? null,
    grossPnl:        e.grossPnl        ?? null,
    commission:      e.commission      ?? null,
    netPnl:          e.netPnl          ?? null,
    result:          e.result          ?? null,
    openedAt:        e.openedAt        ? new Date(e.openedAt).toISOString()  : null,
    closedAt:        e.closedAt        ? new Date(e.closedAt).toISOString()  : null,
    durationMs:      e.durationMs      ?? null,
    closeReason:     e.closeReason     ?? null,
    sl:              e.sl              ?? null,
    tp:              e.tp              ?? null,
    emotion:         e.emotion         ?? "neutral",
    confidenceLevel: e.confidenceLevel ?? 5,
    stressLevel:     e.stressLevel     ?? 5,
    entryQuality:    e.entryQuality    ?? "unknown",
    followedPlan:    e.followedPlan    ?? null,
    strategy:        e.strategy        ?? "other",
    marketStructure: e.marketStructure ?? "unknown",
    session:         e.session         ?? "unknown",
    timeframe:       e.timeframe       ?? "1H",
    notes:           e.notes           ?? "",
    whatWentRight:   e.whatWentRight   ?? "",
    whatWentWrong:   e.whatWentWrong   ?? "",
    lessonLearned:   e.lessonLearned   ?? "",
    tags:            e.tags            ?? [],
    aiAnalysis:      e.aiAnalysis      ?? "",
    aiLoading:       false,
    createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date(e.createdAt).toISOString(),
    updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : new Date(e.updatedAt).toISOString(),
  };
}

// ── Store ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export const useJournalStore = create<JournalStore>()((set, get) => ({
  entries:       [],
  total:         0,
  page:          1,
  hasMore:       false,
  isLoading:     false,
  isSyncing:     false,
  isInitialized: false,
  error:         null,

  // ── Init ──────────────────────────────────────────────────────────────

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
        entries:       (res.data.items ?? []).map(mapEntry),
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

  reset: () =>
    set({
      entries: [], total: 0, page: 1, hasMore: false,
      isLoading: false, isSyncing: false, isInitialized: false, error: null,
    }),

  // ── Load more (pagination) ────────────────────────────────────────────

  loadMore: async () => {
    const { page, hasMore, isLoading } = get();
    if (!hasMore || isLoading) return;

    const next = page + 1;
    set({ isLoading: true });

    try {
      const res = await api.get<{ items: any[]; total: number; hasNext: boolean }>(
        `/journal?pageSize=${PAGE_SIZE}&page=${next}`
      );
      if (!res.success) { set({ isLoading: false }); return; }

      set((s) => ({
        entries:  [...s.entries, ...(res.data.items ?? []).map(mapEntry)],
        total:    res.data.total   ?? s.total,
        page:     next,
        hasMore:  res.data.hasNext ?? false,
        isLoading: false,
      }));
    } catch (err) {
      console.error("[journalStore.loadMore]", err);
      set({ isLoading: false });
    }
  },

  // ── Update entry ──────────────────────────────────────────────────────

  updateEntry: async (id, input) => {
    // Optimistic
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === id ? { ...e, ...input, updatedAt: new Date().toISOString() } : e
      ),
    }));

    try {
      const res = await api.put<any>(`/journal/${id}`, input);
      if (res.success) {
        const updated = mapEntry(res.data);
        set((s) => ({ entries: s.entries.map((e) => (e.id === id ? updated : e)) }));
      } else {
        // Revert: re-fetch from server
        const fresh = await api.get<any>(`/journal/${id}`);
        if (fresh.success) {
          const reverted = mapEntry(fresh.data);
          set((s) => ({ entries: s.entries.map((e) => (e.id === id ? reverted : e)) }));
        }
      }
    } catch (err) {
      console.error("[journalStore.updateEntry]", err);
    }
  },

  // ── Add latest entry without re-fetching (called after trade close) ───

  addEntryToTop: (entry) => {
    set((s) => {
      if (s.entries.some((e) => e.id === entry.id)) return s;
      return { entries: [entry, ...s.entries], total: s.total + 1 };
    });
  },

  // ── Add latest entry from a raw API journal entry (e.g. auto-created on trade close) ──

  addEntryFromClosedTrade: (raw) => {
    get().addEntryToTop(mapEntry(raw));
  },

  // ── AI analysis ───────────────────────────────────────────────────────

  updateAiAnalysis: async (id, analysis) => {
    await get().updateEntry(id, { aiAnalysis: analysis });
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, aiLoading: false } : e)),
    }));
  },

  setAiLoading: (id, loading) => {
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, aiLoading: loading } : e)),
    }));
  },

  // ── Selector ──────────────────────────────────────────────────────────

  getEntryByTradeId: (tradeId) =>
    get().entries.find((e) => e.tradeId === tradeId),
}));

// ── Auto-init / reset (single-arg subscribe) ──────────────────────────────

if (typeof window !== "undefined") {
  import("@/store/authStore").then(({ useAuthStore }) => {
    // This store is only imported (and this block only runs) when its page
    // is first visited — often well after login. subscribe() alone only
    // fires on *future* changes, so if the user is already logged in by now
    // it would silently never call init(), leaving isInitialized false
    // forever. Seed prevUserId from the current state and fire once
    // up front to cover that already-happened transition.
    let prevUserId: string | undefined = useAuthStore.getState().user?.id;
    if (prevUserId) useJournalStore.getState().init();

    useAuthStore.subscribe((state) => {
      const userId = state.user?.id;
      if (userId !== prevUserId) {
        prevUserId = userId;
        if (userId) {
          useJournalStore.getState().init();
        } else {
          useJournalStore.getState().reset();
        }
      }
    });
  });
}