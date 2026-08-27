/**
 * Community Comment Service
 * Business logic for comments and nested replies.
 */
import { communityCommentRepository } from "../repositories/communityCommentRepository";
import { communityPostRepository }    from "../repositories/communityPostRepository";
import { createNotification }         from "../notifications/notificationService";
import { createAuditLog }             from "../audit/auditService";

// ── Errors ────────────────────────────────────────────────────────────────

export class CommentNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("COMMENT_NOT_FOUND"); }
}
export class NotCommentAuthorError extends Error {
  statusCode = 403;
  constructor() { super("NOT_COMMENT_AUTHOR"); }
}
export class PostNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("POST_NOT_FOUND"); }
}

// ── Formatter ─────────────────────────────────────────────────────────────

type RawComment = { likes?: { userId: string }[]; [key: string]: unknown };

function fmt(comment: RawComment) {
  const { likes, ...rest } = comment;
  return { ...rest, isLiked: Array.isArray(likes) ? likes.length > 0 : false };
}

function paginate(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize);
  return { total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

// ── Service ───────────────────────────────────────────────────────────────

export const communityCommentService = {
  // ── Add comment (top-level or reply) ─────────────────────────────────────

  async addComment(
    postId:   string,
    authorId: string,
    content:  string,
    parentId?: string | null
  ) {
    const post = await communityPostRepository.findById(postId);
    if (!post || post.isHiddenByAdmin) throw new PostNotFoundError();

    // If replying, verify parent comment exists and belongs to same post
    if (parentId) {
      const parent = await communityCommentRepository.findById(parentId);
      if (!parent || parent.postId !== postId) throw new CommentNotFoundError();
    }

    const comment = await communityCommentRepository.create({
      postId,
      authorId,
      content,
      parentId: parentId ?? null,
    });

    // Notification: notify post author (unless commenter is the author)
    if (post.authorId !== authorId && !parentId) {
      await createNotification({
        userId:      post.authorId,
        type:        "COMMUNITY",
        priority:    "LOW",
        title:       "New comment on your post",
        message:     `Someone commented on your post.`,
        actionLabel: "View",
        actionPath:  `/community/posts/${postId}`,
      });
    }

    // Notification: notify parent comment author on reply (if different from post author and current user)
    if (parentId) {
      const parent = await communityCommentRepository.findById(parentId);
      if (parent && parent.authorId !== authorId) {
        await createNotification({
          userId:      parent.authorId,
          type:        "COMMUNITY",
          priority:    "LOW",
          title:       "Someone replied to your comment",
          message:     `You have a new reply.`,
          actionLabel: "View",
          actionPath:  `/community/posts/${postId}`,
        });
      }
    }

    return fmt(comment as RawComment);
  },

  // ── List top-level comments for a post ────────────────────────────────────

  async getComments(postId: string, page: number, pageSize: number, viewerId?: string) {
    const { items, total } = await communityCommentRepository.findByPost(postId, page, pageSize, viewerId);
    return { items: items.map((c) => fmt(c as RawComment)), ...paginate(total, page, pageSize) };
  },

  // ── List replies for a comment ────────────────────────────────────────────

  async getReplies(commentId: string, page: number, pageSize: number, viewerId?: string) {
    const comment = await communityCommentRepository.findById(commentId);
    if (!comment) throw new CommentNotFoundError();

    const { items, total } = await communityCommentRepository.findReplies(commentId, page, pageSize, viewerId);
    return { items: items.map((c) => fmt(c as RawComment)), ...paginate(total, page, pageSize) };
  },

  // ── Edit comment (author only) ────────────────────────────────────────────

  async editComment(commentId: string, userId: string, content: string) {
    const comment = await communityCommentRepository.findById(commentId);
    if (!comment) throw new CommentNotFoundError();
    if (comment.authorId !== userId) throw new NotCommentAuthorError();

    const updated = await communityCommentRepository.update(commentId, content);
    return fmt(updated as RawComment);
  },

  // ── Delete comment (author or admin) ─────────────────────────────────────

  async deleteComment(
    commentId: string,
    userId:    string,
    isAdmin:   boolean,
    actor?:    { actorHandle: string; actorRole: string }
  ) {
    const comment = await communityCommentRepository.findById(commentId);
    if (!comment) throw new CommentNotFoundError();
    if (comment.authorId !== userId && !isAdmin) throw new NotCommentAuthorError();

    // Orphan replies so they become top-level instead of cascading delete
    await communityCommentRepository.orphanReplies(commentId);

    if (isAdmin && comment.authorId !== userId && actor) {
      await createAuditLog({
        actorId:      userId,
        actorHandle:  actor.actorHandle,
        actorRole:    actor.actorRole,
        actionType:   "community_comment_admin_deleted",
        targetType:   "comment",
        targetId:     commentId,
        targetUserId: comment.authorId,
        description:  "Admin deleted comment",
      });
    }

    await communityCommentRepository.delete(commentId);
  },

  // ── Admin: hide comment ───────────────────────────────────────────────────

  async hideComment(
    commentId: string,
    actor:     { actorId: string; actorHandle: string; actorRole: string },
    reason?:   string
  ) {
    const comment = await communityCommentRepository.findById(commentId);
    if (!comment) throw new CommentNotFoundError();

    await communityCommentRepository.setHidden(commentId, true);

    await createAuditLog({
      actorId:      actor.actorId,
      actorHandle:  actor.actorHandle,
      actorRole:    actor.actorRole,
      actionType:   "community_comment_hidden",
      targetType:   "comment",
      targetId:     commentId,
      targetUserId: comment.authorId,
      description:  "Comment hidden by admin",
      reason,
    });
  },
};