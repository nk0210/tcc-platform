/**
 * Community Interaction Repository
 * Handles likes (posts + comments), bookmarks, and share tracking.
 */
import db from "../../lib/prisma";

export const communityInteractionRepository = {
  // ──────────────────────────────────────────────────────────────────────────
  // POST LIKES
  // ──────────────────────────────────────────────────────────────────────────

  async likePost(userId: string, postId: string) {
    return db.postLike.create({ data: { userId, postId } });
  },

  async unlikePost(userId: string, postId: string) {
    return db.postLike.delete({ where: { userId_postId: { userId, postId } } });
  },

  isPostLiked(userId: string, postId: string): Promise<boolean> {
    return db.postLike
      .findUnique({ where: { userId_postId: { userId, postId } } })
      .then((r) => r !== null);
  },

  postLikeCount(postId: string) {
    return db.postLike.count({ where: { postId } });
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