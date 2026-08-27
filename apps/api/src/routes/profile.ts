/**
 * Profile Routes
 * Mounted at: /profile
 *
 * Covers: own profile (view/update/social-links/trading-identity/stats/
 *         completeness), user search, follow suggestions, and public
 *         (visibility-gated) profiles.
 */
import { Router } from "express";
import { z }      from "zod";
import { authenticate, optionalAuthenticate, type AuthRequest } from "../middleware/authenticate";
import { validate }               from "../middleware/validate";
import { profileService }         from "../server/services/profileService";
import { ok, notFound, forbidden, internalError } from "../lib/response";

const router: ReturnType<typeof Router> = Router();

// ── Schemas ────────────────────────────────────────────────────────────────

const VISIBILITIES     = ["PUBLIC", "PRIVATE", "FOLLOWERS_ONLY"] as const;
const EXPERIENCE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"] as const;

const PaginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

const SearchSchema = PaginationSchema.extend({
  q: z.string().min(1).max(100),
});

const ProfileUpdateSchema = z.object({
  displayName:         z.string().min(1).max(50).optional(),
  bio:                 z.string().max(500).optional(),
  location:            z.string().max(100).optional(),
  avatarUrl:           z.string().max(500).optional().nullable(),
  profileVisibility:   z.enum(VISIBILITIES).optional(),
  portfolioVisibility: z.enum(VISIBILITIES).optional(),
  experienceLevel:     z.enum(EXPERIENCE_LEVELS).optional().nullable(),
});

const SocialLinksSchema = z.object({
  website:   z.string().url().max(300).optional().nullable(),
  x:         z.string().max(300).optional().nullable(),
  linkedin:  z.string().max(300).optional().nullable(),
  youtube:   z.string().max(300).optional().nullable(),
  instagram: z.string().max(300).optional().nullable(),
});

const TradingIdentitySchema = z.object({
  marketsTraded:     z.array(z.string().max(50)).max(20).optional(),
  symbolsTraded:     z.array(z.string().max(50)).max(50).optional(),
  strategiesUsed:    z.array(z.string().max(50)).max(20).optional(),
  preferredSessions: z.array(z.string().max(50)).max(10).optional(),
});

// ── GET /profile/me ─ Own full profile ──────────────────────────────────────

router.get(
  "/me",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await profileService.getOwnProfile(authReq.userId));
    } catch (err) {
      console.error("[profile GET /me]", err);
      internalError(res);
    }
  }
);

// ── PUT /profile/me ─ Update own profile ────────────────────────────────────

router.put(
  "/me",
  authenticate,
  validate(ProfileUpdateSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof ProfileUpdateSchema>;

    try {
      const profile = await profileService.updateProfile(authReq.userId, {
        displayName:         body.displayName,
        bio:                 body.bio,
        location:            body.location,
        avatarUrl:           body.avatarUrl,
        profileVisibility:   body.profileVisibility,
        portfolioVisibility: body.portfolioVisibility,
        experienceLevel:     body.experienceLevel,
      });
      ok(res, profile, "Profile updated");
    } catch (err) {
      console.error("[profile PUT /me]", err);
      internalError(res);
    }
  }
);

// ── PUT /profile/me/social-links ─ Update social links ─────────────────────

router.put(
  "/me/social-links",
  authenticate,
  validate(SocialLinksSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof SocialLinksSchema>;

    try {
      ok(res, await profileService.updateSocialLinks(authReq.userId, body), "Social links updated");
    } catch (err) {
      console.error("[profile PUT /me/social-links]", err);
      internalError(res);
    }
  }
);

// ── PUT /profile/me/trading-identity ─ Update trading identity ─────────────

router.put(
  "/me/trading-identity",
  authenticate,
  validate(TradingIdentitySchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof TradingIdentitySchema>;

    try {
      ok(res, await profileService.updateTradingIdentity(authReq.userId, body), "Trading identity updated");
    } catch (err) {
      console.error("[profile PUT /me/trading-identity]", err);
      internalError(res);
    }
  }
);

// ── GET /profile/me/stats ─ Own trading stats ───────────────────────────────

router.get(
  "/me/stats",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await profileService.getTradingStats(authReq.userId));
    } catch (err) {
      console.error("[profile GET /me/stats]", err);
      internalError(res);
    }
  }
);

// ── GET /profile/me/completeness ─ Completeness score ───────────────────────

router.get(
  "/me/completeness",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await profileService.getProfileCompleteness(authReq.userId));
    } catch (err) {
      console.error("[profile GET /me/completeness]", err);
      internalError(res);
    }
  }
);

// ── GET /profile/search?q= ─ Search users ───────────────────────────────────

router.get(
  "/search",
  optionalAuthenticate,
  validate(SearchSchema, "query"),
  async (req, res) => {
    const query = req.query as unknown as z.infer<typeof SearchSchema>;

    try {
      ok(res, await profileService.searchUsers(query.q, { page: query.page, pageSize: query.pageSize }));
    } catch (err) {
      console.error("[profile GET /search]", err);
      internalError(res);
    }
  }
);

// ── GET /profile/suggested ─ Suggested users to follow ──────────────────────

router.get(
  "/suggested",
  authenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      ok(res, await profileService.getSuggestedUsers(authReq.userId, query));
    } catch (err) {
      console.error("[profile GET /suggested]", err);
      internalError(res);
    }
  }
);

// ── GET /profile/:handle ─ Public profile (visibility-gated) ───────────────

router.get(
  "/:handle",
  optionalAuthenticate,
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const viewerId = authReq.userId ?? undefined;

    try {
      ok(res, await profileService.getPublicProfile(req.params.handle, viewerId));
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "PROFILE_NOT_FOUND") {
        notFound(res, "Profile not found");
        return;
      }
      console.error("[profile GET /:handle]", err);
      internalError(res);
    }
  }
);

// ── GET /profile/:handle/stats ─ Trading stats (portfolio-visibility gated) ─

router.get(
  "/:handle/stats",
  optionalAuthenticate,
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const viewerId = authReq.userId ?? undefined;

    try {
      ok(res, await profileService.getTradingStatsForHandle(req.params.handle, viewerId));
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "PROFILE_NOT_FOUND") { notFound(res, "Profile not found");                          return; }
        if (err.message === "STATS_HIDDEN")      { forbidden(res, "This trader's portfolio is not public");     return; }
      }
      console.error("[profile GET /:handle/stats]", err);
      internalError(res);
    }
  }
);

export default router;
