/**
 * TCC Trade Routes — /api/trade
 *
 * All routes authenticated. Users access only their own data.
 * Business logic delegated to tradeService.
 */
import { Router }  from "express";
import { z }       from "zod";
import { tradeService } from "../server/services/tradeService";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { validate }                       from "../middleware/validate";
import {
  ok, created, notFound, badRequest, internalError,
} from "../lib/response";

const router = Router();
router.use(authenticate);

// ── Schemas ────────────────────────────────────────────────────────────────

const OpenTradeSchema = z.object({
  symbol:        z.string().min(1),
  displayName:   z.string().min(1),
  category:      z.string().min(1),
  emoji:         z.string().optional(),
  side:          z.enum(["BUY", "SELL"]),
  lotSize:       z.number().positive(),
  entryPrice:    z.number().positive(),
  sl:            z.number().positive().nullable().optional(),
  tp:            z.number().positive().nullable().optional(),
  marginUsed:    z.number().min(0).default(0),
  notionalValue: z.number().min(0).default(0),
  leverage:      z.number().int().positive().default(10),
  openedAt:      z.string().datetime().optional(),
});

const CloseTradeSchema = z.object({
  exitPrice:   z.number().positive(),
  closeReason: z.enum(["MANUAL", "STOP_LOSS", "TAKE_PROFIT"]),
  grossPnl:    z.number(),
  durationMs:  z.number().int().nonnegative(),
});

const UpdateSLTPSchema = z.object({
  sl: z.number().positive().nullable().optional(),
  tp: z.number().positive().nullable().optional(),
});

const AccountSnapshotSchema = z.object({
  balance:     z.number(),
  equity:      z.number(),
  floatingPnl: z.number().default(0),
  marginUsed:  z.number().default(0),
  freeMargin:  z.number(),
  marginLevel: z.number().nullable().optional(),
});

const ListTradesSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  symbol:   z.string().optional(),
  side:     z.enum(["BUY", "SELL"]).optional(),
  from:     z.string().datetime().optional(),
  to:       z.string().datetime().optional(),
});

// ── GET /trade — open positions ────────────────────────────────────────────

router.get("/", async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const positions = await tradeService.getOpenPositions(authReq.userId);
    ok(res, positions);
  } catch (err) {
    console.error("[trade/open]", err);
    internalError(res);
  }
});

// ── GET /trade/closed — closed trades (paginated) ─────────────────────────

router.get("/closed", validate(ListTradesSchema, "query"), async (req, res) => {
  const authReq = req as AuthRequest;
  const q       = req.query as z.infer<typeof ListTradesSchema>;
  try {
    const result = await tradeService.getClosedTrades(authReq.userId, {
      page:     q.page,
      pageSize: q.pageSize,
      symbol:   q.symbol,
      side:     q.side as any,
      from:     q.from ? new Date(q.from) : undefined,
      to:       q.to   ? new Date(q.to)   : undefined,
    });
    ok(res, result);
  } catch (err) {
    console.error("[trade/closed]", err);
    internalError(res);
  }
});

// ── GET /trade/account — account state ────────────────────────────────────

router.get("/account", async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const state = await tradeService.getAccountState(authReq.userId);
    ok(res, state);
  } catch (err) {
    console.error("[trade/account]", err);
    internalError(res);
  }
});

// ── GET /trade/:id — single trade ─────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const trade = await tradeService.getTradeById(req.params.id, authReq.userId);
    ok(res, trade);
  } catch (err: any) {
    if (err.message === "TRADE_NOT_FOUND") { notFound(res, "Trade not found"); return; }
    console.error("[trade/get/:id]", err);
    internalError(res);
  }
});

// ── POST /trade — open a position ─────────────────────────────────────────

router.post("/", validate(OpenTradeSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  const body    = req.body as z.infer<typeof OpenTradeSchema>;
  try {
    const trade = await tradeService.openPosition(authReq.userId, {
      ...body,
      userId:   authReq.userId,
      side:     body.side as any,
      openedAt: body.openedAt ? new Date(body.openedAt) : undefined,
    });
    created(res, trade, "Position opened");
  } catch (err) {
    console.error("[trade/open]", err);
    internalError(res);
  }
});

// ── PUT /trade/:id/sltp — update SL/TP ────────────────────────────────────

router.put("/:id/sltp", validate(UpdateSLTPSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  const body    = req.body as z.infer<typeof UpdateSLTPSchema>;
  try {
    const trade = await tradeService.updateSLTP(req.params.id, authReq.userId, body.sl, body.tp);
    ok(res, trade, "SL/TP updated");
  } catch (err: any) {
    if (err.message === "TRADE_NOT_FOUND")        { notFound(res, "Trade not found");       return; }
    if (err.message === "TRADE_ALREADY_CLOSED")   { badRequest(res, "Trade is already closed"); return; }
    console.error("[trade/sltp]", err);
    internalError(res);
  }
});

// ── POST /trade/:id/close — close a position ──────────────────────────────

router.post("/:id/close", validate(CloseTradeSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  const body    = req.body as z.infer<typeof CloseTradeSchema>;
  try {
    const result = await tradeService.closePosition(req.params.id, authReq.userId, {
      exitPrice:   body.exitPrice,
      closeReason: body.closeReason as any,
      grossPnl:    body.grossPnl,
      durationMs:  body.durationMs,
    });
    ok(res, result, "Position closed");
  } catch (err: any) {
    if (err.message === "TRADE_NOT_FOUND")                      { notFound(res, "Trade not found");            return; }
    if (err.message === "TRADE_ALREADY_CLOSED")                 { badRequest(res, "Trade is already closed");  return; }
    if (err.message === "TRADE_NOT_FOUND_OR_ALREADY_CLOSED")    { badRequest(res, "Trade not found or already closed"); return; }
    console.error("[trade/close]", err);
    internalError(res);
  }
});

// ── DELETE /trade/:id — delete an open trade ──────────────────────────────

router.delete("/:id", async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    await tradeService.deleteOpenTrade(req.params.id, authReq.userId);
    ok(res, null, "Trade deleted");
  } catch (err: any) {
    if (err.message === "TRADE_NOT_FOUND" || err.message === "TRADE_NOT_FOUND_OR_ALREADY_CLOSED") {
      notFound(res, "Open trade not found");
      return;
    }
    console.error("[trade/delete]", err);
    internalError(res);
  }
});

// ── POST /trade/account/snapshot — save account state ────────────────────

router.post("/account/snapshot", validate(AccountSnapshotSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  const body    = req.body as z.infer<typeof AccountSnapshotSchema>;
  try {
    const snap = await tradeService.saveAccountSnapshot(authReq.userId, body);
    ok(res, snap);
  } catch (err) {
    console.error("[trade/account/snapshot]", err);
    internalError(res);
  }
});

export default router;