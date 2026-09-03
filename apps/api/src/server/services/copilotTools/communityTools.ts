/**
 * Copilot Community Tools — Phase 9, expanded in the production-hardening
 * pass (edit/delete/like/bookmark) and again in the final closure pass
 * (comment edit/delete, follow/unfollow)
 *
 * Thin wrappers over communityFeedService / communityPostService /
 * communityCommentService / communityFollowService / communityInteractionService
 * — no new business logic. See COPILOT_CAPABILITY_MAP.md for the full audit
 * this was built from, including which community capabilities remain
 * deliberately unexposed (all admin moderation) and why.
 *
 * create_post is deliberately narrow: always `type: "TEXT"`, never a
 * model-supplied `linkedTradeId`/`linkedStrategyId`/etc — letting the
 * model assert a link to another entity it hasn't itself verified would
 * mean fabricated cross-references appearing as real content on a public
 * post. A trader can still link a real trade to a post through the
 * existing TCC UI; Copilot only ever posts plain text on their behalf.
 *
 * Every write tool in this file stays MEDIUM risk, even the trivially
 * reversible ones (like/bookmark/follow) — classifying any of them LOW
 * (auto-execute) would make it the first-ever auto-executing write tool in
 * the system. Preserving that unbroken precedent was a deliberate Phase 9
 * decision, re-affirmed at every later expansion, not an oversight.
 *
 * Ownership for post/comment edit/delete is enforced by
 * communityPostService/communityCommentService themselves
 * (NotPostAuthorError/NotCommentAuthorError). toggle_post_like/
 * toggle_post_bookmark additionally call communityPostService.getPost()
 * first for the same visibility-hardening reason get_post_comments/
 * add_comment do — communityInteractionService's toggles only check the
 * post isn't admin-hidden, not PRIVATE/FOLLOWERS_ONLY visibility.
 *
 * follow_user/unfollow_user (final closure pass): before this pass,
 * `communityFollowService.followUser()` defined a `PrivateProfileError`
 * (and the REST route already handled it) but never actually threw it —
 * dead code that would have let ANY caller, Copilot included, follow a
 * PRIVATE-visibility profile the same way a PUBLIC one is followed. Fixed
 * at the source (communityFollowService.ts) rather than worked around
 * here, so the fix benefits the REST route too, not just Copilot.
 * unfollow_user carries no privacy concern (undoing a follow reveals
 * nothing), so it isn't gated the same way. Both reuse the service's own
 * CannotFollowSelfError (self-follow is already structurally rejected by
 * `target.id === followerId`, which can never match ctx.userId being
 * something else via a forged argument, since followerId is always
 * ctx.userId here).
 */
import { z } from "zod";
import { communityFeedService } from "../communityFeedService";
import { communityPostService, NotPostAuthorError, PostNotFoundError } from "../communityPostService";
import { communityCommentService, NotCommentAuthorError, CommentNotFoundError } from "../communityCommentService";
import { communityFollowService, UserNotFoundError, CannotFollowSelfError, PrivateProfileError } from "../communityFollowService";
import { communityInteractionService } from "../communityInteractionService";
import { optionalNullable, optionalNullableDefault, nullableJsonSchema } from "./zodHelpers";
import type { ToolDefinition } from "../copilotToolRegistry";

const POST_TYPES = ["TEXT", "TRADE_IDEA", "SHARED_TRADE", "ACADEMY_COMPLETION", "STRATEGY_SHARE", "COMPETITION_UPDATE"] as const;

// The community services' own `fmt()` helpers spread a Prisma row through
// an index-signature-typed intermediate (RawPost/RawComment), which loses
// named-property inference on the way out — these narrow, tool-local views
// just describe the fields those helpers are known (by reading their
// implementation) to actually attach, so the casts below aren't widening
// anything real, only recovering types TS already erased.
interface PostRow {
  id: string; authorId: string; type: string; content: string;
  symbol: string | null; tags: string[]; isLiked: boolean; isBookmarked: boolean; createdAt: Date;
}
interface CommentRow {
  id: string; authorId: string; content: string; isLiked: boolean; createdAt: Date;
}

// ── Reads ────────────────────────────────────────────────────────────────

const GetCommunityFeedArgs = z.object({
  scope: optionalNullableDefault(z.enum(["global", "following"]), "global" as const),
  type:  optionalNullable(z.enum(POST_TYPES)),
  limit: optionalNullableDefault(z.number().int().min(1).max(20), 10),
});

const getCommunityFeed: ToolDefinition<z.infer<typeof GetCommunityFeedArgs>> = {
  name:        "get_community_feed",
  description: "Get recent TCC community posts. scope \"global\" is the public feed; scope \"following\" is only posts from traders the authenticated user follows (plus their own).",
  parameters:  GetCommunityFeedArgs,
  jsonSchema: {
    type: "object",
    properties: {
      scope: nullableJsonSchema({ type: "string", enum: ["global", "following"], description: "Which feed to read. Defaults to \"global\"." }),
      type:  nullableJsonSchema({ type: "string", enum: [...POST_TYPES], description: "Optional: filter to one post type." }),
      limit: nullableJsonSchema({ type: "integer", minimum: 1, maximum: 20, description: "Max posts to return. Defaults to 10." }),
    },
    additionalProperties: false,
  },
  riskLevel:  "LOW",
  capability: "community.feed",
  readOnly:   true,
  async execute(args, ctx) {
    const params = { page: 1, pageSize: args.limit, type: args.type ?? undefined };
    const result =
      args.scope === "following"
        ? await communityFeedService.getFollowingFeed(ctx.userId, params)
        : await communityFeedService.getGlobalFeed(params, ctx.userId);
    return {
      total: result.total,
      posts: (result.items as unknown as PostRow[]).map((p) => ({
        id: p.id, authorId: p.authorId, type: p.type, content: p.content,
        symbol: p.symbol ?? null, tags: p.tags, isLiked: p.isLiked, isBookmarked: p.isBookmarked,
        createdAt: p.createdAt,
      })),
    };
  },
};

const GetPostArgs = z.object({ postId: z.string().min(1) });

const getPost: ToolDefinition<z.infer<typeof GetPostArgs>> = {
  name:        "get_post",
  description: "Get one community post by id (from get_community_feed), including whether the authenticated user has liked/bookmarked it. Respects the post's visibility — a private or followers-only post the user can't see returns an error, not fabricated content.",
  parameters:  GetPostArgs,
  jsonSchema: {
    type: "object",
    properties: { postId: { type: "string", description: "The post's id, from get_community_feed." } },
    required: ["postId"], additionalProperties: false,
  },
  riskLevel:  "LOW",
  capability: "community.feed",
  readOnly:   true,
  async execute(args, ctx) {
    try {
      const post = await communityPostService.getPost(args.postId, ctx.userId) as unknown as PostRow;
      return {
        id: post.id, authorId: post.authorId, type: post.type, content: post.content,
        symbol: post.symbol ?? null, tags: post.tags, isLiked: post.isLiked, isBookmarked: post.isBookmarked,
        createdAt: post.createdAt,
      };
    } catch {
      throw new Error(`No visible post found with id "${args.postId}".`);
    }
  },
};

const GetPostCommentsArgs = z.object({
  postId: z.string().min(1),
  limit:  optionalNullableDefault(z.number().int().min(1).max(30), 10),
});

const getPostComments: ToolDefinition<z.infer<typeof GetPostCommentsArgs>> = {
  name:        "get_post_comments",
  description: "Get top-level comments on a community post.",
  parameters:  GetPostCommentsArgs,
  jsonSchema: {
    type: "object",
    properties: {
      postId: { type: "string", description: "The post's id." },
      limit:  nullableJsonSchema({ type: "integer", minimum: 1, maximum: 30, description: "Max comments to return. Defaults to 10." }),
    },
    required: ["postId"], additionalProperties: false,
  },
  riskLevel:  "LOW",
  capability: "community.comments",
  readOnly:   true,
  async execute(args, ctx) {
    // communityCommentService.getComments() doesn't itself re-check the
    // parent post's PRIVATE/FOLLOWERS_ONLY visibility (only isHiddenByAdmin
    // via the post lookup it does for other purposes) — getPost() does
    // enforce that, so verify visibility here first, same reasoning as
    // add_comment below.
    try {
      await communityPostService.getPost(args.postId, ctx.userId);
    } catch {
      throw new Error(`No visible post found with id "${args.postId}".`);
    }
    const result = await communityCommentService.getComments(args.postId, 1, args.limit, ctx.userId);
    return {
      total: result.total,
      comments: (result.items as unknown as CommentRow[]).map((c) => ({
        id: c.id, authorId: c.authorId, content: c.content, isLiked: c.isLiked, createdAt: c.createdAt,
      })),
    };
  },
};

const GetFollowStatusArgs = z.object({ handle: z.string().min(1).max(50) });

const getFollowStatus: ToolDefinition<z.infer<typeof GetFollowStatusArgs>> = {
  name:        "get_follow_status",
  description: "Check whether the authenticated user follows/is followed by another TCC trader by handle, plus that trader's follower/following counts.",
  parameters:  GetFollowStatusArgs,
  jsonSchema: {
    type: "object",
    properties: { handle: { type: "string", description: "The other trader's handle (without @)." } },
    required: ["handle"], additionalProperties: false,
  },
  riskLevel:  "LOW",
  capability: "community.follow",
  readOnly:   true,
  async execute(args, ctx) {
    try {
      return await communityFollowService.getFollowStatus(ctx.userId, args.handle);
    } catch {
      throw new Error(`No TCC user found with handle "${args.handle}".`);
    }
  },
};

const PageLimitArgs = z.object({ limit: optionalNullableDefault(z.number().int().min(1).max(30), 10) });
const pageLimitProperty = nullableJsonSchema({ type: "integer", minimum: 1, maximum: 30, description: "Max results. Defaults to 10." });

const getFollowers: ToolDefinition<z.infer<typeof PageLimitArgs>> = {
  name:        "get_followers",
  description: "Get the authenticated user's own followers on TCC.",
  parameters:  PageLimitArgs,
  jsonSchema: { type: "object", properties: { limit: pageLimitProperty }, additionalProperties: false },
  riskLevel:  "LOW",
  capability: "community.follow",
  readOnly:   true,
  async execute(args, ctx) {
    const result = await communityFollowService.getFollowers(ctx.userId, 1, args.limit);
    return { total: result.total, followers: result.items };
  },
};

const getFollowing: ToolDefinition<z.infer<typeof PageLimitArgs>> = {
  name:        "get_following",
  description: "Get who the authenticated user follows on TCC.",
  parameters:  PageLimitArgs,
  jsonSchema: { type: "object", properties: { limit: pageLimitProperty }, additionalProperties: false },
  riskLevel:  "LOW",
  capability: "community.follow",
  readOnly:   true,
  async execute(args, ctx) {
    const result = await communityFollowService.getFollowing(ctx.userId, 1, args.limit);
    return { total: result.total, following: result.items };
  },
};

// ── Writes ───────────────────────────────────────────────────────────────

const CreatePostArgs = z.object({
  content:    z.string().min(1).max(5000),
  symbol:     optionalNullable(z.string().max(20)),
  visibility: optionalNullableDefault(z.enum(["PUBLIC", "FOLLOWERS_ONLY", "PRIVATE"]), "PUBLIC" as const),
});

function truncateForPrompt(s: string, max = 80): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

const createPost: ToolDefinition<z.infer<typeof CreatePostArgs>> = {
  name:        "create_post",
  description: "Post a plain-text update to the authenticated user's TCC community feed. Always a TEXT post — never claims a link to a specific trade/strategy the user hasn't confirmed. Requires the user's confirmation before publishing.",
  parameters:  CreatePostArgs,
  jsonSchema: {
    type: "object",
    properties: {
      content:    { type: "string", description: "The post text." },
      symbol:     nullableJsonSchema({ type: "string", description: "Optional instrument symbol this post relates to, e.g. XAUUSD." }),
      visibility: nullableJsonSchema({ type: "string", enum: ["PUBLIC", "FOLLOWERS_ONLY", "PRIVATE"], description: "Who can see it. Defaults to PUBLIC." }),
    },
    required: ["content"], additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "community.feed",
  readOnly:  false,
  describeAction: (args) => `Post to your TCC community feed: "${truncateForPrompt(args.content)}"?`,
  describeResult: () => "Posted to your community feed.",
  async execute(args, ctx) {
    const post = await communityPostService.createPost({
      authorId: ctx.userId, type: "TEXT", content: args.content,
      visibility: args.visibility, symbol: args.symbol ?? null,
    }) as unknown as PostRow;
    return { id: post.id, createdAt: post.createdAt };
  },
};

const AddCommentArgs = z.object({
  postId:  z.string().min(1),
  content: z.string().min(1).max(2000),
});

const addComment: ToolDefinition<z.infer<typeof AddCommentArgs>> = {
  name:        "add_comment",
  description: "Add a comment to a community post on the authenticated user's behalf. Requires the user's confirmation before posting.",
  parameters:  AddCommentArgs,
  jsonSchema: {
    type: "object",
    properties: {
      postId:  { type: "string", description: "The post's id, from get_community_feed or get_post." },
      content: { type: "string", description: "The comment text." },
    },
    required: ["postId", "content"], additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "community.comments",
  readOnly:  false,
  describeAction: (args) => `Comment on this post: "${truncateForPrompt(args.content)}"?`,
  describeResult: () => "Comment posted.",
  async execute(args, ctx) {
    // communityCommentService.addComment() itself only checks that the post
    // exists and isn't admin-hidden — it does NOT re-check PRIVATE/
    // FOLLOWERS_ONLY visibility (confirmed by reading its implementation).
    // getPost() does enforce that, so this tool calls it first and fails
    // closed on anything not visible to this user, rather than handing the
    // model a route around visibility that the REST route itself also
    // doesn't have (a comment tool must not be a more permissive path than
    // the platform's own rules).
    try {
      await communityPostService.getPost(args.postId, ctx.userId);
    } catch {
      throw new Error(`Couldn't comment — no visible post found with id "${args.postId}".`);
    }
    const comment = await communityCommentService.addComment(args.postId, ctx.userId, args.content) as unknown as CommentRow;
    return { id: comment.id, createdAt: comment.createdAt };
  },
};

const EditPostArgs = z.object({
  postId:  z.string().min(1),
  content: z.string().min(1).max(5000),
});

const editPost: ToolDefinition<z.infer<typeof EditPostArgs>> = {
  name:        "edit_post",
  description: "Edit the text content of one of the authenticated user's own community posts. Only the author can edit their post. Requires the user's confirmation before saving.",
  parameters:  EditPostArgs,
  jsonSchema: {
    type: "object",
    properties: {
      postId:  { type: "string", description: "The post's id, from get_community_feed or get_post. Must be a post the user authored." },
      content: { type: "string", description: "The new post text, replacing the old content." },
    },
    required: ["postId", "content"], additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "community.feed",
  readOnly:  false,
  describeAction: (args) => `Edit your post to: "${truncateForPrompt(args.content)}"?`,
  describeResult: () => "Post updated.",
  async execute(args, ctx) {
    try {
      const post = await communityPostService.updatePost(args.postId, ctx.userId, { content: args.content }) as unknown as PostRow;
      return { id: post.id, content: post.content };
    } catch (err) {
      if (err instanceof PostNotFoundError) throw new Error(`No post found with id "${args.postId}".`);
      if (err instanceof NotPostAuthorError) throw new Error("You can only edit your own posts.");
      throw err;
    }
  },
};

const DeletePostArgs = z.object({ postId: z.string().min(1) });

const deletePost: ToolDefinition<z.infer<typeof DeletePostArgs>> = {
  name:        "delete_post",
  description: "Permanently delete one of the authenticated user's own community posts. Only the author can delete their post. This cannot be undone. Requires the user's confirmation before deleting.",
  parameters:  DeletePostArgs,
  jsonSchema: {
    type: "object",
    properties: { postId: { type: "string", description: "The post's id to delete. Must be a post the user authored." } },
    required: ["postId"], additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "community.feed",
  readOnly:  false,
  describeAction: () => "Permanently delete this post? This cannot be undone.",
  describeResult: () => "Post deleted.",
  async execute(args, ctx) {
    try {
      // isAdmin is always false — Copilot never deletes on the user's
      // behalf using elevated privilege, only ever as the post's own author.
      await communityPostService.deletePost(args.postId, ctx.userId, false);
      return { deleted: true };
    } catch (err) {
      if (err instanceof PostNotFoundError) throw new Error(`No post found with id "${args.postId}".`);
      if (err instanceof NotPostAuthorError) throw new Error("You can only delete your own posts.");
      throw err;
    }
  },
};

const TogglePostLikeArgs = z.object({ postId: z.string().min(1) });

const togglePostLike: ToolDefinition<z.infer<typeof TogglePostLikeArgs>> = {
  name:        "toggle_post_like",
  description: "Like a community post if the authenticated user hasn't liked it yet, or unlike it if they already have (check get_post's isLiked field first to know which). Requires the user's confirmation.",
  parameters:  TogglePostLikeArgs,
  jsonSchema: {
    type: "object",
    properties: { postId: { type: "string", description: "The post's id, from get_community_feed or get_post." } },
    required: ["postId"], additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "community.feed",
  readOnly:  false,
  describeAction: () => "Toggle your like on this post?",
  describeResult: (result) => (result as { liked: boolean }).liked ? "Post liked." : "Like removed.",
  async execute(args, ctx) {
    // communityInteractionService.togglePostLike() only checks the post
    // isn't admin-hidden — it does not re-check PRIVATE/FOLLOWERS_ONLY
    // visibility, so verify that here first (same reasoning as add_comment).
    try {
      await communityPostService.getPost(args.postId, ctx.userId);
    } catch {
      throw new Error(`Couldn't react — no visible post found with id "${args.postId}".`);
    }
    return communityInteractionService.togglePostLike(args.postId, ctx.userId);
  },
};

const TogglePostBookmarkArgs = z.object({ postId: z.string().min(1) });

const togglePostBookmark: ToolDefinition<z.infer<typeof TogglePostBookmarkArgs>> = {
  name:        "toggle_post_bookmark",
  description: "Bookmark a community post if the authenticated user hasn't bookmarked it yet, or remove the bookmark if they already have (check get_post's isBookmarked field first to know which). Requires the user's confirmation.",
  parameters:  TogglePostBookmarkArgs,
  jsonSchema: {
    type: "object",
    properties: { postId: { type: "string", description: "The post's id, from get_community_feed or get_post." } },
    required: ["postId"], additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "community.feed",
  readOnly:  false,
  describeAction: () => "Toggle your bookmark on this post?",
  describeResult: (result) => (result as { bookmarked: boolean }).bookmarked ? "Post bookmarked." : "Bookmark removed.",
  async execute(args, ctx) {
    try {
      await communityPostService.getPost(args.postId, ctx.userId);
    } catch {
      throw new Error(`Couldn't bookmark — no visible post found with id "${args.postId}".`);
    }
    return communityInteractionService.toggleBookmark(args.postId, ctx.userId);
  },
};

const EditCommentArgs = z.object({
  commentId: z.string().min(1),
  content:   z.string().min(1).max(2000),
});

const editComment: ToolDefinition<z.infer<typeof EditCommentArgs>> = {
  name:        "edit_comment",
  description: "Edit the text of one of the authenticated user's own comments. Only the author can edit their comment. Requires the user's confirmation before saving.",
  parameters:  EditCommentArgs,
  jsonSchema: {
    type: "object",
    properties: {
      commentId: { type: "string", description: "The comment's id, from get_post_comments. Must be a comment the user authored." },
      content:   { type: "string", description: "The new comment text, replacing the old content." },
    },
    required: ["commentId", "content"], additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "community.comments",
  readOnly:  false,
  describeAction: (args) => `Edit your comment to: "${truncateForPrompt(args.content)}"?`,
  describeResult: () => "Comment updated.",
  async execute(args, ctx) {
    try {
      const comment = await communityCommentService.editComment(args.commentId, ctx.userId, args.content) as unknown as CommentRow;
      return { id: comment.id, content: comment.content };
    } catch (err) {
      if (err instanceof CommentNotFoundError) throw new Error(`No comment found with id "${args.commentId}".`);
      if (err instanceof NotCommentAuthorError) throw new Error("You can only edit your own comments.");
      throw err;
    }
  },
};

const DeleteCommentArgs = z.object({ commentId: z.string().min(1) });

const deleteComment: ToolDefinition<z.infer<typeof DeleteCommentArgs>> = {
  name:        "delete_comment",
  description: "Permanently delete one of the authenticated user's own comments. Only the author can delete their comment. This cannot be undone. Requires the user's confirmation before deleting.",
  parameters:  DeleteCommentArgs,
  jsonSchema: {
    type: "object",
    properties: { commentId: { type: "string", description: "The comment's id to delete. Must be a comment the user authored." } },
    required: ["commentId"], additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "community.comments",
  readOnly:  false,
  describeAction: () => "Permanently delete this comment? This cannot be undone.",
  describeResult: () => "Comment deleted.",
  async execute(args, ctx) {
    try {
      // isAdmin is always false — same reasoning as delete_post.
      await communityCommentService.deleteComment(args.commentId, ctx.userId, false);
      return { deleted: true };
    } catch (err) {
      if (err instanceof CommentNotFoundError) throw new Error(`No comment found with id "${args.commentId}".`);
      if (err instanceof NotCommentAuthorError) throw new Error("You can only delete your own comments.");
      throw err;
    }
  },
};

const FollowUserArgs = z.object({ handle: z.string().min(1).max(50) });

const followUser: ToolDefinition<z.infer<typeof FollowUserArgs>> = {
  name:        "follow_user",
  description: "Follow another TCC trader by handle on the authenticated user's behalf. Fails if the profile is private or the user is already following/is the same account. Requires the user's confirmation.",
  parameters:  FollowUserArgs,
  jsonSchema: {
    type: "object",
    properties: { handle: { type: "string", description: "The other trader's handle (without @)." } },
    required: ["handle"], additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "community.follow",
  readOnly:  false,
  describeAction: (args) => `Follow @${args.handle}?`,
  describeResult: () => "You are now following this trader.",
  async execute(args, ctx) {
    try {
      return await communityFollowService.followUser(ctx.userId, args.handle);
    } catch (err) {
      if (err instanceof UserNotFoundError) throw new Error(`No TCC user found with handle "${args.handle}".`);
      if (err instanceof CannotFollowSelfError) throw new Error("You can't follow yourself.");
      if (err instanceof PrivateProfileError) throw new Error("That profile is private and can't be followed.");
      throw err;
    }
  },
};

const UnfollowUserArgs = z.object({ handle: z.string().min(1).max(50) });

const unfollowUser: ToolDefinition<z.infer<typeof UnfollowUserArgs>> = {
  name:        "unfollow_user",
  description: "Unfollow another TCC trader by handle on the authenticated user's behalf. Requires the user's confirmation.",
  parameters:  UnfollowUserArgs,
  jsonSchema: {
    type: "object",
    properties: { handle: { type: "string", description: "The other trader's handle (without @)." } },
    required: ["handle"], additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "community.follow",
  readOnly:  false,
  describeAction: (args) => `Unfollow @${args.handle}?`,
  describeResult: () => "You are no longer following this trader.",
  async execute(args, ctx) {
    try {
      return await communityFollowService.unfollowUser(ctx.userId, args.handle);
    } catch (err) {
      if (err instanceof UserNotFoundError) throw new Error(`No TCC user found with handle "${args.handle}".`);
      if (err instanceof CannotFollowSelfError) throw new Error("You can't unfollow yourself.");
      throw err;
    }
  },
};

export const communityTools: ToolDefinition[] = [
  getCommunityFeed as ToolDefinition,
  getPost as ToolDefinition,
  getPostComments as ToolDefinition,
  getFollowStatus as ToolDefinition,
  getFollowers as ToolDefinition,
  getFollowing as ToolDefinition,
  createPost as ToolDefinition,
  addComment as ToolDefinition,
  editPost as ToolDefinition,
  deletePost as ToolDefinition,
  togglePostLike as ToolDefinition,
  togglePostBookmark as ToolDefinition,
  editComment as ToolDefinition,
  deleteComment as ToolDefinition,
  followUser as ToolDefinition,
  unfollowUser as ToolDefinition,
];
