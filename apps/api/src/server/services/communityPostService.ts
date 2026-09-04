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
import { communityInteractionRepository } from "../repositories/communityInteractionRepository";
import { createNotification }  from "../notifications/notificationService";
import { createAuditLog }      from "../audit/auditService";
import type { ReactionType } from "@prisma/client";

// ── Errors ────────────────────────────────────────────────────────────────

export class PostNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("POST_NOT_FOUND"); }
}
export class NotPostAuthorError extends Error {
  statusCode = 403;
  constructor() { super("NOT_POST_AUTHOR"); }
}
export class RepostNotAllowedError extends Error {
  statusCode = 400;
  constructor() { super("REPOST_NOT_ALLOWED"); }
}

// ── Response formatter ────────────────────────────────────────────────────
// Collapses viewer-filtered `likes` / `savedBy` arrays into boolean flags.

type RawPost = {
  likes?:   { userId: string; type: ReactionType }[];
  savedBy?: { userId: string }[];
  [key: string]: unknown;
};

function fmt(post: RawPost) {
  const { likes, savedBy, ...rest } = post;
  const myReaction = Array.isArray(likes) && likes.length > 0 ? likes[0].type : null;
  return {
    ...rest,
    // isLiked kept for backward compatibility (existing frontend/Copilot
    // callers that only care "did I react at all") — myReaction is the new,
    // more specific field the reaction-picker UI reads.
    isLiked:      myReaction !== null,
    myReaction,
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

  // ── Repost (share-as-repost) ───────────────────────────────────────────
  // Creates a real, standalone post that also points at the post it
  // reposts, with an optional caption. Only public, non-hidden posts can be
  // reposted — reposting a private/followers-only post would otherwise leak
  // it to the reposter's full audience. Reposting a repost re-points at the
  // ultimate original so the embedded quote card is never more than one
  // level deep.
  async createRepost(userId: string, postId: string, caption: string | undefined) {
    const original = await communityPostRepository.findById(postId);
    if (!original || original.isHiddenByAdmin) throw new PostNotFoundError();
    if (original.visibility !== "PUBLIC") throw new RepostNotAllowedError();

    const targetId = (original as { repostOfId?: string | null }).repostOfId ?? original.id;

    const post = await communityPostRepository.create({
      authorId:   userId,
      type:       "TEXT",
      content:    caption?.trim() ?? "",
      visibility: "PUBLIC",
      repostOfId: targetId,
    });

    // A repost is also a share — keep the original's share counter in sync
    // rather than maintaining two disjoint "this was shared" signals.
    await communityInteractionRepository.trackShare(userId, targetId);

    if (original.authorId !== userId) {
      await createNotification({
        userId:      original.authorId,
        type:        "COMMUNITY",
        priority:    "LOW",
        title:       "Your post was reposted",
        message:     `Someone reposted your post to their feed.`,
        actionLabel: "View",
        actionPath:  `/community/posts/${postId}`,
      });
    }

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

    // Full per-type breakdown (e.g. "18 ❤️, 4 📈") — only computed for the
    // single-post detail view, never per-card in a feed listing, so a page
    // of 20 posts never triggers 20 extra groupBy queries.
    const reactions = await communityInteractionRepository.postReactionBreakdown(postId);
    return { ...fmt(post as RawPost), reactions };
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