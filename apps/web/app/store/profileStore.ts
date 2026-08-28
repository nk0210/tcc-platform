/**
 * TCC Profile Store — Phase Alpha
 * API-backed own profile + visibility-gated public profile lookups.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

export type Visibility      = "PUBLIC" | "PRIVATE" | "FOLLOWERS_ONLY";
export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PROFESSIONAL";

export interface SocialLinks {
  website:   string | null;
  x:         string | null;
  linkedin:  string | null;
  youtube:   string | null;
  instagram: string | null;
}

export interface TradingIdentity {
  marketsTraded:     string[];
  symbolsTraded:     string[];
  strategiesUsed:    string[];
  preferredSessions: string[];
}

export interface UserProfile {
  id:                  string;
  tccId:               string;
  email:               string;
  handle:              string;
  displayName:         string;
  bio:                 string;
  location:            string;
  avatarUrl:           string | null;
  roles:               string[];
  status:              string;
  isVerified:          boolean;
  profileVisibility:   Visibility;
  portfolioVisibility: Visibility;
  experienceLevel:     ExperienceLevel | null;
  permissions:         string[];
  socialLinks:         SocialLinks | null;
  tradingIdentity:     TradingIdentity | null;
  _count?:             { followedBy: number; following: number; posts: number; strategies: number };
  createdAt:           string;
  updatedAt:           string;
}

/** May be a limited shape (id/handle/displayName/avatarUrl/isPrivate) when the profile is not visible to the viewer. */
export interface PublicProfile {
  id:                 string;
  handle:             string;
  displayName:        string;
  avatarUrl:          string | null;
  isPrivate?:         boolean;
  bio?:               string;
  location?:          string;
  roles?:             string[];
  isVerified?:        boolean;
  profileVisibility?: Visibility;
  experienceLevel?:   ExperienceLevel | null;
  socialLinks?:       SocialLinks | null;
  tradingIdentity?:   TradingIdentity | null;
  _count?:            { followedBy: number; following: number };
}

export interface UpdateProfileInput {
  displayName?:         string;
  bio?:                 string;
  location?:            string;
  avatarUrl?:           string | null;
  profileVisibility?:   Visibility;
  portfolioVisibility?: Visibility;
  experienceLevel?:     ExperienceLevel | null;
}

export interface TradingStats {
  totalTrades:  number;
  closedTrades: number;
  openTrades:   number;
  totalNetPnl:  number;
}

export interface CompletenessResult {
  percentage:    number;
  missingFields: string[];
}

export interface SearchUser {
  id:          string;
  handle:      string;
  displayName: string;
  avatarUrl:   string | null;
  bio:         string;
  roles:       string[];
  isVerified:  boolean;
  _count:      { followedBy: number };
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

// ── Store ─────────────────────────────────────────────────────────────────

interface ProfileStore {
  myProfile:      UserProfile | null;
  publicProfiles: Record<string, PublicProfile>;
  isLoading:      boolean;
  isSyncing:      boolean;
  isInitialized:  boolean;
  error:          string | null;

  init:  () => Promise<void>;
  reset: () => void;

  updateProfile:         (input: UpdateProfileInput) => Promise<void>;
  updateSocialLinks:     (links: Partial<SocialLinks>) => Promise<void>;
  updateTradingIdentity: (identity: Partial<TradingIdentity>) => Promise<void>;

  getPublicProfile:  (handle: string) => Promise<PublicProfile | null>;
  getMyStats:        () => Promise<TradingStats | null>;
  getCompleteness:   () => Promise<CompletenessResult | null>;
  searchUsers:       (query: string, page?: number) => Promise<PaginatedResult<SearchUser> | null>;
  getSuggestedUsers: (page?: number) => Promise<PaginatedResult<SearchUser> | null>;
}

export const useProfileStore = create<ProfileStore>()((set, get) => ({
  myProfile:      null,
  publicProfiles: {},
  isLoading:      false,
  isSyncing:      false,
  isInitialized:  false,
  error:          null,

  // ── Init ──────────────────────────────────────────────────────────────

  init: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      const res = await api.get<UserProfile>("/profile/me");
      if (!res.success) {
        set({ isLoading: false, error: res.error, isInitialized: true });
        return;
      }
      set({ myProfile: res.data, isLoading: false, isInitialized: true, error: null });
    } catch (err) {
      console.error("[profileStore.init]", err);
      set({ isLoading: false, error: "Failed to load profile", isInitialized: true });
    }
  },

  reset: () =>
    set({
      myProfile: null, publicProfiles: {}, isLoading: false, isSyncing: false,
      isInitialized: false, error: null,
    }),

  // ── Updates (optimistic) ─────────────────────────────────────────────

  updateProfile: async (input) => {
    const prev = get().myProfile;
    if (prev) set({ myProfile: { ...prev, ...input } });
    set({ isSyncing: true, error: null });

    try {
      const res = await api.put<UserProfile>("/profile/me", input);
      if (!res.success) { set({ myProfile: prev, isSyncing: false, error: res.error }); return; }
      set({ myProfile: res.data, isSyncing: false });
    } catch (err) {
      console.error("[profileStore.updateProfile]", err);
      set({ myProfile: prev, isSyncing: false, error: "Failed to update profile" });
    }
  },

  updateSocialLinks: async (links) => {
    const prev = get().myProfile;
    if (prev) set({ myProfile: { ...prev, socialLinks: { ...prev.socialLinks, ...links } as SocialLinks } });
    set({ isSyncing: true, error: null });

    try {
      const res = await api.put<SocialLinks>("/profile/me/social-links", links);
      if (!res.success) { set({ myProfile: prev, isSyncing: false, error: res.error }); return; }
      set((s) => ({ myProfile: s.myProfile ? { ...s.myProfile, socialLinks: res.data } : s.myProfile, isSyncing: false }));
    } catch (err) {
      console.error("[profileStore.updateSocialLinks]", err);
      set({ myProfile: prev, isSyncing: false, error: "Failed to update social links" });
    }
  },

  updateTradingIdentity: async (identity) => {
    const prev = get().myProfile;
    if (prev) set({ myProfile: { ...prev, tradingIdentity: { ...prev.tradingIdentity, ...identity } as TradingIdentity } });
    set({ isSyncing: true, error: null });

    try {
      const res = await api.put<TradingIdentity>("/profile/me/trading-identity", identity);
      if (!res.success) { set({ myProfile: prev, isSyncing: false, error: res.error }); return; }
      set((s) => ({ myProfile: s.myProfile ? { ...s.myProfile, tradingIdentity: res.data } : s.myProfile, isSyncing: false }));
    } catch (err) {
      console.error("[profileStore.updateTradingIdentity]", err);
      set({ myProfile: prev, isSyncing: false, error: "Failed to update trading identity" });
    }
  },

  // ── Public lookups ────────────────────────────────────────────────────

  getPublicProfile: async (handle) => {
    try {
      const res = await api.get<PublicProfile>(`/profile/${handle}`);
      if (!res.success) { set({ error: res.error }); return null; }
      set((s) => ({ publicProfiles: { ...s.publicProfiles, [handle]: res.data } }));
      return res.data;
    } catch (err) {
      console.error("[profileStore.getPublicProfile]", err);
      set({ error: "Failed to load profile" });
      return null;
    }
  },

  getMyStats: async () => {
    try {
      const res = await api.get<TradingStats>("/profile/me/stats");
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[profileStore.getMyStats]", err);
      return null;
    }
  },

  getCompleteness: async () => {
    try {
      const res = await api.get<CompletenessResult>("/profile/me/completeness");
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[profileStore.getCompleteness]", err);
      return null;
    }
  },

  searchUsers: async (query, page = 1) => {
    try {
      const res = await api.get<PaginatedResult<SearchUser>>(
        `/profile/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${PAGE_SIZE}`
      );
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[profileStore.searchUsers]", err);
      return null;
    }
  },

  getSuggestedUsers: async (page = 1) => {
    try {
      const res = await api.get<PaginatedResult<SearchUser>>(`/profile/suggested?page=${page}&pageSize=${PAGE_SIZE}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[profileStore.getSuggestedUsers]", err);
      return null;
    }
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
          useProfileStore.getState().init();
        } else {
          useProfileStore.getState().reset();
        }
      }
    });
  });
}
