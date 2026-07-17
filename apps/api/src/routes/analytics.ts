import { Router } from "express";
import { z } from "zod";

import { analyticsService } from "../server/services/analyticsService";
import {
  authenticate,
  type AuthRequest,
} from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { ok, internalError } from "../lib/response";

const router = Router();

router.use(authenticate);

const DateFilterSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const MonthlySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

function parseFilter(query: z.infer<typeof DateFilterSchema>) {
  return {
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
}

router.get(
  "/overview",
  validate(DateFilterSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query =
      req.query as unknown as z.infer<typeof DateFilterSchema>;

    try {
      ok(
        res,
        await analyticsService.getOverview(
          authReq.userId,
          parseFilter(query)
        )
      );
    } catch (err) {
      console.error("[analytics/overview]", err);
      internalError(res);
    }
  }
);

router.get(
  "/full",
  validate(DateFilterSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query =
      req.query as unknown as z.infer<typeof DateFilterSchema>;

    try {
      ok(
        res,
        await analyticsService.getFullAnalytics(
          authReq.userId,
          parseFilter(query)
        )
      );
    } catch (err) {
      console.error("[analytics/full]", err);
      internalError(res);
    }
  }
);

router.get(
  "/daily",
  validate(DateFilterSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query =
      req.query as unknown as z.infer<typeof DateFilterSchema>;

    const filter = parseFilter(query);

    try {
      ok(
        res,
        await analyticsService.getDailyStats(
          authReq.userId,
          filter.from,
          filter.to
        )
      );
    } catch (err) {
      console.error("[analytics/daily]", err);
      internalError(res);
    }
  }
);

router.get(
  "/weekly",
  validate(DateFilterSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query =
      req.query as unknown as z.infer<typeof DateFilterSchema>;

    const filter = parseFilter(query);

    try {
      ok(
        res,
        await analyticsService.getWeeklyStats(
          authReq.userId,
          filter.from,
          filter.to
        )
      );
    } catch (err) {
      console.error("[analytics/weekly]", err);
      internalError(res);
    }
  }
);

router.get(
  "/monthly",
  validate(MonthlySchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query =
      req.query as unknown as z.infer<typeof MonthlySchema>;

    try {
      ok(
        res,
        await analyticsService.getMonthlyStats(
          authReq.userId,
          query.year
        )
      );
    } catch (err) {
      console.error("[analytics/monthly]", err);
      internalError(res);
    }
  }
);

router.get(
  "/symbols",
  validate(DateFilterSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query =
      req.query as unknown as z.infer<typeof DateFilterSchema>;

    try {
      ok(
        res,
        await analyticsService.getSymbolStats(
          authReq.userId,
          parseFilter(query)
        )
      );
    } catch (err) {
      console.error("[analytics/symbols]", err);
      internalError(res);
    }
  }
);

router.get(
  "/sessions",
  validate(DateFilterSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query =
      req.query as unknown as z.infer<typeof DateFilterSchema>;

    try {
      ok(
        res,
        await analyticsService.getSessionStats(
          authReq.userId,
          parseFilter(query)
        )
      );
    } catch (err) {
      console.error("[analytics/sessions]", err);
      internalError(res);
    }
  }
);

export default router;