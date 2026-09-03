/**
 * TCC Strategy Store — Phase Alpha
 * API-backed strategy marketplace: discover, publish, save, playbook, reviews.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

export type StrategyType      = "OFFICIAL" | "EDUCATIONAL_TEMPLATE" | "CREATOR_PUBLISHED";
export type StrategyRiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type StrategyPricing   = "FREE" | "ONE_TIME" | "SUBSCRIPTION";
export type PerformanceStatus = "UNVERIFIED" | "SELF_REPORTED" | "VERIFIED";

export interface StrategyAuthor {
  id:          string;
  handle:      string;
  displayName: string;
  avatarUrl:   string | null;
  isVerified:  boolean;
}

export interface Strategy {
  id:                string;
  authorId:          string;
  authorHandle:      string;
  authorTccId:       string | null;
  title:             string;
  description:       string;
  type:              StrategyType;
  asset:             string;
  assetCategory:     string;
  timeframe:         string;
  riskLevel:         StrategyRiskLevel;
  pricingModel:      StrategyPricing;
  price:             number;
  isFeatured:        boolean;
  performanceStatus: PerformanceStatus;
  winRate:           number | null;
  profitFactor:      number | null;
  maxDrawdown:       number | null;
  totalTrades:       number | null;
  avgRR:             number | null;
  monthlyReturn:     number | null;
  rules:             string[];
  entryConditions:   string[];
  exitConditions:    string[];
  riskManagement:    string[];
  tags:              string[];
  verified:          boolean;
  version:           string;
  disclaimer:        string;
  linkedCourseId:    string | null;
  isSaved:           boolean;
  isInPlaybook:      boolean;
  author:            StrategyAuthor;
  _count:            { reviews: number; savedBy: number };
  createdAt:         string;
  updatedAt:         string;
}

export interface StrategyReview {
  id:         string;
  strategyId: string;
  authorId:   string;
  handle:     string;
  rating:     number;
  comment:    string;
  timestamp:  string;
  author?:    StrategyAuthor;
}

export interface CreateStrategyInput {
  title:            string;
  description:      string;
  type:             StrategyType;
  asset?:           string;
  assetCategory?:   string;
  timeframe?:       string;
  riskLevel?:       StrategyRiskLevel;
  pricingModel?:    StrategyPricing;
  price?:           number;
  winRate?:         number | null;
  profitFactor?:    number | null;
  maxDrawdown?:     number | null;
  totalTrades?:     number | null;
  avgRR?:           number | null;
  monthlyReturn?:   number | null;
  rules?:           string[];
  entryConditions?: string[];
  exitConditions?:  string[];
  riskManagement?:  string[];
  tags?:            string[];
  version?:         string;
  disclaimer:       string;
  linkedCourseId?:  string | null;
}

export type UpdateStrategyInput = Partial<CreateStrategyInput>;

export interface StrategyFilters {
  type?:          StrategyType;
  riskLevel?:     StrategyRiskLevel;
  assetCategory?: string;
  timeframe?:     string;
  search?:        string;
  tags?:          string[];
}

interface PaginatedResult<T> {
  items:      T[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

const PAGE_SIZE = 20;

function buildQuery(page: number, filters?: StrategyFilters): string {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("pageSize", String(PAGE_SIZE));
  if (filters?.type)          qs.set("type", filters.type);
  if (filters?.riskLevel)     qs.set("riskLevel", filters.riskLevel);
  if (filters?.assetCategory) qs.set("assetCategory", filters.assetCategory);
  if (filters?.timeframe)     qs.set("timeframe", filters.timeframe);
  if (filters?.search)        qs.set("search", filters.search);
  if (filters?.tags?.length)  qs.set("tags", filters.tags.join(","));
  return qs.toString();
}

// ── Store ─────────────────────────────────────────────────────────────────

interface Lists {
  strategies:      Strategy[];
  myStrategies:    Strategy[];
  savedStrategies: Strategy[];
  playbook:        Strategy[];
}

function patchEverywhere(lists: Lists, strategyId: string, patch: Partial<Strategy>): Lists {
  const apply = (arr: Strategy[]) => arr.map((s) => (s.id === strategyId ? { ...s, ...patch } : s));
  return {
    strategies:      apply(lists.strategies),
    myStrategies:    apply(lists.myStrategies),
    savedStrategies: apply(lists.savedStrategies),
    playbook:        apply(lists.playbook),
  };
}

function bumpReviewCount(lists: Lists, strategyId: string): Lists {
  const bump = (arr: Strategy[]) =>
    arr.map((s) => (s.id !== strategyId ? s : { ...s, _count: { ...s._count, reviews: s._count.reviews + 1 } }));
  return {
    strategies:      bump(lists.strategies),
    myStrategies:    bump(lists.myStrategies),
    savedStrategies: bump(lists.savedStrategies),
    playbook:        bump(lists.playbook),
  };
}

function snapshot(s: StrategyStore): Lists {
  return { strategies: s.strategies, myStrategies: s.myStrategies, savedStrategies: s.savedStrategies, playbook: s.playbook };
}

interface StrategyStore extends Lists {
  page:          number;
  hasMore:       boolean;
  isLoading:     boolean;
  isSyncing:     boolean;
  isInitialized: boolean;
  error:         string | null;

  init:     () => Promise<void>;
  reset:    () => void;
  loadMore: () => Promise<void>;

  discoverStrategies: (filters?: StrategyFilters) => Promise<void>;
  getMyStrategies:    () => Promise<void>;
  getSavedStrategies: () => Promise<void>;
  getPlaybook:        () => Promise<void>;

  createStrategy: (input: CreateStrategyInput) => Promise<Strategy | null>;
  updateStrategy: (id: string, input: UpdateStrategyInput) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;

  toggleSave:     (strategyId: string) => Promise<void>;
  togglePlaybook: (strategyId: string) => Promise<void>;

  addReview:  (strategyId: string, review: { rating: number; comment: string }) => Promise<StrategyReview | null>;
  getReviews: (strategyId: string, page?: number) => Promise<PaginatedResult<StrategyReview> | null>;
}

export const useStrategyStore = create<StrategyStore>()((set, get) => ({
  strategies:      [],
  myStrategies:    [],
  savedStrategies: [],
  playbook:        [],
  page:            1,
  hasMore:         false,
  isLoading:       false,
  isSyncing:       false,
  isInitialized:   false,
  error:           null,

  // ── Init ──────────────────────────────────────────────────────────────

  init: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      const res = await api.get<PaginatedResult<Strategy>>(`/strategy?${buildQuery(1)}`);
      if (!res.success) {
        set({ isLoading: false, error: res.error, isInitialized: true });
        return;
      }
      set({
        strategies:    res.data.items ?? [],
        page:          1,
        hasMore:       res.data.hasNext ?? false,
        isLoading:     false,
        isInitialized: true,
        error:         null,
      });
    } catch (err) {
      console.error("[strategyStore.init]", err);
      set({ isLoading: false, error: "Failed to load strategies", isInitialized: true });
    }
  },

  reset: () =>
    set({
      strategies: [], myStrategies: [], savedStrategies: [], playbook: [],
      page: 1, hasMore: false, isLoading: false, isSyncing: false,
      isInitialized: false, error: null,
    }),

  loadMore: async () => {
    const { page, hasMore, isLoading } = get();
    if (!hasMore || isLoading) return;

    const next = page + 1;
    set({ isLoading: true });

    try {
      const res = await api.get<PaginatedResult<Strategy>>(`/strategy?${buildQuery(next)}`);
      if (!res.success) { set({ isLoading: false }); return; }

      set((s) => ({
        strategies: [...s.strategies, ...(res.data.items ?? [])],
        page:       next,
        hasMore:    res.data.hasNext ?? false,
        isLoading:  false,
      }));
    } catch (err) {
      console.error("[strategyStore.loadMore]", err);
      set({ isLoading: false });
    }
  },

  // ── Feeds ─────────────────────────────────────────────────────────────

  discoverStrategies: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<PaginatedResult<Strategy>>(`/strategy?${buildQuery(1, filters)}`);
      if (!res.success) { set({ isLoading: false, error: res.error }); return; }
      set({ strategies: res.data.items ?? [], page: 1, hasMore: res.data.hasNext ?? false, isLoading: false, error: null });
    } catch (err) {
      console.error("[strategyStore.discoverStrategies]", err);
      set({ isLoading: false, error: "Failed to load strategies" });
    }
  },

  getMyStrategies: async () => {
    try {
      const res = await api.get<PaginatedResult<Strategy>>(`/strategy/my?page=1&pageSize=${PAGE_SIZE}`);
      if (res.success) set({ myStrategies: res.data.items ?? [] });
    } catch (err) {
      console.error("[strategyStore.getMyStrategies]", err);
    }
  },

  getSavedStrategies: async () => {
    try {
      const res = await api.get<PaginatedResult<Strategy>>(`/strategy/saved?page=1&pageSize=${PAGE_SIZE}`);
      if (res.success) set({ savedStrategies: res.data.items ?? [] });
    } catch (err) {
      console.error("[strategyStore.getSavedStrategies]", err);
    }
  },

  getPlaybook: async () => {
    try {
      const res = await api.get<PaginatedResult<Strategy>>(`/strategy/playbook?page=1&pageSize=${PAGE_SIZE}`);
      if (res.success) set({ playbook: res.data.items ?? [] });
    } catch (err) {
      console.error("[strategyStore.getPlaybook]", err);
    }
  },

  // ── CRUD ──────────────────────────────────────────────────────────────

  createStrategy: async (input) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await api.post<Strategy>("/strategy", input);
      if (!res.success) { set({ isSyncing: false, error: res.error }); return null; }
      set((s) => ({ strategies: [res.data, ...s.strategies], myStrategies: [res.data, ...s.myStrategies], isSyncing: false }));
      return res.data;
    } catch (err) {
      console.error("[strategyStore.createStrategy]", err);
      set({ isSyncing: false, error: "Failed to create strategy" });
      return null;
    }
  },

  updateStrategy: async (id, input) => {
    const prev = snapshot(get());
    set(patchEverywhere(prev, id, input as Partial<Strategy>));

    try {
      const res = await api.put<Strategy>(`/strategy/${id}`, input);
      if (!res.success) { set({ ...prev, error: res.error }); return; }
      set((s) => patchEverywhere(snapshot(s), id, res.data));
    } catch (err) {
      console.error("[strategyStore.updateStrategy]", err);
      set({ ...prev, error: "Failed to update strategy" });
    }
  },

  deleteStrategy: async (id) => {
    const prev = snapshot(get());
    const strip = (arr: Strategy[]) => arr.filter((s) => s.id !== id);
    set({
      strategies:      strip(prev.strategies),
      myStrategies:    strip(prev.myStrategies),
      savedStrategies: strip(prev.savedStrategies),
      playbook:        strip(prev.playbook),
    });

    try {
      const res = await api.delete<null>(`/strategy/${id}`);
      if (!res.success) set({ ...prev, error: res.error });
    } catch (err) {
      console.error("[strategyStore.deleteStrategy]", err);
      set({ ...prev, error: "Failed to delete strategy" });
    }
  },

  // ── Save / playbook ───────────────────────────────────────────────────

  toggleSave: async (strategyId) => {
    const prev = snapshot(get());
    const target = prev.strategies.find((s) => s.id === strategyId) ?? prev.savedStrategies.find((s) => s.id === strategyId);
    const wasSaved = target?.isSaved ?? false;
    set(patchEverywhere(prev, strategyId, { isSaved: !wasSaved }));

    try {
      const res = await api.post<{ saved: boolean }>(`/strategy/${strategyId}/save`);
      if (!res.success) { set({ ...prev, error: res.error }); return; }
      set((s) => patchEverywhere(snapshot(s), strategyId, { isSaved: res.data.saved }));
      get().getSavedStrategies();
    } catch (err) {
      console.error("[strategyStore.toggleSave]", err);
      set({ ...prev, error: "Failed to toggle save" });
    }
  },

  togglePlaybook: async (strategyId) => {
    const prev = snapshot(get());
    const target = prev.strategies.find((s) => s.id === strategyId) ?? prev.savedStrategies.find((s) => s.id === strategyId);
    const wasIn = target?.isInPlaybook ?? false;
    set(patchEverywhere(prev, strategyId, { isInPlaybook: !wasIn }));

    try {
      const res = await api.post<{ inPlaybook: boolean }>(`/strategy/${strategyId}/playbook`);
      if (!res.success) { set({ ...prev, error: res.error }); return; }
      set((s) => patchEverywhere(snapshot(s), strategyId, { isInPlaybook: res.data.inPlaybook }));
      get().getPlaybook();
    } catch (err) {
      console.error("[strategyStore.togglePlaybook]", err);
      set({ ...prev, error: "Failed to toggle playbook" });
    }
  },

  // ── Reviews ───────────────────────────────────────────────────────────

  addReview: async (strategyId, review) => {
    try {
      const res = await api.post<StrategyReview>(`/strategy/${strategyId}/reviews`, review);
      if (!res.success) { set({ error: res.error }); return null; }
      set((s) => bumpReviewCount(snapshot(s), strategyId));
      return res.data;
    } catch (err) {
      console.error("[strategyStore.addReview]", err);
      set({ error: "Failed to add review" });
      return null;
    }
  },

  getReviews: async (strategyId, page = 1) => {
    try {
      const res = await api.get<PaginatedResult<StrategyReview>>(`/strategy/${strategyId}/reviews?page=${page}&pageSize=${PAGE_SIZE}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[strategyStore.getReviews]", err);
      return null;
    }
  },
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
    if (prevUserId) useStrategyStore.getState().init();

    useAuthStore.subscribe((state) => {
      const userId = state.user?.id;
      if (userId !== prevUserId) {
        prevUserId = userId;
        if (userId) {
          useStrategyStore.getState().init();
        } else {
          useStrategyStore.getState().reset();
        }
      }
    });
  });
}
