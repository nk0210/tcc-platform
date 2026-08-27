/**
 * Community Interaction Service
 * Toggles for likes, bookmarks, and share tracking.
 */
import { communityInteractionRepository } from "../repositories/communityInteractionRepository";
import { communityPostRepository }        from "../repositories/communityPostRepository";
import { communityCommentRepository }     from "../repositories/communityCommentRepository";
import { createNotification }             from "../notifications/notificationService";

export class PostNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("POST_NOT_FOUND"); }
}
export class CommentNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("COMMENT_NOT_FOUND"); }
}

export const communityInteractionService = {
  // ── Toggle post like ──────────────────────────────────────────────────────

  async togglePostLike(postId: string, userId: string) {
    const post = await communityPostRepository.findById(postId);
    if (!post || post.isHiddenByAdmin) throw new PostNotFoundError();

    const already = await communityInteractionRepository.isPostLiked(userId, postId);

    if (already) {
      await communityInteractionRepository.unlikePost(userId, postId);
    } else {
      await communityInteractionRepository.likePost(userId, postId);

      // Notify post author (but not self-like)
      if (post.authorId !== userId) {
        await createNotification({
          userId:      post.authorId,
          type:        "COMMUNITY",
          priority:    "LOW",
          title:       "Someone liked your post",
          message:     "Your post received a new like.",
          actionLabel: "View",
          actionPath:  `/community/posts/${postId}`,
        });
      }
    }

    const count = await communityInteractionRepository.postLikeCount(postId);
    return { liked: !already, likeCount: count };
  },

  // ── Toggle comment like ───────────────────────────────────────────────────

  async toggleCommentLike(commentId: string, userId: string) {
    const comment = await communityCommentRepository.findById(commentId);
    if (!comment || comment.isHiddenByAdmin) throw new CommentNotFoundError();

    const already = await communityInteractionRepository.isCommentLiked(userId, commentId);

    if (already) {
      await communityInteractionRepository.unlikeComment(userId, commentId);
    } else {
      await communityInteractionRepository.likeComment(userId, commentId);
    }

    const count = await communityInteractionRepository.commentLikeCount(commentId);
    return { liked: !already, likeCount: count };
  },

  // ── Toggle bookmark ───────────────────────────────────────────────────────

  async toggleBookmark(postId: string, userId: string) {
    const post = await communityPostRepository.findById(postId);
    if (!post || post.isHiddenByAdmin) throw new PostNotFoundError();

    const already = await communityInteractionRepository.isBookmarked(userId, postId);

    if (already) {
      await communityInteractionRepository.removeBookmark(userId, postId);
    } else {
      await communityInteractionRepository.bookmarkPost(userId, postId);
    }

    const count = await communityInteractionRepository.bookmarkCount(postId);
    return { bookmarked: !already, bookmarkCount: count };
  },

  // ── Track share ───────────────────────────────────────────────────────────

  async trackShare(postId: string, userId: string) {
    const post = await communityPostRepository.findById(postId);
    if (!post || post.isHiddenByAdmin) throw new PostNotFoundError();

    await communityInteractionRepository.trackShare(userId, postId);

    const count = await communityInteractionRepository.shareCount(postId);
    return { shared: true, shareCount: count };
  },
};