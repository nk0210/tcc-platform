/**
 * TCC Community Store
 *
 * Global localStorage key "tcc:community" — shared across users on the same
 * browser instance (appropriate for a local-first community demo).
 *
 * Phase Alpha: replace localStorage with WebSocket + PostgreSQL backend.
 *
 * No fake posts, likes, comments, or users.
 * authorId + authorHandle are set from the logged-in user at post time.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ── Global storage (not user-scoped — community is shared) ────────────────

const communityStorage = {
  getItem: (_name: string): string | null => {
    if (typeof window === "undefined") return null;
    try   { return localStorage.getItem("tcc:community"); }
    catch { return null; }
  },
  setItem: (_name: string, value: string): void => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem("tcc:community", value); }
    catch {}
  },
  removeItem: (_name: string): void => {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem("tcc:community"); }
    catch {}
  },
};

// ── Types ─────────────────────────────────────────────────────────────────

export type CommunityPostType =
  | "text"
  | "trade_idea"
  | "shared_trade"
  | "academy_completion"
  | "strategy_share"
  | "competition_update";

export type PostVisibility = "public" | "followers_only" | "private";

export interface CommunityComment {
  id:              string;
  postId:          string;
  authorId:        string;
  authorHandle:    string;
  content:         string;
  createdAt:       string;
  likes:           string[];   // array of userIds
  reportCount:     number;
  isHiddenByAdmin: boolean;
}

export interface TradeSnapshot {
  symbol:       string;
  displayName:  string;
  side:         "BUY" | "SELL";
  lotSize:      number;
  entryPrice:   number;
  exitPrice:    number;
  netPnl:       number;
  closeReason:  "manual" | "stop_loss" | "take_profit";
  durationMs:   number;
}

export interface CommunityPost {
  id:                    string;
  authorId:              string;
  authorHandle:          string;
  type:                  CommunityPostType;
  content:               string;
  createdAt:             string;
  updatedAt:             string;
  visibility:            PostVisibility;
  linkedTradeId?:        string;
  linkedStrategyId?:     string;
  linkedCourseId?:       string;
  linkedCompetitionId?:  string;
  tradeSnapshot?:        TradeSnapshot;
  linkedStrategyTitle?:  string;
  linkedCourseTitle?:    string;
  likes:                 string[];   // array of userIds
  savedBy:               string[];   // array of userIds
  comments:              CommunityComment[];
  reportCount:           number;
  isHiddenByAdmin:       boolean;
  tags:                  string[];
  symbol?:               string;
}

// ── Store ─────────────────────────────────────────────────────────────────

interface CommunityStore {
  posts: CommunityPost[];

  // Post CRUD
  createPost: (params: {
    authorId:             string;
    authorHandle:         string;
    type:                 CommunityPostType;
    content:              string;
    visibility:           PostVisibility;
    linkedTradeId?:       string;
    linkedStrategyId?:    string;
    linkedCourseId?:      string;
    linkedCompetitionId?: string;
    tradeSnapshot?:       TradeSnapshot;
    linkedStrategyTitle?: string;
    linkedCourseTitle?:   string;
    tags?:                string[];
    symbol?:              string;
  }) => CommunityPost;

  deletePost: (postId: string, authorId: string) => void;

  // Engagement
  toggleLikePost:    (postId: string, userId: string) => void;
  toggleSavePost:    (postId: string, userId: string) => void;
  addComment:        (postId: string, authorId: string, authorHandle: string, content: string) => void;
  deleteComment:     (postId: string, commentId: string, userId: string) => void;
  toggleLikeComment: (postId: string, commentId: string, userId: string) => void;

  // Moderation
  reportPost:    (postId: string)                    => void;
  reportComment: (postId: string, commentId: string) => void;
  hidePost:      (postId: string)                    => void;
  unhidePost:    (postId: string)                    => void;

  // Selectors
  getVisiblePosts: (viewerId: string, filterType?: CommunityPostType) => CommunityPost[];
  getSavedPosts:   (userId: string) => CommunityPost[];
  getUserPosts:    (userId: string) => CommunityPost[];
  isLiked:         (postId: string, userId: string) => boolean;
  isSaved:         (postId: string, userId: string) => boolean;
}

export const useCommunityStore = create<CommunityStore>()(
  persist(
    (set, get) => ({
      posts: [],

      createPost: (params) => {
        const now = new Date().toISOString();
        const post: CommunityPost = {
          id:                   `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          authorId:             params.authorId,
          authorHandle:         params.authorHandle,
          type:                 params.type,
          content:              params.content,
          createdAt:            now,
          updatedAt:            now,
          visibility:           params.visibility,
          linkedTradeId:        params.linkedTradeId,
          linkedStrategyId:     params.linkedStrategyId,
          linkedCourseId:       params.linkedCourseId,
          linkedCompetitionId:  params.linkedCompetitionId,
          tradeSnapshot:        params.tradeSnapshot,
          linkedStrategyTitle:  params.linkedStrategyTitle,
          linkedCourseTitle:    params.linkedCourseTitle,
          likes:                [],
          savedBy:              [],
          comments:             [],
          reportCount:          0,
          isHiddenByAdmin:      false,
          tags:                 params.tags ?? [],
          symbol:               params.symbol,
        };
        set((state) => ({ posts: [post, ...state.posts] }));
        return post;
      },

      deletePost: (postId, authorId) => {
        set((state) => ({
          posts: state.posts.filter(
            (p) => !(p.id === postId && p.authorId === authorId)
          ),
        }));
      },

      toggleLikePost: (postId, userId) => {
        set((state) => ({
          posts: state.posts.map((p) => {
            if (p.id !== postId) return p;
            return {
              ...p,
              likes: p.likes.includes(userId)
                ? p.likes.filter((id) => id !== userId)
                : [...p.likes, userId],
            };
          }),
        }));
      },

      toggleSavePost: (postId, userId) => {
        set((state) => ({
          posts: state.posts.map((p) => {
            if (p.id !== postId) return p;
            return {
              ...p,
              savedBy: p.savedBy.includes(userId)
                ? p.savedBy.filter((id) => id !== userId)
                : [...p.savedBy, userId],
            };
          }),
        }));
      },

      addComment: (postId, authorId, authorHandle, content) => {
        const now = new Date().toISOString();
        const comment: CommunityComment = {
          id:              `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          postId,
          authorId,
          authorHandle,
          content,
          createdAt:       now,
          likes:           [],
          reportCount:     0,
          isHiddenByAdmin: false,
        };
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id !== postId
              ? p
              : { ...p, comments: [...p.comments, comment], updatedAt: now }
          ),
        }));
      },

      deleteComment: (postId, commentId, userId) => {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id !== postId
              ? p
              : {
                  ...p,
                  comments: p.comments.filter(
                    (c) => !(c.id === commentId && c.authorId === userId)
                  ),
                }
          ),
        }));
      },

      toggleLikeComment: (postId, commentId, userId) => {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id !== postId
              ? p
              : {
                  ...p,
                  comments: p.comments.map((c) =>
                    c.id !== commentId
                      ? c
                      : {
                          ...c,
                          likes: c.likes.includes(userId)
                            ? c.likes.filter((id) => id !== userId)
                            : [...c.likes, userId],
                        }
                  ),
                }
          ),
        }));
      },

      reportPost: (postId) => {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id !== postId ? p : { ...p, reportCount: p.reportCount + 1 }
          ),
        }));
      },

      reportComment: (postId, commentId) => {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id !== postId
              ? p
              : {
                  ...p,
                  comments: p.comments.map((c) =>
                    c.id !== commentId
                      ? c
                      : { ...c, reportCount: c.reportCount + 1 }
                  ),
                }
          ),
        }));
      },

      hidePost: (postId) => {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id !== postId ? p : { ...p, isHiddenByAdmin: true }
          ),
        }));
      },

      unhidePost: (postId) => {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id !== postId ? p : { ...p, isHiddenByAdmin: false }
          ),
        }));
      },

      getVisiblePosts: (viewerId, filterType) => {
        return get()
          .posts.filter((p) => {
            if (p.isHiddenByAdmin) return false;
            if (filterType && p.type !== filterType) return false;
            if (p.visibility === "private" && p.authorId !== viewerId) return false;
            return true;
          })
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      },

      getSavedPosts: (userId) =>
        get()
          .posts.filter((p) => p.savedBy.includes(userId) && !p.isHiddenByAdmin)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),

      getUserPosts: (userId) =>
        get()
          .posts.filter((p) => p.authorId === userId && !p.isHiddenByAdmin)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),

      isLiked: (postId, userId) => {
        const post = get().posts.find((p) => p.id === postId);
        return post ? post.likes.includes(userId) : false;
      },

      isSaved: (postId, userId) => {
        const post = get().posts.find((p) => p.id === postId);
        return post ? post.savedBy.includes(userId) : false;
      },
    }),
    {
      name:    "community-store",
      storage: createJSONStorage(() => communityStorage),
    }
  )
);