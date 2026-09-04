/**
 * Community Follow Routes
 * Mounted at: /community
 *
 * Covers: follow, unfollow, status check, followers list, following list,
 *         mutual follows, user feed by handle.
 */
import { Router } from "express";
import { z }      from "zod";
import { authenticate, optionalAuthenticate, type AuthRequest } from "../../middleware/authenticate";
import { validate }                from "../../middleware/validate";
import { communityFollowService }  from "../../server/services/communityFollowService";
import { communityFeedService }    from "../../server/services/communityFeedService";
import { ok, notFound, badRequest, internalError } from "../../lib/response";
import type { PostType } from "@prisma/client";

const router: ReturnType<typeof Router> = Router();

// ── Schemas ────────────────────────────────────────────────────────────────

const PaginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

const UserFeedSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  type:     z.enum(["TEXT","TRADE_IDEA","SHARED_TRADE","ACADEMY_COMPLETION","STRATEGY_SHARE","COMPETITION_UPDATE"]).optional(),
});

// ── POST /follow/:handle ─ Follow user ────────────────────────────────────

router.post(
  "/follow/:handle",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      const result = await communityFollowService.followUser(
        authReq.userId,
        req.params.handle
      );
      ok(res, result, `Now following @${req.params.handle}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "USER_NOT_FOUND")       { notFound(res,   "User not found");           return; }
        if (err.message === "CANNOT_FOLLOW_SELF")   { badRequest(res, "You cannot follow yourself"); return; }
        if (err.message === "PROFILE_IS_PRIVATE")   { badRequest(res, "This profile is private");   return; }
      }
      console.error("[community/follow POST /follow/:handle]", err);
      internalError(res);
    }
  }
);

// ── DELETE /follow/:handle ─ Unfollow user ────────────────────────────────

router.delete(
  "/follow/:handle",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      const result = await communityFollowService.unfollowUser(
        authReq.userId,
        req.params.handle
      );
      ok(res, result, `Unfollowed @${req.params.handle}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "USER_NOT_FOUND")     { notFound(res,   "User not found");             return; }
        if (err.message === "CANNOT_FOLLOW_SELF") { badRequest(res, "You cannot follow yourself"); return; }
      }
      console.error("[community/follow DELETE /follow/:handle]", err);
      internalError(res);
    }
  }
);

// ── GET /follow/:handle/status ─ Check follow status ─────────────────────

router.get(
  "/follow/:handle/status",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      const status = await communityFollowService.getFollowStatus(
        authReq.userId,
        req.params.handle
      );
      ok(res, status);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "USER_NOT_FOUND") {
        notFound(res, "User not found");
        return;
      }
      console.error("[community/follow GET /follow/:handle/status]", err);
      internalError(res);
    }
  }
);

// ── GET /followers ─ My followers ─────────────────────────────────────────

router.get(
  "/followers",
  authenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      const result = await communityFollowService.getFollowers(
        authReq.userId,
        query.page,
        query.pageSize
      );
      ok(res, result);
    } catch (err) {
      console.error("[community/follow GET /followers]", err);
      internalError(res);
    }
  }
);

// ── GET /following ─ Who I follow ─────────────────────────────────────────

router.get(
  "/following",
  authenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      const result = await communityFollowService.getFollowing(
        authReq.userId,
        query.page,
        query.pageSize
      );
      ok(res, result);
    } catch (err) {
      console.error("[community/follow GET /following]", err);
      internalError(res);
    }
  }
);

// ── GET /mutuals ─ Mutual follows ─────────────────────────────────────────

router.get(
  "/mutuals",
  authenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      const result = await communityFollowService.getMutuals(
        authReq.userId,
        query.page,
        query.pageSize
      );
      ok(res, result);
    } catch (err) {
      console.error("[community/follow GET /mutuals]", err);
      internalError(res);
    }
  }
);

// ── GET /suggestions ─ "People you may know" (auth required) ─────────────

const SuggestionsSchema = z.object({
  limit: z.coerce.number().int().positive().max(20).default(5),
});

router.get(
  "/suggestions",
  authenticate,
  validate(SuggestionsSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof SuggestionsSchema>;

    try {
      const items = await communityFollowService.getSuggestions(authReq.userId, query.limit);
      ok(res, { items });
    } catch (err) {
      console.error("[community/follow GET /suggestions]", err);
      internalError(res);
    }
  }
);

// ── GET /users/:handle/posts ─ User profile feed ──────────────────────────

router.get(
  "/users/:handle/posts",
  optionalAuthenticate,
  validate(UserFeedSchema, "query"),
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const query    = req.query as unknown as z.infer<typeof UserFeedSchema>;
    const viewerId = authReq.userId ?? undefined;

    try {
      const feed = await communityFeedService.getUserFeed(
        req.params.handle,
        viewerId,
        { page: query.page, pageSize: query.pageSize, type: query.type as PostType | undefined }
      );
      ok(res, feed);
    } catch (err) {
      console.error("[community/follow GET /users/:handle/posts]", err);
      internalError(res);
    }
  }
);

export default router;