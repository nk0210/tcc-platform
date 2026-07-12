/**
 * TCC Watchlist Routes — /api/watchlist
 */
import { Router }       from "express";
import { z }            from "zod";
import { watchlistService } from "../server/services/watchlistService";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { validate }                       from "../middleware/validate";
import { ok, internalError }              from "../lib/response";

const router = Router();
router.use(authenticate);

const AddItemSchema = z.object({
  symbol:      z.string().min(1),
  displayName: z.string().min(1),
  category:    z.string().min(1),
  emoji:       z.string().optional(),
});

// GET /watchlist — get the user's watchlist
router.get("/", async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const watchlist = await watchlistService.getWatchlist(authReq.userId);
    ok(res, watchlist);
  } catch (err) {
    console.error("[watchlist/get]", err);
    internalError(res);
  }
});

// POST /watchlist — add a symbol
router.post("/", validate(AddItemSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  const body    = req.body as z.infer<typeof AddItemSchema>;
  try {
    const item = await watchlistService.addSymbol(authReq.userId, body);
    ok(res, item, "Symbol added to watchlist");
  } catch (err) {
    console.error("[watchlist/add]", err);
    internalError(res);
  }
});

// DELETE /watchlist/:symbol — remove a symbol
router.delete("/:symbol", async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    await watchlistService.removeSymbol(authReq.userId, req.params.symbol);
    ok(res, null, "Symbol removed from watchlist");
  } catch (err) {
    console.error("[watchlist/remove]", err);
    internalError(res);
  }
});

// DELETE /watchlist — clear all symbols
router.delete("/", async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    await watchlistService.clearWatchlist(authReq.userId);
    ok(res, null, "Watchlist cleared");
  } catch (err) {
    console.error("[watchlist/clear]", err);
    internalError(res);
  }
});

// GET /watchlist/check/:symbol — is symbol in watchlist
router.get("/check/:symbol", async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const inWatchlist = await watchlistService.isInWatchlist(authReq.userId, req.params.symbol);
    ok(res, { symbol: req.params.symbol, inWatchlist });
  } catch (err) {
    console.error("[watchlist/check]", err);
    internalError(res);
  }
});

export default router;