/**
 * TCC Analytics Routes — /api/analytics
 */
import { Router }         from "express";
import { z }              from "zod";
import { analyticsService } from "../server/services/analyticsService";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { validate }                       from "../middleware/validate";
import { ok, internalError }              from "../lib/response";

const router = Router();
router.use(authenticate);

const DateFilterSchema = z.object({
  from: z.string().datetime().optional(),
  to:   z.string().datetime().optional(),
});

const MonthlySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

// GET /analytics/overview
router.get("/overview", validate(DateFilterSchema, "query"), async (req, res) => {
  const authReq = req as AuthRequest;
  const q       = req.query as z.infer<typeof DateFilterSchema>;
  try {
    const data = await analyticsService.getOverview(authReq.userId, {
      from: q.from ? new Date(q.from) : undefined,
      to:   q.to   ? new Date(q.to)   : undefined,
    });
    ok(res, data);
  } catch (err) {
    console.error("[analytics/overview]", err);
    internalError(res);
  }
});

// GET /analytics/full — all analytics in one response
router.get("/full", validate(DateFilterSchema, "query"), async (req, res) => {
  const authReq = req as AuthRequest;
  const q       = req.query as z.infer<typeof DateFilterSchema>;
  try {
    const data = await analyticsService.getFullAnalytics(authReq.userId, {
      from: q.from ? new Date(q.from) : undefined,
      to:   q.to   ? new Date(q.to)   : undefined,
    });
    ok(res, data);
  } catch (err) {
    console.error("[analytics/full]", err);
    internalError(res);
  }
});

// GET /analytics/daily
router.get("/daily", validate(DateFilterSchema, "query"), async (req, res) => {
  const authReq = req as AuthRequest;
  const q       = req.query as z.infer<typeof DateFilterSchema>;
  try {
    const data = await analyticsService.getDailyStats(
      authReq.userId,
      q.from ? new Date(q.from) : undefined,
      q.to   ? new Date(q.to)   : undefined
    );
    ok(res, data);
  } catch (err) {
    console.error("[analytics/daily]", err);
    internalError(res);
  }
});

// GET /analytics/weekly
router.get("/weekly", validate(DateFilterSchema, "query"), async (req, res) => {
  const authReq = req as AuthRequest;
  const q       = req.query as z.infer<typeof DateFilterSchema>;
  try {
    const data = await analyticsService.getWeeklyStats(
      authReq.userId,
      q.from ? new Date(q.from) : undefined,
      q.to   ? new Date(q.to)   : undefined
    );
    ok(res, data);
  } catch (err) {
    console.error("[analytics/weekly]", err);
    internalError(res);
  }
});

// GET /analytics/monthly
router.get("/monthly", validate(MonthlySchema, "query"), async (req, res) => {
  const authReq = req as AuthRequest;
  const q       = req.query as z.infer<typeof MonthlySchema>;
  try {
    const data = await analyticsService.getMonthlyStats(authReq.userId, q.year);
    ok(res, data);
  } catch (err) {
    console.error("[analytics/monthly]", err);
    internalError(res);
  }
});

// GET /analytics/symbols
router.get("/symbols", validate(DateFilterSchema, "query"), async (req, res) => {
  const authReq = req as AuthRequest;
  const q       = req.query as z.infer<typeof DateFilterSchema>;
  try {
    const data = await analyticsService.getSymbolStats(authReq.userId, {
      from: q.from ? new Date(q.from) : undefined,
      to:   q.to   ? new Date(q.to)   : undefined,
    });
    ok(res, data);
  } catch (err) {
    console.error("[analytics/symbols]", err);
    internalError(res);
  }
});

// GET /analytics/sessions
router.get("/sessions", validate(DateFilterSchema, "query"), async (req, res) => {
  const authReq = req as AuthRequest;
  const q       = req.query as z.infer<typeof DateFilterSchema>;
  try {
    const data = await analyticsService.getSessionStats(authReq.userId, {
      from: q.from ? new Date(q.from) : undefined,
      to:   q.to   ? new Date(q.to)   : undefined,
    });
    ok(res, data);
  } catch (err) {
    console.error("[analytics/sessions]", err);
    internalError(res);
  }
});

export default router;