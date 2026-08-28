/**
 * TCC Community Store — Phase Alpha
 * API-backed. Global/following/saved feeds, likes, bookmarks, comments, follows.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

export type CommunityPostType =
  | "TEXT" | "TRADE_IDEA" | "SHARED_TRADE" | "ACADEMY_COMPLETION"
  | "STRATEGY_SHARE" | "COMPETITION_UPDATE";

export type PostVisibility = "PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE";

export interface CommunityAuthor {
  id:          string;
  handle:      string;
  displayName: string;
  avatarUrl:   string | null;
  isVerified:  boolean;
}

export interface TradeSnapshot {
  symbol:      string;
  displayName: string;
  side:        "BUY" | "SELL";
  lotSize:     number;
  entryPrice:  number;
  exitPrice:   number;
  netPnl:      number;
  closeReason: "MANUAL" | "STOP_LOSS" | "TAKE_PROFIT";
  durationMs:  number;
}

export interface CommunityPost {
  id:                   string;
  authorId:             string;
  type:                 CommunityPostType;
  content:              string;
  visibility:           PostVisibility;
  isHiddenByAdmin:      boolean;
  author:               CommunityAuthor;
  isLiked:              boolean;
  isBookmarked:         boolean;
  _count:               { likes: number; comments: number; shares: number };
  tags:                 string[];
  symbol:               string | null;
  tradeSnapshot:        TradeSnapshot | null;
  linkedTradeId:        string | null;
  linkedStrategyId:     string | null;
  linkedCourseId:       string | null;
  linkedCompetitionId:  string | null;
  linkedStrategyTitle:  string | null;
  linkedCourseTitle:    string | null;
  createdAt:            string;
  updatedAt:            string;
}

export interface CommunityComment {
  id:              string;
  postId:          string;
  authorId:        string;
  author:          CommunityAuthor;
  content:         string;
  isHiddenByAdmin: boolean;
  parentId:        string | null;
  isLiked:         boolean;
  _count:          { likes: number; replies: number };
  createdAt:       string;
  updatedAt:       string;
}

export interface CreatePostInput {
  type:                 CommunityPostType;
  content:              string;
  visibility?:          PostVisibility;
  linkedTradeId?:       string | null;
  linkedStrategyId?:    string | null;
  linkedCourseId?:      string | null;
  linkedCompetitionId?: string | null;
  tradeSnapshot?:       TradeSnapshot | null;
  linkedStrategyTitle?: string | null;
  linkedCourseTitle?:   string | null;
  symbol?:              string | null;
  tags?:                string[];
}

export interface UpdatePostInput {
  content?:    string;
  visibility?: PostVisibility;
  tags?:       string[];
}

export type FeedType = "global" | "following" | "saved";

interface PaginatedResult<T> {
  items:      T[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

export interface FollowStatus {
  targetId:       string;
  targetHandle:   string;
  isFollowing:    boolean;
  isFollowedBy:   boolean;
  isMutual:       boolean;
  followerCount:  number;
  followingCount: number;
}

const PAGE_SIZE = 20;

function feedPath(type: FeedType, page: number): string {
  const qs = `?page=${page}&pageSize=${PAGE_SIZE}`;
  if (type === "following") return `/community/posts/following${qs}`;
  if (type === "saved")     return `/community/posts/saved${qs}`;
  return `/community/posts${qs}`;
}

// ── Store ─────────────────────────────────────────────────────────────────

interface CommunityStore {
  posts:         CommunityPost[];
  feedType:      FeedType;
  page:          number;
  hasMore:       boolean;
  isLoading:     boolean;
  isSyncing:     boolean;
  isInitialized: boolean;
  error:         string | null;

  init:        () => Promise<void>;
  reset:       () => void;
  loadMore:    () => Promise<void>;
  setFeedType: (type: FeedType) => Promise<void>;

  createPost:     (input: CreatePostInput) => Promise<CommunityPost | null>;
  updatePost:     (postId: string, input: UpdatePostInput) => Promise<void>;
  deletePost:     (postId: string) => Promise<void>;
  toggleLike:     (postId: string) => Promise<void>;
  toggleBookmark: (postId: string) => Promise<void>;
  trackShare:     (postId: string) => Promise<void>;

  getComments:       (postId: string, page?: number) => Promise<PaginatedResult<CommunityComment> | null>;
  addComment:        (postId: string, content: string) => Promise<CommunityComment | null>;
  addReply:          (commentId: string, content: string) => Promise<CommunityComment | null>;
  toggleCommentLike: (commentId: string) => Promise<{ liked: boolean; likeCount: number } | null>;
  deleteComment:     (commentId: string) => Promise<void>;

  followUser:      (handle: string) => Promise<void>;
  unfollowUser:    (handle: string) => Promise<void>;
  getFollowStatus: (handle: string) => Promise<FollowStatus | null>;
}

export const useCommunityStore = create<CommunityStore>()((set, get) => ({
  posts:         [],
  feedType:      "global",
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
      const res = await api.get<PaginatedResult<CommunityPost>>(feedPath("global", 1));
      if (!res.success) {
        set({ isLoading: false, error: res.error, isInitialized: true });
        return;
      }
      set({
        posts:         res.data.items ?? [],
        page:          1,
        hasMore:       res.data.hasNext ?? false,
        isLoading:     false,
        isInitialized: true,
        error:         null,
      });
    } catch (err) {
      console.error("[communityStore.init]", err);
      set({ isLoading: false, error: "Failed to load community feed", isInitialized: true });
    }
  },

  reset: () =>
    set({
      posts: [], feedType: "global", page: 1, hasMore: false,
      isLoading: false, isSyncing: false, isInitialized: false, error: null,
    }),

  loadMore: async () => {
    const { page, hasMore, isLoading, feedType } = get();
    if (!hasMore || isLoading) return;

    const next = page + 1;
    set({ isLoading: true });

    try {
      const res = await api.get<PaginatedResult<CommunityPost>>(feedPath(feedType, next));
      if (!res.success) { set({ isLoading: false }); return; }

      set((s) => ({
        posts:     [...s.posts, ...(res.data.items ?? [])],
        page:      next,
        hasMore:   res.data.hasNext ?? false,
        isLoading: false,
      }));
    } catch (err) {
      console.error("[communityStore.loadMore]", err);
      set({ isLoading: false });
    }
  },

  setFeedType: async (type) => {
    if (get().feedType === type) return;
    set({ feedType: type, posts: [], page: 1, hasMore: false, isLoading: true, error: null });

    try {
      const res = await api.get<PaginatedResult<CommunityPost>>(feedPath(type, 1));
      if (!res.success) { set({ isLoading: false, error: res.error }); return; }
      set({ posts: res.data.items ?? [], page: 1, hasMore: res.data.hasNext ?? false, isLoading: false, error: null });
    } catch (err) {
      console.error("[communityStore.setFeedType]", err);
      set({ isLoading: false, error: "Failed to load feed" });
    }
  },

  // ── Post CRUD ────────────────────────────────────────────────────────────

  createPost: async (input) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await api.post<CommunityPost>("/community/posts", input);
      if (!res.success) { set({ isSyncing: false, error: res.error }); return null; }
      set((s) => ({ posts: [res.data, ...s.posts], isSyncing: false }));
      return res.data;
    } catch (err) {
      console.error("[communityStore.createPost]", err);
      set({ isSyncing: false, error: "Failed to create post" });
      return null;
    }
  },

  updatePost: async (postId, input) => {
    const prev = get().posts;
    set((s) => ({ posts: s.posts.map((p) => (p.id === postId ? { ...p, ...input } : p)) }));

    try {
      const res = await api.put<CommunityPost>(`/community/posts/${postId}`, input);
      if (!res.success) { set({ posts: prev, error: res.error }); return; }
      set((s) => ({ posts: s.posts.map((p) => (p.id === postId ? res.data : p)) }));
    } catch (err) {
      console.error("[communityStore.updatePost]", err);
      set({ posts: prev, error: "Failed to update post" });
    }
  },

  deletePost: async (postId) => {
    const prev = get().posts;
    set((s) => ({ posts: s.posts.filter((p) => p.id !== postId) }));

    try {
      const res = await api.delete<null>(`/community/posts/${postId}`);
      if (!res.success) set({ posts: prev, error: res.error });
    } catch (err) {
      console.error("[communityStore.deletePost]", err);
      set({ posts: prev, error: "Failed to delete post" });
    }
  },

  toggleLike: async (postId) => {
    const prev = get().posts;
    set((s) => ({
      posts: s.posts.map((p) =>
        p.id !== postId ? p : { ...p, isLiked: !p.isLiked, _count: { ...p._count, likes: p._count.likes + (p.isLiked ? -1 : 1) } }
      ),
    }));

    try {
      const res = await api.post<{ liked: boolean; likeCount: number }>(`/community/posts/${postId}/like`);
      if (!res.success) { set({ posts: prev, error: res.error }); return; }
      set((s) => ({
        posts: s.posts.map((p) =>
          p.id !== postId ? p : { ...p, isLiked: res.data.liked, _count: { ...p._count, likes: res.data.likeCount } }
        ),
      }));
    } catch (err) {
      console.error("[communityStore.toggleLike]", err);
      set({ posts: prev, error: "Failed to toggle like" });
    }
  },

  toggleBookmark: async (postId) => {
    const prev = get().posts;
    set((s) => ({ posts: s.posts.map((p) => (p.id !== postId ? p : { ...p, isBookmarked: !p.isBookmarked })) }));

    try {
      const res = await api.post<{ bookmarked: boolean; bookmarkCount: number }>(`/community/posts/${postId}/bookmark`);
      if (!res.success) { set({ posts: prev, error: res.error }); return; }
      set((s) => ({ posts: s.posts.map((p) => (p.id !== postId ? p : { ...p, isBookmarked: res.data.bookmarked })) }));
    } catch (err) {
      console.error("[communityStore.toggleBookmark]", err);
      set({ posts: prev, error: "Failed to toggle bookmark" });
    }
  },

  trackShare: async (postId) => {
    try {
      const res = await api.post<{ shared: boolean; shareCount: number }>(`/community/posts/${postId}/share`);
      if (res.success) {
        set((s) => ({
          posts: s.posts.map((p) => (p.id !== postId ? p : { ...p, _count: { ...p._count, shares: res.data.shareCount } })),
        }));
      }
    } catch (err) {
      console.error("[communityStore.trackShare]", err);
    }
  },

  // ── Comments ─────────────────────────────────────────────────────────────
  // Comments are not stored in global state — returned directly to the caller
  // (matches the spec: "returns paginated comments, not stored in global state").

  getComments: async (postId, page = 1) => {
    try {
      const res = await api.get<PaginatedResult<CommunityComment>>(
        `/community/posts/${postId}/comments?page=${page}&pageSize=${PAGE_SIZE}`
      );
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[communityStore.getComments]", err);
      return null;
    }
  },

  addComment: async (postId, content) => {
    try {
      const res = await api.post<CommunityComment>(`/community/posts/${postId}/comments`, { content });
      if (!res.success) { set({ error: res.error }); return null; }
      set((s) => ({
        posts: s.posts.map((p) => (p.id !== postId ? p : { ...p, _count: { ...p._count, comments: p._count.comments + 1 } })),
      }));
      return res.data;
    } catch (err) {
      console.error("[communityStore.addComment]", err);
      set({ error: "Failed to add comment" });
      return null;
    }
  },

  addReply: async (commentId, content) => {
    try {
      const res = await api.post<CommunityComment>(`/community/comments/${commentId}/replies`, { content });
      if (!res.success) { set({ error: res.error }); return null; }
      return res.data;
    } catch (err) {
      console.error("[communityStore.addReply]", err);
      set({ error: "Failed to add reply" });
      return null;
    }
  },

  toggleCommentLike: async (commentId) => {
    try {
      const res = await api.post<{ liked: boolean; likeCount: number }>(`/community/comments/${commentId}/like`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[communityStore.toggleCommentLike]", err);
      return null;
    }
  },

  deleteComment: async (commentId) => {
    try {
      const res = await api.delete<null>(`/community/comments/${commentId}`);
      if (!res.success) set({ error: res.error });
    } catch (err) {
      console.error("[communityStore.deleteComment]", err);
      set({ error: "Failed to delete comment" });
    }
  },

  // ── Follow ───────────────────────────────────────────────────────────────

  followUser: async (handle) => {
    try {
      const res = await api.post<{ following: boolean }>(`/community/follow/${handle}`);
      if (!res.success) set({ error: res.error });
    } catch (err) {
      console.error("[communityStore.followUser]", err);
      set({ error: "Failed to follow user" });
    }
  },

  unfollowUser: async (handle) => {
    try {
      const res = await api.delete<{ following: boolean }>(`/community/follow/${handle}`);
      if (!res.success) set({ error: res.error });
    } catch (err) {
      console.error("[communityStore.unfollowUser]", err);
      set({ error: "Failed to unfollow user" });
    }
  },

  getFollowStatus: async (handle) => {
    try {
      const res = await api.get<FollowStatus>(`/community/follow/${handle}/status`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[communityStore.getFollowStatus]", err);
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
          useCommunityStore.getState().init();
        } else {
          useCommunityStore.getState().reset();
        }
      }
    });
  });
}
