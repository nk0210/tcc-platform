/**
 * Community Post Routes
 * Mounted at: /community/posts
 *
 * Covers: global feed, create, get, update, delete, hide,
 *         comments, likes, bookmarks, shares (all on a specific post).
 */
import { Router }   from "express";
import { z }        from "zod";
import { authenticate, optionalAuthenticate, type AuthRequest } from "../../middleware/authenticate";
import { requirePermission }                from "../../middleware/requirePermission";
import { validate }                         from "../../middleware/validate";
import { communityPostService }             from "../../server/services/communityPostService";
import { communityFeedService }             from "../../server/services/communityFeedService";
import { communityCommentService }          from "../../server/services/communityCommentService";
import { communityInteractionService }      from "../../server/services/communityInteractionService";
import { ok, created, notFound, badRequest, forbidden, internalError } from "../../lib/response";
import type { PostType, PostVisibility }    from "@prisma/client";

const router: ReturnType<typeof Router> = Router();

// ── Schemas ────────────────────────────────────────────────────────────────

const FeedSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  type:     z.enum(["TEXT","TRADE_IDEA","SHARED_TRADE","ACADEMY_COMPLETION","STRATEGY_SHARE","COMPETITION_UPDATE"]).optional(),
  symbol:   z.string().optional(),
  // Hashtag filter, without the leading #.
  tag:      z.string().max(50).optional(),
  sort:     z.enum(["latest", "trending"]).default("latest"),
});

const CreatePostSchema = z.object({
  type:                z.enum(["TEXT","TRADE_IDEA","SHARED_TRADE","ACADEMY_COMPLETION","STRATEGY_SHARE","COMPETITION_UPDATE"]),
  content:             z.string().min(1, "Content is required").max(5000),
  visibility:          z.enum(["PUBLIC","FOLLOWERS_ONLY","PRIVATE"]).default("PUBLIC"),
  linkedTradeId:       z.string().cuid().optional().nullable(),
  linkedStrategyId:    z.string().cuid().optional().nullable(),
  linkedCourseId:      z.string().optional().nullable(),
  linkedCompetitionId: z.string().cuid().optional().nullable(),
  tradeSnapshot:       z.record(z.unknown()).optional().nullable(),
  linkedStrategyTitle: z.string().max(200).optional().nullable(),
  linkedCourseTitle:   z.string().max(200).optional().nullable(),
  symbol:              z.string().max(20).optional().nullable(),
  tags:                z.array(z.string().max(50)).max(10).default([]),
});

const UpdatePostSchema = z.object({
  content:    z.string().min(1).max(5000).optional(),
  visibility: z.enum(["PUBLIC","FOLLOWERS_ONLY","PRIVATE"]).optional(),
  tags:       z.array(z.string().max(50)).max(10).optional(),
});

const AddCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000),
});

const CommentListSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

const HidePostSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

const REACTION_TYPES = ["LIKE", "INSIGHTFUL", "BULLISH", "BEARISH", "CELEBRATE", "INTERESTING"] as const;

const ReactionSchema = z.object({
  // Optional, defaults to LIKE — the pre-reactions client just posts with
  // no body at all, same endpoint, same default behavior as before.
  type: z.enum(REACTION_TYPES).default("LIKE"),
});

// ── GET /posts?page=&pageSize=&type=&symbol= ─ Global feed ────────────────

router.get(
  "/",
  optionalAuthenticate,
  validate(FeedSchema, "query"),
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const query    = req.query as unknown as z.infer<typeof FeedSchema>;
    const viewerId = authReq.userId ?? undefined;

    try {
      const feed = await communityFeedService.getGlobalFeed(
        { page: query.page, pageSize: query.pageSize, type: query.type as PostType | undefined, symbol: query.symbol, tag: query.tag, sort: query.sort },
        viewerId
      );
      ok(res, feed);
    } catch (err) {
      console.error("[community/posts GET /]", err);
      internalError(res);
    }
  }
);

// ── GET /posts/following ─ Following feed (auth required) ─────────────────

router.get(
  "/following",
  authenticate,
  validate(FeedSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof FeedSchema>;

    try {
      const feed = await communityFeedService.getFollowingFeed(authReq.userId, {
        page:     query.page,
        pageSize: query.pageSize,
        type:     query.type as PostType | undefined,
        symbol:   query.symbol,
        tag:      query.tag,
        sort:     query.sort,
      });
      ok(res, feed);
    } catch (err) {
      console.error("[community/posts GET /following]", err);
      internalError(res);
    }
  }
);

// ── GET /posts/saved ─ Bookmarked posts (auth required) ───────────────────

router.get(
  "/saved",
  authenticate,
  validate(FeedSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof FeedSchema>;

    try {
      const feed = await communityFeedService.getSavedFeed(authReq.userId, {
        page:     query.page,
        pageSize: query.pageSize,
        type:     query.type as PostType | undefined,
      });
      ok(res, feed);
    } catch (err) {
      console.error("[community/posts GET /saved]", err);
      internalError(res);
    }
  }
);

// ── GET /posts/trending/hashtags ─ Trending hashtags (public) ─────────────

const TrendingHashtagsSchema = z.object({
  limit: z.coerce.number().int().positive().max(20).default(8),
});

router.get(
  "/trending/hashtags",
  validate(TrendingHashtagsSchema, "query"),
  async (req, res) => {
    const query = req.query as unknown as z.infer<typeof TrendingHashtagsSchema>;

    try {
      const items = await communityFeedService.getTrendingHashtags(query.limit);
      ok(res, { items });
    } catch (err) {
      console.error("[community/posts GET /trending/hashtags]", err);
      internalError(res);
    }
  }
);

// ── POST /posts ─ Create post ────────────────────────────────────────────

router.post(
  "/",
  authenticate,
  validate(CreatePostSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof CreatePostSchema>;

    try {
      const post = await communityPostService.createPost({
        authorId:            authReq.userId,
        type:                body.type as PostType,
        content:             body.content,
        visibility:          body.visibility as PostVisibility,
        linkedTradeId:       body.linkedTradeId,
        linkedStrategyId:    body.linkedStrategyId,
        linkedCourseId:      body.linkedCourseId,
        linkedCompetitionId: body.linkedCompetitionId,
        tradeSnapshot:       body.tradeSnapshot as import("@prisma/client").Prisma.InputJsonValue | null | undefined,
        linkedStrategyTitle: body.linkedStrategyTitle,
        linkedCourseTitle:   body.linkedCourseTitle,
        symbol:              body.symbol,
        tags:                body.tags,
      });
      created(res, post, "Post created");
    } catch (err) {
      console.error("[community/posts POST /]", err);
      internalError(res);
    }
  }
);

// ── GET /posts/:postId ─ Get single post ──────────────────────────────────

router.get(
  "/:postId",
  optionalAuthenticate,
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const viewerId = authReq.userId ?? undefined;

    try {
      const post = await communityPostService.getPost(req.params.postId, viewerId);
      ok(res, post);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "POST_NOT_FOUND") {
        notFound(res, "Post not found");
        return;
      }
      console.error("[community/posts GET /:postId]", err);
      internalError(res);
    }
  }
);

// ── PUT /posts/:postId ─ Update post ──────────────────────────────────────

router.put(
  "/:postId",
  authenticate,
  validate(UpdatePostSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof UpdatePostSchema>;

    try {
      const post = await communityPostService.updatePost(req.params.postId, authReq.userId, {
        content:    body.content,
        visibility: body.visibility as PostVisibility | undefined,
        tags:       body.tags,
      });
      ok(res, post, "Post updated");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "POST_NOT_FOUND") { notFound(res, "Post not found"); return; }
        if (err.message === "NOT_POST_AUTHOR") { forbidden(res, "You can only edit your own posts"); return; }
      }
      console.error("[community/posts PUT /:postId]", err);
      internalError(res);
    }
  }
);

// ── DELETE /posts/:postId ─ Delete post ───────────────────────────────────

router.delete(
  "/:postId",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    const isAdmin = authReq.permissions.includes("community.post.delete");

    try {
      await communityPostService.deletePost(
        req.params.postId,
        authReq.userId,
        isAdmin,
        { actorHandle: authReq.handle, actorRole: authReq.roles[0] ?? "ADMIN" }
      );
      ok(res, null, "Post deleted");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "POST_NOT_FOUND") { notFound(res, "Post not found"); return; }
        if (err.message === "NOT_POST_AUTHOR") { forbidden(res, "You can only delete your own posts"); return; }
      }
      console.error("[community/posts DELETE /:postId]", err);
      internalError(res);
    }
  }
);

// ── POST /posts/:postId/hide ─ Admin: hide post ────────────────────────────

router.post(
  "/:postId/hide",
  authenticate,
  requirePermission("community.post.hide"),
  validate(HidePostSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof HidePostSchema>;

    try {
      await communityPostService.hidePost(
        req.params.postId,
        { actorId: authReq.userId, actorHandle: authReq.handle, actorRole: authReq.roles[0] ?? "ADMIN" },
        body.reason
      );
      ok(res, null, "Post hidden");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "POST_NOT_FOUND") {
        notFound(res, "Post not found");
        return;
      }
      console.error("[community/posts POST /:postId/hide]", err);
      internalError(res);
    }
  }
);

// ── POST /posts/:postId/unhide ─ Admin: unhide post ───────────────────────

router.post(
  "/:postId/unhide",
  authenticate,
  requirePermission("community.post.hide"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      await communityPostService.unhidePost(
        req.params.postId,
        { actorId: authReq.userId, actorHandle: authReq.handle, actorRole: authReq.roles[0] ?? "ADMIN" }
      );
      ok(res, null, "Post unhidden");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "POST_NOT_FOUND") {
        notFound(res, "Post not found");
        return;
      }
      console.error("[community/posts POST /:postId/unhide]", err);
      internalError(res);
    }
  }
);

// ── GET /posts/:postId/comments ─ List comments ───────────────────────────

router.get(
  "/:postId/comments",
  optionalAuthenticate,
  validate(CommentListSchema, "query"),
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const query    = req.query as unknown as z.infer<typeof CommentListSchema>;
    const viewerId = authReq.userId ?? undefined;

    try {
      const result = await communityCommentService.getComments(
        req.params.postId,
        query.page,
        query.pageSize,
        viewerId
      );
      ok(res, result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "POST_NOT_FOUND") {
        notFound(res, "Post not found");
        return;
      }
      console.error("[community/posts GET /:postId/comments]", err);
      internalError(res);
    }
  }
);

// ── POST /posts/:postId/comments ─ Add comment ────────────────────────────

router.post(
  "/:postId/comments",
  authenticate,
  validate(AddCommentSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof AddCommentSchema>;

    try {
      const comment = await communityCommentService.addComment(
        req.params.postId,
        authReq.userId,
        body.content,
        null
      );
      created(res, comment, "Comment added");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "POST_NOT_FOUND") {
        notFound(res, "Post not found");
        return;
      }
      console.error("[community/posts POST /:postId/comments]", err);
      internalError(res);
    }
  }
);

// ── POST /posts/:postId/like ─ Toggle/switch reaction (defaults to LIKE) ──

router.post(
  "/:postId/like",
  authenticate,
  validate(ReactionSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof ReactionSchema>;

    try {
      const result = await communityInteractionService.togglePostLike(
        req.params.postId,
        authReq.userId,
        body.type
      );
      ok(res, result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "POST_NOT_FOUND") {
        notFound(res, "Post not found");
        return;
      }
      console.error("[community/posts POST /:postId/like]", err);
      internalError(res);
    }
  }
);

// ── POST /posts/:postId/bookmark ─ Toggle bookmark ────────────────────────

router.post(
  "/:postId/bookmark",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      const result = await communityInteractionService.toggleBookmark(
        req.params.postId,
        authReq.userId
      );
      ok(res, result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "POST_NOT_FOUND") {
        notFound(res, "Post not found");
        return;
      }
      console.error("[community/posts POST /:postId/bookmark]", err);
      internalError(res);
    }
  }
);

// ── POST /posts/:postId/share ─ Track share ───────────────────────────────

router.post(
  "/:postId/share",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      const result = await communityInteractionService.trackShare(
        req.params.postId,
        authReq.userId
      );
      ok(res, result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "POST_NOT_FOUND") {
        notFound(res, "Post not found");
        return;
      }
      console.error("[community/posts POST /:postId/share]", err);
      internalError(res);
    }
  }
);

// ── POST /posts/:postId/repost ─ Share-as-repost ───────────────────────────
// Creates a real new post on the reposter's own feed that embeds the
// original. Distinct from /share above, which only tracks a share count —
// this one puts an actual post object into the feed.

const RepostSchema = z.object({
  caption: z.string().max(500).optional(),
});

router.post(
  "/:postId/repost",
  authenticate,
  validate(RepostSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof RepostSchema>;

    try {
      const post = await communityPostService.createRepost(authReq.userId, req.params.postId, body.caption);
      created(res, post, "Reposted");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "POST_NOT_FOUND") {
        notFound(res, "Post not found");
        return;
      }
      if (err instanceof Error && err.message === "REPOST_NOT_ALLOWED") {
        badRequest(res, "Only public posts can be reposted");
        return;
      }
      console.error("[community/posts POST /:postId/repost]", err);
      internalError(res);
    }
  }
);

export default router;