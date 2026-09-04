/**
 * Community Interaction Service
 * Reactions, comment likes, bookmarks, and share tracking.
 */
import { communityInteractionRepository } from "../repositories/communityInteractionRepository";
import { communityPostRepository }        from "../repositories/communityPostRepository";
import { communityCommentRepository }     from "../repositories/communityCommentRepository";
import { createNotification }             from "../notifications/notificationService";
import type { ReactionType } from "@prisma/client";

export class PostNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("POST_NOT_FOUND"); }
}
export class CommentNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("COMMENT_NOT_FOUND"); }
}

export const communityInteractionService = {
  // ── Post reactions ───────────────────────────────────────────────────────
  // `type` defaults to LIKE so every pre-existing caller (the REST route's
  // old no-body toggle, the Copilot toggle_post_like tool) keeps behaving
  // exactly as it did before reactions existed — same single-heart toggle,
  // just recorded with an explicit type now instead of an implicit one.

  async togglePostLike(postId: string, userId: string, type: ReactionType = "LIKE") {
    const post = await communityPostRepository.findById(postId);
    if (!post || post.isHiddenByAdmin) throw new PostNotFoundError();

    const existing = await communityInteractionRepository.getPostReaction(userId, postId);
    const isSameReaction = existing?.type === type;

    if (isSameReaction) {
      // Clicking the reaction you already have removes it.
      await communityInteractionRepository.removePostReaction(userId, postId);
    } else {
      await communityInteractionRepository.setPostReaction(userId, postId, type);

      // Notify the post author only the first time this user reacts to it —
      // switching from one reaction type to another isn't a "new" reaction
      // worth a fresh notification, same restraint the old boolean like had.
      if (!existing && post.authorId !== userId) {
        await createNotification({
          userId:      post.authorId,
          type:        "COMMUNITY",
          priority:    "LOW",
          title:       "Someone reacted to your post",
          message:     "Your post received a new reaction.",
          actionLabel: "View",
          actionPath:  `/community/posts/${postId}`,
        });
      }
    }

    const [count, reactions] = await Promise.all([
      communityInteractionRepository.postLikeCount(postId),
      communityInteractionRepository.postReactionBreakdown(postId),
    ]);

    return {
      liked:     !isSameReaction,
      reaction:  isSameReaction ? null : type,
      likeCount: count,
      reactions,
    };
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