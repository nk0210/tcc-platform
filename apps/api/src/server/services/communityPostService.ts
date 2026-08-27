/**
 * Community Post Service
 * All business logic for creating, reading, updating, and deleting posts.
 */
import {
  communityPostRepository,
  type CreatePostInput,
  type UpdatePostInput,
  type FeedParams,
} from "../repositories/communityPostRepository";
import { communityFollowRepository } from "../repositories/communityFollowRepository";
import { createNotification }  from "../notifications/notificationService";
import { createAuditLog }      from "../audit/auditService";

// ── Errors ────────────────────────────────────────────────────────────────

export class PostNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("POST_NOT_FOUND"); }
}
export class NotPostAuthorError extends Error {
  statusCode = 403;
  constructor() { super("NOT_POST_AUTHOR"); }
}

// ── Response formatter ────────────────────────────────────────────────────
// Collapses viewer-filtered `likes` / `savedBy` arrays into boolean flags.

type RawPost = {
  likes?:   { userId: string }[];
  savedBy?: { userId: string }[];
  [key: string]: unknown;
};

function fmt(post: RawPost) {
  const { likes, savedBy, ...rest } = post;
  return {
    ...rest,
    isLiked:      Array.isArray(likes)   ? likes.length   > 0 : false,
    isBookmarked: Array.isArray(savedBy) ? savedBy.length > 0 : false,
  };
}

// ── Pagination helper ─────────────────────────────────────────────────────

function paginate(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize);
  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// ── Service ───────────────────────────────────────────────────────────────

export const communityPostService = {
  // ── Create ───────────────────────────────────────────────────────────────

  async createPost(input: CreatePostInput) {
    const post = await communityPostRepository.create(input);
    return fmt(post as RawPost);
  },

  // ── Get single post (with visibility check) ───────────────────────────────

  async getPost(postId: string, viewerId?: string) {
    const post = await communityPostRepository.findById(postId, viewerId);

    if (!post || post.isHiddenByAdmin) throw new PostNotFoundError();

    // Visibility gate
    if (post.visibility === "PRIVATE" && post.authorId !== viewerId) {
      throw new PostNotFoundError();
    }

    if (post.visibility === "FOLLOWERS_ONLY" && post.authorId !== viewerId) {
      if (!viewerId) throw new PostNotFoundError();
      const following = await communityFollowRepository.isFollowing(viewerId, post.authorId);
      if (!following) throw new PostNotFoundError();
    }

    return fmt(post as RawPost);
  },

  // ── Update post (author only) ─────────────────────────────────────────────

  async updatePost(postId: string, userId: string, input: UpdatePostInput) {
    const post = await communityPostRepository.findById(postId);
    if (!post) throw new PostNotFoundError();
    if (post.authorId !== userId) throw new NotPostAuthorError();

    const updated = await communityPostRepository.update(postId, input);
    return fmt(updated as RawPost);
  },

  // ── Delete post (author or admin) ─────────────────────────────────────────

  async deletePost(
    postId:   string,
    userId:   string,
    isAdmin:  boolean,
    actor?:   { actorHandle: string; actorRole: string }
  ) {
    const post = await communityPostRepository.findById(postId);
    if (!post) throw new PostNotFoundError();

    if (post.authorId !== userId && !isAdmin) throw new NotPostAuthorError();

    // Audit log for admin deletes
    if (isAdmin && post.authorId !== userId && actor) {
      await createAuditLog({
        actorId:      userId,
        actorHandle:  actor.actorHandle,
        actorRole:    actor.actorRole,
        actionType:   "community_post_admin_deleted",
        targetType:   "post",
        targetId:     postId,
        targetUserId: post.authorId,
        description:  `Admin deleted post by @${"handle" in post.author ? (post.author as { handle: string }).handle : "unknown"}`,
      });
    }

    await communityPostRepository.delete(postId);
  },

  // ── Admin: hide post ─────────────────────────────────────────────────────

  async hidePost(
    postId:      string,
    actor:       { actorId: string; actorHandle: string; actorRole: string },
    reason?:     string
  ) {
    const post = await communityPostRepository.findById(postId);
    if (!post) throw new PostNotFoundError();

    await communityPostRepository.setHidden(postId, true);

    await createAuditLog({
      actorId:      actor.actorId,
      actorHandle:  actor.actorHandle,
      actorRole:    actor.actorRole,
      actionType:   "community_post_hidden",
      targetType:   "post",
      targetId:     postId,
      targetUserId: post.authorId,
      description:  `Post hidden by admin`,
      reason,
    });

    // Notify the author
    await createNotification({
      userId:      post.authorId,
      type:        "ADMIN",
      priority:    "MEDIUM",
      title:       "Your post has been hidden",
      message:     reason ?? "Your post was hidden by a moderator.",
      actionLabel: undefined,
      actionPath:  undefined,
    });
  },

  // ── Admin: unhide post ────────────────────────────────────────────────────

  async unhidePost(postId: string, actor: { actorId: string; actorHandle: string; actorRole: string }) {
    const post = await communityPostRepository.findById(postId);
    if (!post) throw new PostNotFoundError();

    await communityPostRepository.setHidden(postId, false);

    await createAuditLog({
      actorId:      actor.actorId,
      actorHandle:  actor.actorHandle,
      actorRole:    actor.actorRole,
      actionType:   "community_post_unhidden",
      targetType:   "post",
      targetId:     postId,
      targetUserId: post.authorId,
      description:  "Post unhidden by admin",
    });
  },
};