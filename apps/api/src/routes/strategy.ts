/**
 * Strategy Marketplace Routes
 * Mounted at: /strategy
 *
 * Covers: discover, create, get, update, delete, admin feature/verify/remove,
 *         reviews, save, playbook.
 */
import { Router } from "express";
import { z }      from "zod";
import { authenticate, optionalAuthenticate, type AuthRequest } from "../middleware/authenticate";
import { requirePermission }         from "../middleware/requirePermission";
import { validate }                  from "../middleware/validate";
import { strategyService }           from "../server/services/strategyService";
import { ok, created, notFound, badRequest, forbidden, internalError } from "../lib/response";
import type { StrategyType, RiskLevel, PricingModel } from "@prisma/client";

const router: ReturnType<typeof Router> = Router();

// ── Shared enums ──────────────────────────────────────────────────────────

const STRATEGY_TYPES = ["OFFICIAL", "EDUCATIONAL_TEMPLATE", "CREATOR_PUBLISHED"] as const;
const RISK_LEVELS     = ["LOW", "MEDIUM", "HIGH"] as const;
const PRICING_MODELS  = ["FREE", "ONE_TIME", "SUBSCRIPTION"] as const;

// ── Schemas ────────────────────────────────────────────────────────────────

function parseCsv(v?: string): string[] | undefined {
  if (!v) return undefined;
  const list = v.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : undefined;
}

const FeedSchema = z.object({
  page:          z.coerce.number().int().positive().default(1),
  pageSize:      z.coerce.number().int().positive().max(50).default(20),
  type:          z.enum(STRATEGY_TYPES).optional(),
  riskLevel:     z.enum(RISK_LEVELS).optional(),
  assetCategory: z.string().optional(),
  timeframe:     z.string().optional(),
  tags:          z.string().optional(),
  search:        z.string().optional(),
});

const PaginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

const CreateStrategySchema = z.object({
  title:             z.string().min(1).max(200),
  description:       z.string().min(1).max(5000),
  type:              z.enum(STRATEGY_TYPES),
  asset:             z.string().max(50).optional(),
  assetCategory:     z.string().max(50).optional(),
  timeframe:         z.string().max(20).optional(),
  riskLevel:         z.enum(RISK_LEVELS).optional(),
  pricingModel:      z.enum(PRICING_MODELS).optional(),
  price:             z.number().min(0).optional(),
  winRate:           z.number().min(0).max(100).optional().nullable(),
  profitFactor:      z.number().min(0).optional().nullable(),
  maxDrawdown:       z.number().min(0).max(100).optional().nullable(),
  totalTrades:       z.number().int().min(0).optional().nullable(),
  avgRR:             z.number().optional().nullable(),
  monthlyReturn:     z.number().optional().nullable(),
  rules:             z.array(z.string().max(500)).max(50).optional(),
  entryConditions:   z.array(z.string().max(500)).max(50).optional(),
  exitConditions:    z.array(z.string().max(500)).max(50).optional(),
  riskManagement:    z.array(z.string().max(500)).max(50).optional(),
  tags:              z.array(z.string().max(50)).max(10).optional(),
  version:           z.string().max(20).optional(),
  disclaimer:        z.string().min(1).max(2000),
  linkedCourseId:    z.string().optional().nullable(),
});

const UpdateStrategySchema = z.object({
  title:             z.string().min(1).max(200).optional(),
  description:       z.string().min(1).max(5000).optional(),
  asset:             z.string().max(50).optional(),
  assetCategory:     z.string().max(50).optional(),
  timeframe:         z.string().max(20).optional(),
  riskLevel:         z.enum(RISK_LEVELS).optional(),
  pricingModel:      z.enum(PRICING_MODELS).optional(),
  price:             z.number().min(0).optional(),
  rules:             z.array(z.string().max(500)).max(50).optional(),
  entryConditions:   z.array(z.string().max(500)).max(50).optional(),
  exitConditions:    z.array(z.string().max(500)).max(50).optional(),
  riskManagement:    z.array(z.string().max(500)).max(50).optional(),
  tags:              z.array(z.string().max(50)).max(10).optional(),
  version:           z.string().max(20).optional(),
  disclaimer:        z.string().min(1).max(2000).optional(),
  linkedCourseId:    z.string().optional().nullable(),
});

const FeatureSchema = z.object({ featured: z.boolean().default(true) });
const VerifySchema  = z.object({ verified: z.boolean().default(true) });
const RemoveSchema  = z.object({ reason: z.string().min(1).max(500).optional() });

const ReviewSchema = z.object({
  rating:  z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
});

const EditReviewSchema = z.object({
  rating:  z.number().int().min(1).max(5).optional(),
  comment: z.string().min(1).max(2000).optional(),
});

// ── GET /strategy?... ─ Discover feed ──────────────────────────────────────

router.get(
  "/",
  optionalAuthenticate,
  validate(FeedSchema, "query"),
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const query    = req.query as unknown as z.infer<typeof FeedSchema>;
    const viewerId = authReq.userId ?? undefined;

    try {
      const feed = await strategyService.discoverStrategies(
        {
          page:          query.page,
          pageSize:      query.pageSize,
          type:          query.type as StrategyType | undefined,
          riskLevel:     query.riskLevel as RiskLevel | undefined,
          assetCategory: query.assetCategory,
          timeframe:     query.timeframe,
          tags:          parseCsv(query.tags),
          search:        query.search,
        },
        viewerId
      );
      ok(res, feed);
    } catch (err) {
      console.error("[strategy GET /]", err);
      internalError(res);
    }
  }
);

// ── GET /strategy/saved ─ Saved strategies (auth) ──────────────────────────

router.get(
  "/saved",
  authenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      ok(res, await strategyService.getSavedStrategies(authReq.userId, query));
    } catch (err) {
      console.error("[strategy GET /saved]", err);
      internalError(res);
    }
  }
);

// ── GET /strategy/playbook ─ Playbook (auth) ───────────────────────────────

router.get(
  "/playbook",
  authenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      ok(res, await strategyService.getPlaybook(authReq.userId, query));
    } catch (err) {
      console.error("[strategy GET /playbook]", err);
      internalError(res);
    }
  }
);

// ── GET /strategy/my ─ My published strategies (auth) ──────────────────────

router.get(
  "/my",
  authenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      ok(res, await strategyService.getUserStrategies(authReq.userId, authReq.userId, query));
    } catch (err) {
      console.error("[strategy GET /my]", err);
      internalError(res);
    }
  }
);

// ── POST /strategy ─ Create ────────────────────────────────────────────────

router.post(
  "/",
  authenticate,
  validate(CreateStrategySchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof CreateStrategySchema>;

    try {
      const strategy = await strategyService.createStrategy(
        authReq.userId,
        authReq.handle,
        authReq.roles,
        null,
        {
          title:           body.title,
          description:     body.description,
          type:            body.type as StrategyType,
          asset:           body.asset,
          assetCategory:   body.assetCategory,
          timeframe:       body.timeframe,
          riskLevel:       body.riskLevel as RiskLevel | undefined,
          pricingModel:    body.pricingModel as PricingModel | undefined,
          price:           body.price,
          winRate:         body.winRate,
          profitFactor:    body.profitFactor,
          maxDrawdown:     body.maxDrawdown,
          totalTrades:     body.totalTrades,
          avgRR:           body.avgRR,
          monthlyReturn:   body.monthlyReturn,
          rules:           body.rules,
          entryConditions: body.entryConditions,
          exitConditions:  body.exitConditions,
          riskManagement:  body.riskManagement,
          tags:            body.tags,
          version:         body.version,
          disclaimer:      body.disclaimer,
          linkedCourseId:  body.linkedCourseId,
        }
      );
      created(res, strategy, "Strategy published");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "INVALID_STRATEGY_TYPE") {
        forbidden(res, "Only admins and mentors can publish official or educational strategies");
        return;
      }
      console.error("[strategy POST /]", err);
      internalError(res);
    }
  }
);

// ── GET /strategy/:id ─ Get one ────────────────────────────────────────────

router.get(
  "/:id",
  optionalAuthenticate,
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const viewerId = authReq.userId ?? undefined;

    try {
      ok(res, await strategyService.getStrategy(req.params.id, viewerId));
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "STRATEGY_NOT_FOUND") {
        notFound(res, "Strategy not found");
        return;
      }
      console.error("[strategy GET /:id]", err);
      internalError(res);
    }
  }
);

// ── PUT /strategy/:id ─ Update (author only, or admin) ─────────────────────

router.put(
  "/:id",
  authenticate,
  validate(UpdateStrategySchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof UpdateStrategySchema>;
    const isAdmin = authReq.permissions.includes("marketplace.strategy.remove");

    try {
      const strategy = await strategyService.updateStrategy(req.params.id, authReq.userId, isAdmin, {
        title:           body.title,
        description:     body.description,
        asset:           body.asset,
        assetCategory:   body.assetCategory,
        timeframe:       body.timeframe,
        riskLevel:       body.riskLevel as RiskLevel | undefined,
        pricingModel:    body.pricingModel as PricingModel | undefined,
        price:           body.price,
        rules:           body.rules,
        entryConditions: body.entryConditions,
        exitConditions:  body.exitConditions,
        riskManagement:  body.riskManagement,
        tags:            body.tags,
        version:         body.version,
        disclaimer:      body.disclaimer,
        linkedCourseId:  body.linkedCourseId,
      });
      ok(res, strategy, "Strategy updated");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "STRATEGY_NOT_FOUND")   { notFound(res, "Strategy not found");                     return; }
        if (err.message === "NOT_STRATEGY_AUTHOR")  { forbidden(res, "You can only edit your own strategies"); return; }
      }
      console.error("[strategy PUT /:id]", err);
      internalError(res);
    }
  }
);

// ── DELETE /strategy/:id ─ Delete (author or admin) ─────────────────────────

router.delete(
  "/:id",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const isAdmin = authReq.permissions.includes("marketplace.strategy.remove");

    try {
      await strategyService.deleteStrategy(
        req.params.id,
        authReq.userId,
        isAdmin,
        { actorHandle: authReq.handle, actorRole: authReq.roles[0] ?? "ADMIN" }
      );
      ok(res, null, "Strategy deleted");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "STRATEGY_NOT_FOUND")  { notFound(res, "Strategy not found");                       return; }
        if (err.message === "NOT_STRATEGY_AUTHOR") { forbidden(res, "You can only delete your own strategies"); return; }
      }
      console.error("[strategy DELETE /:id]", err);
      internalError(res);
    }
  }
);

// ── POST /strategy/:id/feature ─ Admin: feature ─────────────────────────────

router.post(
  "/:id/feature",
  authenticate,
  requirePermission("marketplace.strategy.feature"),
  validate(FeatureSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof FeatureSchema>;

    try {
      ok(res, await strategyService.featureStrategy(req.params.id, body.featured), "Strategy updated");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "STRATEGY_NOT_FOUND") {
        notFound(res, "Strategy not found");
        return;
      }
      console.error("[strategy POST /:id/feature]", err);
      internalError(res);
    }
  }
);

// ── POST /strategy/:id/verify ─ Admin: verify ───────────────────────────────

router.post(
  "/:id/verify",
  authenticate,
  requirePermission("marketplace.strategy.feature"),
  validate(VerifySchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof VerifySchema>;

    try {
      ok(res, await strategyService.verifyStrategy(req.params.id, body.verified), "Strategy updated");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "STRATEGY_NOT_FOUND") {
        notFound(res, "Strategy not found");
        return;
      }
      console.error("[strategy POST /:id/verify]", err);
      internalError(res);
    }
  }
);

// ── POST /strategy/:id/remove ─ Admin: moderation remove ───────────────────

router.post(
  "/:id/remove",
  authenticate,
  requirePermission("marketplace.strategy.remove"),
  validate(RemoveSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof RemoveSchema>;

    try {
      await strategyService.removeStrategy(
        req.params.id,
        { actorId: authReq.userId, actorHandle: authReq.handle, actorRole: authReq.roles[0] ?? "ADMIN" },
        body.reason
      );
      ok(res, null, "Strategy removed");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "STRATEGY_NOT_FOUND") {
        notFound(res, "Strategy not found");
        return;
      }
      console.error("[strategy POST /:id/remove]", err);
      internalError(res);
    }
  }
);

// ── GET /strategy/:id/reviews ─ List reviews ────────────────────────────────

router.get(
  "/:id/reviews",
  optionalAuthenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const query = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      ok(res, await strategyService.getReviews(req.params.id, query.page, query.pageSize));
    } catch (err) {
      console.error("[strategy GET /:id/reviews]", err);
      internalError(res);
    }
  }
);

// ── POST /strategy/:id/reviews ─ Add review ─────────────────────────────────

router.post(
  "/:id/reviews",
  authenticate,
  validate(ReviewSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof ReviewSchema>;

    try {
      const review = await strategyService.addReview(
        req.params.id,
        authReq.userId,
        authReq.handle,
        body.rating,
        body.comment
      );
      created(res, review, "Review added");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "STRATEGY_NOT_FOUND")           { notFound(res, "Strategy not found");                    return; }
        if (err.message === "CANNOT_REVIEW_OWN_STRATEGY")   { badRequest(res, "You cannot review your own strategy"); return; }
        if (err.message === "ALREADY_REVIEWED")             { badRequest(res, "You already reviewed this strategy"); return; }
      }
      console.error("[strategy POST /:id/reviews]", err);
      internalError(res);
    }
  }
);

// ── PUT /strategy/:id/reviews/:reviewId ─ Edit review ───────────────────────

router.put(
  "/:id/reviews/:reviewId",
  authenticate,
  validate(EditReviewSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof EditReviewSchema>;

    try {
      const review = await strategyService.editReview(req.params.reviewId, authReq.userId, body);
      ok(res, review, "Review updated");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "REVIEW_NOT_FOUND")   { notFound(res, "Review not found");                  return; }
        if (err.message === "NOT_REVIEW_AUTHOR")  { forbidden(res, "You can only edit your own review"); return; }
      }
      console.error("[strategy PUT /:id/reviews/:reviewId]", err);
      internalError(res);
    }
  }
);

// ── DELETE /strategy/:id/reviews/:reviewId ─ Delete review (reviewer or admin) ──

router.delete(
  "/:id/reviews/:reviewId",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const isAdmin = authReq.permissions.includes("marketplace.review.remove");

    try {
      await strategyService.deleteReview(
        req.params.reviewId,
        authReq.userId,
        isAdmin,
        { actorHandle: authReq.handle, actorRole: authReq.roles[0] ?? "ADMIN" }
      );
      ok(res, null, "Review deleted");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "REVIEW_NOT_FOUND")  { notFound(res, "Review not found");                    return; }
        if (err.message === "NOT_REVIEW_AUTHOR") { forbidden(res, "You can only delete your own review"); return; }
      }
      console.error("[strategy DELETE /:id/reviews/:reviewId]", err);
      internalError(res);
    }
  }
);

// ── POST /strategy/:id/save ─ Toggle save ───────────────────────────────────

router.post(
  "/:id/save",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await strategyService.saveStrategy(req.params.id, authReq.userId));
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "STRATEGY_NOT_FOUND") {
        notFound(res, "Strategy not found");
        return;
      }
      console.error("[strategy POST /:id/save]", err);
      internalError(res);
    }
  }
);

// ── POST /strategy/:id/playbook ─ Toggle playbook ───────────────────────────

router.post(
  "/:id/playbook",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await strategyService.togglePlaybook(req.params.id, authReq.userId));
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "STRATEGY_NOT_SAVED") {
        badRequest(res, "Save this strategy before adding it to your playbook");
        return;
      }
      console.error("[strategy POST /:id/playbook]", err);
      internalError(res);
    }
  }
);

export default router;
