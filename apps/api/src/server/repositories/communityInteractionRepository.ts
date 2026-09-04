/**
 * Community Interaction Repository
 * Handles reactions (posts + comment likes), bookmarks, and share tracking.
 */
import db from "../../lib/prisma";
import type { ReactionType } from "@prisma/client";

export const communityInteractionRepository = {
  // ──────────────────────────────────────────────────────────────────────────
  // POST REACTIONS (TCC Social redesign — was a plain like, now a typed
  // reaction; see the ReactionType enum in schema.prisma)
  // ──────────────────────────────────────────────────────────────────────────

  /** Creates the user's reaction on this post, or switches its type if one
   *  already exists — never a second row (the composite PK on
   *  [userId, postId] already prevents that structurally). */
  async setPostReaction(userId: string, postId: string, type: ReactionType) {
    return db.postLike.upsert({
      where:  { userId_postId: { userId, postId } },
      create: { userId, postId, type },
      update: { type },
    });
  },

  /** deleteMany rather than delete so a double-remove race (e.g. two rapid
   *  clicks) is a harmless no-op instead of a thrown "record not found". */
  async removePostReaction(userId: string, postId: string) {
    return db.postLike.deleteMany({ where: { userId, postId } });
  },

  getPostReaction(userId: string, postId: string) {
    return db.postLike.findUnique({
      where:  { userId_postId: { userId, postId } },
      select: { type: true },
    });
  },

  postLikeCount(postId: string) {
    return db.postLike.count({ where: { postId } });
  },

  /** Per-type reaction counts for one post — powers the reaction picker's
   *  breakdown (e.g. "18 ❤️, 4 📈"). Bounded to one post at a time; feed-wide
   *  breakdowns are deliberately not computed (every feed card only needs
   *  the total + the viewer's own reaction, not the full per-type split). */
  async postReactionBreakdown(postId: string): Promise<Record<ReactionType, number>> {
    const rows = await db.postLike.groupBy({ by: ["type"], where: { postId }, _count: { _all: true } });
    const breakdown = { LIKE: 0, INSIGHTFUL: 0, BULLISH: 0, BEARISH: 0, CELEBRATE: 0, INTERESTING: 0 } as Record<ReactionType, number>;
    for (const row of rows) breakdown[row.type] = row._count._all;
    return breakdown;
  },

  // ──────────────────────────────────────────────────────────────────────────
  // COMMENT LIKES
  // ──────────────────────────────────────────────────────────────────────────

  async likeComment(userId: string, commentId: string) {
    return db.commentLike.create({ data: { userId, commentId } });
  },

  async unlikeComment(userId: string, commentId: string) {
    return db.commentLike.delete({
      where: { userId_commentId: { userId, commentId } },
    });
  },

  isCommentLiked(userId: string, commentId: string): Promise<boolean> {
    return db.commentLike
      .findUnique({ where: { userId_commentId: { userId, commentId } } })
      .then((r) => r !== null);
  },

  commentLikeCount(commentId: string) {
    return db.commentLike.count({ where: { commentId } });
  },

  // ──────────────────────────────────────────────────────────────────────────
  // BOOKMARKS (saved posts)
  // ──────────────────────────────────────────────────────────────────────────

  async bookmarkPost(userId: string, postId: string) {
    return db.savedPost.create({ data: { userId, postId } });
  },

  async removeBookmark(userId: string, postId: string) {
    return db.savedPost.delete({ where: { userId_postId: { userId, postId } } });
  },

  isBookmarked(userId: string, postId: string): Promise<boolean> {
    return db.savedPost
      .findUnique({ where: { userId_postId: { userId, postId } } })
      .then((r) => r !== null);
  },

  bookmarkCount(postId: string) {
    return db.savedPost.count({ where: { postId } });
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SHARES
  // ──────────────────────────────────────────────────────────────────────────

  async trackShare(userId: string, postId: string) {
    return db.postShare.upsert({
      where:  { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: { sharedAt: new Date() }, // refresh timestamp on re-share
    });
  },

  isShared(userId: string, postId: string): Promise<boolean> {
    return db.postShare
      .findUnique({ where: { userId_postId: { userId, postId } } })
      .then((r) => r !== null);
  },

  shareCount(postId: string) {
    return db.postShare.count({ where: { postId } });
  },
};