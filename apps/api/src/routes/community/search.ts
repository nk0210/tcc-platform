/**
 * Community Search Routes
 * Mounted at: /community/search
 */
import { Router } from "express";
import { z }      from "zod";
import { optionalAuthenticate, type AuthRequest } from "../../middleware/authenticate";
import { validate }                 from "../../middleware/validate";
import { communitySearchService }   from "../../server/services/communitySearchService";
import { ok, internalError }        from "../../lib/response";

const router: ReturnType<typeof Router> = Router();

const SearchSchema = z.object({
  q:     z.string().min(1).max(100),
  limit: z.coerce.number().int().positive().max(20).default(8),
});

// ── GET /search?q=&limit= ─ People + posts + hashtags ─────────────────────

router.get(
  "/",
  optionalAuthenticate,
  validate(SearchSchema, "query"),
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const query    = req.query as unknown as z.infer<typeof SearchSchema>;
    const viewerId = authReq.userId ?? undefined;

    try {
      const results = await communitySearchService.search(query.q, viewerId, query.limit);
      ok(res, results);
    } catch (err) {
      console.error("[community/search GET /]", err);
      internalError(res);
    }
  }
);

export default router;
