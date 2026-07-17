import { Router } from "express";
import { z } from "zod";
import { tradeService } from "../server/services/tradeService";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import {
  ok,
  created,
  notFound,
  badRequest,
  internalError,
} from "../lib/response";

const router = Router();

router.use(authenticate);

const OpenSchema = z.object({
  symbol: z.string().min(1),
  displayName: z.string().min(1),
  category: z.string().min(1),
  emoji: z.string().nullable().optional(),
  side: z.enum(["BUY", "SELL"]),
  lotSize: z.number().positive(),
  entryPrice: z.number().positive(),
  sl: z.number().positive().nullable().optional(),
  tp: z.number().positive().nullable().optional(),
  marginUsed: z.number().min(0).default(0),
  notionalValue: z.number().min(0).default(0),
  leverage: z.number().int().positive().default(10),
  openedAt: z.string().datetime().optional(),
});

const CloseSchema = z.object({
  exitPrice: z.number().positive(),
  closeReason: z.enum(["MANUAL", "STOP_LOSS", "TAKE_PROFIT"]),
  grossPnl: z.number(),
  durationMs: z.number().int().nonnegative(),
});

const SLTPSchema = z.object({
  sl: z.number().positive().nullable().optional(),
  tp: z.number().positive().nullable().optional(),
});

const SnapSchema = z.object({
  balance: z.number(),
  equity: z.number(),
  floatingPnl: z.number().default(0),
  marginUsed: z.number().default(0),
  freeMargin: z.number(),
  marginLevel: z.number().nullable().optional(),
});

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  symbol: z.string().optional(),
  side: z.enum(["BUY", "SELL"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

router.get("/", async (req, res) => {
  const a = req as unknown as AuthRequest;

  try {
    ok(res, await tradeService.getOpenPositions(a.userId));
  } catch (e) {
    console.error("[trade/open]", e);
    internalError(res);
  }
});

router.get("/account", async (req, res) => {
  const a = req as unknown as AuthRequest;

  try {
    ok(res, await tradeService.getAccountState(a.userId));
  } catch (e) {
    console.error("[trade/acct]", e);
    internalError(res);
  }
});

router.get("/closed", validate(ListSchema, "query"), async (req, res) => {
  const a = req as unknown as AuthRequest;
  const q = req.query as unknown as z.infer<typeof ListSchema>;

  try {
    ok(
      res,
      await tradeService.getClosedTrades(a.userId, {
        page: q.page,
        pageSize: q.pageSize,
        symbol: q.symbol,
        side: q.side as any,
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
      })
    );
  } catch (e) {
    console.error("[trade/closed]", e);
    internalError(res);
  }
});

router.get("/:id", async (req, res) => {
  const a = req as unknown as AuthRequest;

  try {
    ok(res, await tradeService.getTradeById(req.params.id, a.userId));
  } catch (e: any) {
    if (e.message === "TRADE_NOT_FOUND") {
      notFound(res, "Trade not found");
      return;
    }
    internalError(res);
  }
});

router.post("/", validate(OpenSchema), async (req, res) => {
  const a = req as unknown as AuthRequest;
  const b = req.body as z.infer<typeof OpenSchema>;

  try {
    created(
      res,
      await tradeService.openPosition(a.userId, {
        ...b,
        userId: a.userId,
        side: b.side as any,
        openedAt: b.openedAt ? new Date(b.openedAt) : undefined,
      }),
      "Position opened"
    );
  } catch (e) {
    console.error("[trade/post]", e);
    internalError(res);
  }
});

router.put("/:id/sltp", validate(SLTPSchema), async (req, res) => {
  const a = req as unknown as AuthRequest;
  const b = req.body as z.infer<typeof SLTPSchema>;

  try {
    ok(
      res,
      await tradeService.updateSLTP(req.params.id, a.userId, b.sl, b.tp),
      "SL/TP updated"
    );
  } catch (e: any) {
    if (e.message === "TRADE_NOT_FOUND") {
      notFound(res, "Trade not found");
      return;
    }

    if (e.message === "TRADE_ALREADY_CLOSED") {
      badRequest(res, "Trade already closed");
      return;
    }

    internalError(res);
  }
});

router.post("/:id/close", validate(CloseSchema), async (req, res) => {
  const a = req as unknown as AuthRequest;
  const b = req.body as z.infer<typeof CloseSchema>;

  try {
    ok(
      res,
      await tradeService.closePosition(req.params.id, a.userId, {
        exitPrice: b.exitPrice,
        closeReason: b.closeReason as any,
        grossPnl: b.grossPnl,
        durationMs: b.durationMs,
      }),
      "Position closed"
    );
  } catch (e: any) {
    if (
      e.message === "TRADE_NOT_FOUND" ||
      e.message === "TRADE_NOT_FOUND_OR_ALREADY_CLOSED"
    ) {
      notFound(res, "Trade not found or already closed");
      return;
    }

    if (e.message === "TRADE_ALREADY_CLOSED") {
      badRequest(res, "Trade already closed");
      return;
    }

    console.error("[trade/close]", e);
    internalError(res);
  }
});

router.delete("/:id", async (req, res) => {
  const a = req as unknown as AuthRequest;

  try {
    await tradeService.deleteOpenTrade(req.params.id, a.userId);
    ok(res, null, "Deleted");
  } catch (e: any) {
    if (e.message?.includes("NOT_FOUND")) {
      notFound(res, "Open trade not found");
      return;
    }

    console.error("[trade/del]", e);
    internalError(res);
  }
});

router.post("/account/snapshot", validate(SnapSchema), async (req, res) => {
  const a = req as unknown as AuthRequest;
  const b = req.body as z.infer<typeof SnapSchema>;

  try {
    ok(res, await tradeService.saveAccountSnapshot(a.userId, b));
  } catch (e) {
    console.error("[trade/snap]", e);
    internalError(res);
  }
});

export default router;