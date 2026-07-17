import { Router } from "express";
import { z } from "zod";
import { watchlistService } from "../server/services/watchlistService";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { ok, internalError } from "../lib/response";

const router = Router();

router.use(authenticate);

const AddSchema = z.object({
  symbol: z.string().min(1),
  displayName: z.string().min(1),
  category: z.string().min(1),
  emoji: z.string().nullable().optional(),
});

router.get("/", async (req, res) => {
  const a = req as unknown as AuthRequest;

  try {
    ok(res, await watchlistService.getWatchlist(a.userId));
  } catch (e) {
    console.error("[wl/get]", e);
    internalError(res);
  }
});

// /check/:symbol before /:symbol to avoid capture
router.get("/check/:symbol", async (req, res) => {
  const a = req as unknown as AuthRequest;

  try {
    ok(res, {
      symbol: req.params.symbol,
      inWatchlist: await watchlistService.isInWatchlist(
        a.userId,
        req.params.symbol
      ),
    });
  } catch (e) {
    console.error("[wl/check]", e);
    internalError(res);
  }
});

router.post("/", validate(AddSchema), async (req, res) => {
  const a = req as unknown as AuthRequest;
  const b = req.body as z.infer<typeof AddSchema>;

  try {
    ok(
      res,
      await watchlistService.addSymbol(a.userId, {
        symbol: b.symbol,
        displayName: b.displayName,
        category: b.category,
        emoji: b.emoji ?? null,
      }),
      "Added"
    );
  } catch (e) {
    console.error("[wl/add]", e);
    internalError(res);
  }
});

// /clear before /:symbol
router.delete("/clear", async (req, res) => {
  const a = req as unknown as AuthRequest;

  try {
    await watchlistService.clearWatchlist(a.userId);
    ok(res, null, "Cleared");
  } catch (e) {
    console.error("[wl/clear]", e);
    internalError(res);
  }
});

router.delete("/:symbol", async (req, res) => {
  const a = req as unknown as AuthRequest;

  try {
    await watchlistService.removeSymbol(a.userId, req.params.symbol);
    ok(res, null, "Removed");
  } catch (e) {
    console.error("[wl/rm]", e);
    internalError(res);
  }
});

export default router;