/**
 * Risk Score Routes
 * Mounted at: /risk
 */
import { Router } from "express";
import { authenticate, optionalAuthenticate, type AuthRequest } from "../middleware/authenticate";
import { riskScoreService } from "../server/services/riskScoreService";
import { ok, notFound, forbidden, internalError } from "../lib/response";

const router: ReturnType<typeof Router> = Router();

// ── GET /risk/score ─ Own risk score ─────────────────────────────────────
//
// NOTE: this endpoint is compute-heavy — it pulls the user's full closed-trade
// history, daily analytics, and journal history on every call. Phase Beta
// should add Redis caching here (5 minute TTL, keyed by userId).

router.get(
  "/score",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await riskScoreService.calculateRiskScore(authReq.userId));
    } catch (err) {
      console.error("[risk GET /score]", err);
      internalError(res);
    }
  }
);

// ── GET /risk/score/:handle ─ Public risk score (portfolio-visibility gated) ─

router.get(
  "/score/:handle",
  optionalAuthenticate,
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const viewerId = authReq.userId ?? undefined;

    try {
      ok(res, await riskScoreService.calculateRiskScoreForHandle(req.params.handle, viewerId));
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "USER_NOT_FOUND")      { notFound(res, "User not found");                          return; }
        if (err.message === "PORTFOLIO_NOT_PUBLIC") { forbidden(res, "This trader's portfolio is not public"); return; }
      }
      console.error("[risk GET /score/:handle]", err);
      internalError(res);
    }
  }
);

export default router;
