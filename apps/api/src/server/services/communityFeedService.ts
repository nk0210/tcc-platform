/**
 * Community Feed Service
 * Handles all feed queries: global, following, user profile, saved.
 */
import { communityPostRepository, type FeedParams } from "../repositories/communityPostRepository";
import { communityFollowRepository }                from "../repositories/communityFollowRepository";
import db from "../../lib/prisma";

type RawPost = { likes?: { userId: string }[]; savedBy?: { userId: string }[]; [key: string]: unknown };

function fmt(post: RawPost) {
  const { likes, savedBy, ...rest } = post;
  return {
    ...rest,
    isLiked:      Array.isArray(likes)   ? likes.length   > 0 : false,
    isBookmarked: Array.isArray(savedBy) ? savedBy.length > 0 : false,
  };
}

function paginate(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize);
  return { total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

export const communityFeedService = {
  // ── Global public feed ────────────────────────────────────────────────────

  async getGlobalFeed(params: FeedParams, viewerId?: string) {
    const { items, total } = await communityPostRepository.findGlobalFeed(params, viewerId);
    return { items: items.map((p) => fmt(p as RawPost)), ...paginate(total, params.page, params.pageSize) };
  },

  // ── Following feed ────────────────────────────────────────────────────────

  async getFollowingFeed(userId: string, params: FeedParams) {
    const { items, total } = await communityPostRepository.findFollowingFeed(userId, params);
    return { items: items.map((p) => fmt(p as RawPost)), ...paginate(total, params.page, params.pageSize) };
  },

  // ── User profile feed ─────────────────────────────────────────────────────

  async getUserFeed(handle: string, viewerId: string | undefined, params: FeedParams) {
    const author = await db.user.findUnique({
      where:  { handle },
      select: { id: true, profileVisibility: true, isActive: true },
    });

    if (!author || !author.isActive) {
      return { items: [], total: 0, page: params.page, pageSize: params.pageSize, totalPages: 0, hasNext: false, hasPrev: false };
    }

    const isSelf      = viewerId === author.id;
    const isFollowing = viewerId
      ? await communityFollowRepository.isFollowing(viewerId, author.id)
      : false;

    const { items, total } = await communityPostRepository.findByAuthor(
      author.id,
      viewerId,
      isSelf,
      isFollowing,
      params
    );

    return { items: items.map((p) => fmt(p as RawPost)), ...paginate(total, params.page, params.pageSize) };
  },

  // ── Saved / bookmarked posts ──────────────────────────────────────────────

  async getSavedFeed(userId: string, params: FeedParams) {
    const { items, total } = await communityPostRepository.findSavedByUser(userId, params);
    return { items: items.map((p) => fmt(p as RawPost)), ...paginate(total, params.page, params.pageSize) };
  },
};