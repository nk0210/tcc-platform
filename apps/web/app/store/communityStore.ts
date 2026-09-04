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

export type ReactionType = "LIKE" | "INSIGHTFUL" | "BULLISH" | "BEARISH" | "CELEBRATE" | "INTERESTING";

export type FeedSort = "latest" | "trending";

export interface CommunityAuthor {
  id:          string;
  handle:      string;
  displayName: string;
  avatarUrl:   string | null;
  isVerified:  boolean;
}

/** A real closed trade being shared (SHARED_TRADE posts) — snapshotted at
 *  post-creation time from the trader's own journal/trade history. */
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

/** A trade the author hasn't (yet) taken — TRADE_IDEA posts. Stored in the
 *  same flexible `tradeSnapshot` JSON column as TradeSnapshot; `post.type`
 *  disambiguates which shape a given post's tradeSnapshot actually is,
 *  same pattern the backend already uses for tags/symbol/etc. Risk:reward
 *  is deliberately not stored — it's derived from entry/stopLoss/takeProfit
 *  at render time so it can never drift out of sync with the numbers it
 *  describes. */
export interface TradeIdeaSnapshot {
  symbol:      string;
  displayName: string;
  direction:   "LONG" | "SHORT";
  entry:       number;
  stopLoss:    number | null;
  takeProfit:  number | null;
  timeframe:   string | null;
}

/** The post a repost points at — embedded one level deep. Null on a normal
 *  post, and also null on a repost whose original was since deleted (the
 *  FK is nulled out server-side, so it reverts to reading as a plain post). */
export interface RepostEmbed {
  id:            string;
  authorId:      string;
  type:          CommunityPostType;
  content:       string;
  visibility:    PostVisibility;
  isHiddenByAdmin: boolean;
  author:        CommunityAuthor;
  tradeSnapshot: TradeSnapshot | TradeIdeaSnapshot | null;
  symbol:        string | null;
  tags:          string[];
  createdAt:     string;
  _count:        { likes: number; comments: number; shares: number };
}

export interface CommunityPost {
  id:                   string;
  authorId:             string;
  type:                 CommunityPostType;
  content:              string;
  visibility:           PostVisibility;
  isHiddenByAdmin:      boolean;
  author:               CommunityAuthor;
  repostOfId:           string | null;
  repostOf:             RepostEmbed | null;
  isLiked:              boolean;
  /** Which reaction (if any) the viewer has on this post — null if none.
   *  isLiked above is just `myReaction !== null`, kept for any caller that
   *  only cares whether the viewer reacted at all. */
  myReaction:           ReactionType | null;
  /** Full per-type breakdown — only populated on a single-post fetch
   *  (getPost), never on feed listings (see communityPostService.ts's
   *  getPost() doc comment on why: one groupBy per feed card doesn't scale). */
  reactions?:           Record<ReactionType, number>;
  isBookmarked:         boolean;
  _count:               { likes: number; comments: number; shares: number };
  tags:                 string[];
  symbol:               string | null;
  tradeSnapshot:        TradeSnapshot | TradeIdeaSnapshot | null;
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
  tradeSnapshot?:       TradeSnapshot | TradeIdeaSnapshot | null;
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

export interface CommunityUserSummary {
  id:          string;
  handle:      string;
  displayName: string;
  avatarUrl:   string | null;
  isVerified:  boolean;
  bio:         string;
  _count:      { followedBy: number; following: number };
}

export interface TrendingHashtag {
  tag:   string;
  count: number;
}

export interface SearchResults {
  people:   CommunityUserSummary[];
  posts:    CommunityPost[];
  hashtags: TrendingHashtag[];
}

const PAGE_SIZE = 20;

/** feedType filters are combined with an optional hashtag (`tag`, without
 *  the leading #) and sort mode — both additive query params the backend
 *  already accepts on all three feed endpoints. */
function feedPath(type: FeedType, page: number, tag?: string | null, sort?: FeedSort): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (tag) params.set("tag", tag);
  if (sort) params.set("sort", sort);
  const qs = `?${params.toString()}`;
  if (type === "following") return `/community/posts/following${qs}`;
  if (type === "saved")     return `/community/posts/saved${qs}`;
  return `/community/posts${qs}`;
}

// ── Store ─────────────────────────────────────────────────────────────────

interface CommunityStore {
  posts:         CommunityPost[];
  feedType:      FeedType;
  tag:           string | null;
  sort:          FeedSort;
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
  /** Re-fetches the current feed with a new hashtag filter and/or sort mode
   *  — pass `tag: null` to clear the hashtag filter. Omit a field to leave
   *  it unchanged. */
  setFilters: (filters: { tag?: string | null; sort?: FeedSort }) => Promise<void>;

  createPost:     (input: CreatePostInput) => Promise<CommunityPost | null>;
  getPost:        (postId: string) => Promise<CommunityPost | null>;
  updatePost:     (postId: string, input: UpdatePostInput) => Promise<void>;
  deletePost:     (postId: string) => Promise<void>;
  /** Sets/switches the viewer's reaction on a post; defaults to LIKE for
   *  simple heart-click callers. Calling with the reaction the viewer
   *  already has removes it (matches the backend's toggle/switch semantics). */
  toggleLike:     (postId: string, type?: ReactionType) => Promise<void>;
  toggleBookmark: (postId: string) => Promise<void>;
  trackShare:     (postId: string) => Promise<void>;
  /** Creates a real repost of `postId` on the caller's own feed, with an
   *  optional caption. Returns the new repost post, or null on failure. */
  repost:         (postId: string, caption?: string) => Promise<CommunityPost | null>;

  getComments:       (postId: string, page?: number) => Promise<PaginatedResult<CommunityComment> | null>;
  getReplies:        (commentId: string, page?: number) => Promise<PaginatedResult<CommunityComment> | null>;
  addComment:        (postId: string, content: string) => Promise<CommunityComment | null>;
  addReply:          (commentId: string, content: string) => Promise<CommunityComment | null>;
  editComment:       (commentId: string, content: string) => Promise<CommunityComment | null>;
  toggleCommentLike: (commentId: string) => Promise<{ liked: boolean; likeCount: number } | null>;
  deleteComment:     (commentId: string) => Promise<void>;

  followUser:      (handle: string) => Promise<void>;
  unfollowUser:    (handle: string) => Promise<void>;
  getFollowStatus: (handle: string) => Promise<FollowStatus | null>;
  getFollowers:    (page?: number) => Promise<PaginatedResult<CommunityUserSummary> | null>;
  getFollowing:    (page?: number) => Promise<PaginatedResult<CommunityUserSummary> | null>;
  getMutuals:      (page?: number) => Promise<PaginatedResult<CommunityUserSummary> | null>;
  getSuggestions:  (limit?: number) => Promise<CommunityUserSummary[]>;

  getUserFeed:          (handle: string, page?: number, type?: CommunityPostType) => Promise<PaginatedResult<CommunityPost> | null>;
  getTrendingHashtags:  (limit?: number) => Promise<TrendingHashtag[]>;
  search:               (q: string, limit?: number) => Promise<SearchResults>;

  blockUser:       (handle: string) => Promise<boolean>;
  unblockUser:     (handle: string) => Promise<boolean>;
  getBlockedUsers: (page?: number) => Promise<PaginatedResult<CommunityUserSummary> | null>;
  muteUser:        (handle: string) => Promise<boolean>;
  unmuteUser:      (handle: string) => Promise<boolean>;
  getMutedUsers:   (page?: number) => Promise<PaginatedResult<CommunityUserSummary> | null>;
}

export const useCommunityStore = create<CommunityStore>()((set, get) => ({
  posts:         [],
  feedType:      "global",
  tag:           null,
  sort:          "latest",
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
      posts: [], feedType: "global", tag: null, sort: "latest", page: 1, hasMore: false,
      isLoading: false, isSyncing: false, isInitialized: false, error: null,
    }),

  loadMore: async () => {
    const { page, hasMore, isLoading, feedType, tag, sort } = get();
    if (!hasMore || isLoading) return;

    const next = page + 1;
    set({ isLoading: true });

    try {
      const res = await api.get<PaginatedResult<CommunityPost>>(feedPath(feedType, next, tag, sort));
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
    const { tag, sort } = get();
    set({ feedType: type, posts: [], page: 1, hasMore: false, isLoading: true, error: null });

    try {
      const res = await api.get<PaginatedResult<CommunityPost>>(feedPath(type, 1, tag, sort));
      if (!res.success) { set({ isLoading: false, error: res.error }); return; }
      set({ posts: res.data.items ?? [], page: 1, hasMore: res.data.hasNext ?? false, isLoading: false, error: null });
    } catch (err) {
      console.error("[communityStore.setFeedType]", err);
      set({ isLoading: false, error: "Failed to load feed" });
    }
  },

  setFilters: async (filters) => {
    const current = get();
    const nextTag  = filters.tag  !== undefined ? filters.tag  : current.tag;
    const nextSort = filters.sort !== undefined ? filters.sort : current.sort;
    if (nextTag === current.tag && nextSort === current.sort) return;

    set({ tag: nextTag, sort: nextSort, posts: [], page: 1, hasMore: false, isLoading: true, error: null });

    try {
      const res = await api.get<PaginatedResult<CommunityPost>>(feedPath(current.feedType, 1, nextTag, nextSort));
      if (!res.success) { set({ isLoading: false, error: res.error }); return; }
      set({ posts: res.data.items ?? [], page: 1, hasMore: res.data.hasNext ?? false, isLoading: false, error: null });
    } catch (err) {
      console.error("[communityStore.setFilters]", err);
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

  getPost: async (postId) => {
    try {
      const res = await api.get<CommunityPost>(`/community/posts/${postId}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[communityStore.getPost]", err);
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

  toggleLike: async (postId, type = "LIKE") => {
    const prev = get().posts;
    const wasSameReaction = prev.find((p) => p.id === postId)?.myReaction === type;
    set((s) => ({
      posts: s.posts.map((p) =>
        p.id !== postId ? p : {
          ...p,
          myReaction: wasSameReaction ? null : type,
          isLiked:    !wasSameReaction,
          _count:     { ...p._count, likes: p._count.likes + (wasSameReaction ? -1 : p.myReaction ? 0 : 1) },
        }
      ),
    }));

    try {
      const res = await api.post<{ liked: boolean; reaction: ReactionType | null; likeCount: number }>(
        `/community/posts/${postId}/like`, { type }
      );
      if (!res.success) { set({ posts: prev, error: res.error }); return; }
      set((s) => ({
        posts: s.posts.map((p) =>
          p.id !== postId ? p : { ...p, isLiked: res.data.liked, myReaction: res.data.reaction, _count: { ...p._count, likes: res.data.likeCount } }
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

  repost: async (postId, caption) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await api.post<CommunityPost>(`/community/posts/${postId}/repost`, { caption });
      if (!res.success) { set({ isSyncing: false, error: res.error }); return null; }
      // The reposted-from post's share count moved too — reconcile it
      // locally alongside prepending the new repost, no extra fetch.
      set((s) => ({
        posts: [res.data, ...s.posts.map((p) => (p.id !== postId ? p : { ...p, _count: { ...p._count, shares: p._count.shares + 1 } }))],
        isSyncing: false,
      }));
      return res.data;
    } catch (err) {
      console.error("[communityStore.repost]", err);
      set({ isSyncing: false, error: "Failed to repost" });
      return null;
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

  getReplies: async (commentId, page = 1) => {
    try {
      const res = await api.get<PaginatedResult<CommunityComment>>(
        `/community/comments/${commentId}/replies?page=${page}&pageSize=${PAGE_SIZE}`
      );
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[communityStore.getReplies]", err);
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

  editComment: async (commentId, content) => {
    try {
      const res = await api.put<CommunityComment>(`/community/comments/${commentId}`, { content });
      if (!res.success) { set({ error: res.error }); return null; }
      return res.data;
    } catch (err) {
      console.error("[communityStore.editComment]", err);
      set({ error: "Failed to edit comment" });
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

  getFollowers: async (page = 1) => {
    try {
      const res = await api.get<PaginatedResult<CommunityUserSummary>>(`/community/followers?page=${page}&pageSize=${PAGE_SIZE}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[communityStore.getFollowers]", err);
      return null;
    }
  },

  getFollowing: async (page = 1) => {
    try {
      const res = await api.get<PaginatedResult<CommunityUserSummary>>(`/community/following?page=${page}&pageSize=${PAGE_SIZE}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[communityStore.getFollowing]", err);
      return null;
    }
  },

  getMutuals: async (page = 1) => {
    try {
      const res = await api.get<PaginatedResult<CommunityUserSummary>>(`/community/mutuals?page=${page}&pageSize=${PAGE_SIZE}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[communityStore.getMutuals]", err);
      return null;
    }
  },

  getSuggestions: async (limit = 5) => {
    try {
      const res = await api.get<{ items: CommunityUserSummary[] }>(`/community/suggestions?limit=${limit}`);
      return res.success ? res.data.items : [];
    } catch (err) {
      console.error("[communityStore.getSuggestions]", err);
      return [];
    }
  },

  // ── Discovery ────────────────────────────────────────────────────────────

  getUserFeed: async (handle, page = 1, type) => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (type) params.set("type", type);
      const res = await api.get<PaginatedResult<CommunityPost>>(`/community/users/${handle}/posts?${params.toString()}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[communityStore.getUserFeed]", err);
      return null;
    }
  },

  getTrendingHashtags: async (limit = 8) => {
    try {
      const res = await api.get<{ items: TrendingHashtag[] }>(`/community/posts/trending/hashtags?limit=${limit}`);
      return res.success ? res.data.items : [];
    } catch (err) {
      console.error("[communityStore.getTrendingHashtags]", err);
      return [];
    }
  },

  search: async (q, limit = 8) => {
    const empty: SearchResults = { people: [], posts: [], hashtags: [] };
    if (!q.trim()) return empty;
    try {
      const res = await api.get<SearchResults>(`/community/search?q=${encodeURIComponent(q.trim())}&limit=${limit}`);
      return res.success ? res.data : empty;
    } catch (err) {
      console.error("[communityStore.search]", err);
      return empty;
    }
  },

  // ── Block / mute ─────────────────────────────────────────────────────────

  blockUser: async (handle) => {
    try {
      const res = await api.post<{ blocked: boolean }>(`/community/block/${handle}`);
      if (res.success) set((s) => ({ posts: s.posts.filter((p) => p.author.handle !== handle) }));
      return res.success;
    } catch (err) {
      console.error("[communityStore.blockUser]", err);
      return false;
    }
  },

  unblockUser: async (handle) => {
    try {
      const res = await api.delete<{ blocked: boolean }>(`/community/block/${handle}`);
      return res.success;
    } catch (err) {
      console.error("[communityStore.unblockUser]", err);
      return false;
    }
  },

  getBlockedUsers: async (page = 1) => {
    try {
      const res = await api.get<PaginatedResult<CommunityUserSummary>>(`/community/blocked?page=${page}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[communityStore.getBlockedUsers]", err);
      return null;
    }
  },

  muteUser: async (handle) => {
    try {
      const res = await api.post<{ muted: boolean }>(`/community/mute/${handle}`);
      if (res.success) set((s) => ({ posts: s.posts.filter((p) => p.author.handle !== handle) }));
      return res.success;
    } catch (err) {
      console.error("[communityStore.muteUser]", err);
      return false;
    }
  },

  unmuteUser: async (handle) => {
    try {
      const res = await api.delete<{ muted: boolean }>(`/community/mute/${handle}`);
      return res.success;
    } catch (err) {
      console.error("[communityStore.unmuteUser]", err);
      return false;
    }
  },

  getMutedUsers: async (page = 1) => {
    try {
      const res = await api.get<PaginatedResult<CommunityUserSummary>>(`/community/muted?page=${page}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[communityStore.getMutedUsers]", err);
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
    if (prevUserId) useCommunityStore.getState().init();

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
