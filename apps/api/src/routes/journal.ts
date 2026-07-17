import { Router } from "express";
import { z } from "zod";
import { journalService } from "../server/services/journalService";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { ok, notFound, internalError } from "../lib/response";

const router = Router();

router.use(authenticate);

const UpdateSchema = z.object({
  emotion: z.string().optional(),
  confidenceLevel: z.number().int().min(1).max(10).optional(),
  stressLevel: z.number().int().min(1).max(10).optional(),
  entryQuality: z.string().optional(),
  followedPlan: z.boolean().nullable().optional(),
  strategy: z.string().optional(),
  marketStructure: z.string().optional(),
  session: z.string().optional(),
  timeframe: z.string().optional(),
  notes: z.string().max(5000).optional(),
  whatWentRight: z.string().max(2000).optional(),
  whatWentWrong: z.string().max(2000).optional(),
  lessonLearned: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  aiAnalysis: z.string().max(5000).optional(),
});

const ListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  symbol: z.string().optional(),
  session: z.string().optional(),
  strategy: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

router.get("/", validate(ListSchema, "query"), async (req, res) => {
  const a = req as unknown as AuthRequest;
  const q = req.query as unknown as z.infer<typeof ListSchema>;

  try {
    ok(
      res,
      await journalService.getEntries(a.userId, {
        page: q.page,
        pageSize: q.pageSize,
        symbol: q.symbol,
        session: q.session,
        strategy: q.strategy,
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
      })
    );
  } catch (e) {
    console.error("[journal/list]", e);
    internalError(res);
  }
});

// Must be before /:id
router.get("/trade/:tradeId", async (req, res) => {
  const a = req as unknown as AuthRequest;

  try {
    ok(res, await journalService.getEntryByTradeId(req.params.tradeId, a.userId));
  } catch (e: any) {
    if (e.message === "JOURNAL_ENTRY_NOT_FOUND") {
      notFound(res);
      return;
    }
    internalError(res);
  }
});

router.get("/:id", async (req, res) => {
  const a = req as unknown as AuthRequest;

  try {
    ok(res, await journalService.getEntryById(req.params.id, a.userId));
  } catch (e: any) {
    if (e.message === "JOURNAL_ENTRY_NOT_FOUND") {
      notFound(res);
      return;
    }
    internalError(res);
  }
});

router.put("/:id", validate(UpdateSchema), async (req, res) => {
  const a = req as unknown as AuthRequest;
  const b = req.body as z.infer<typeof UpdateSchema>;

  try {
    ok(
      res,
      await journalService.updateEntry(req.params.id, a.userId, b),
      "Updated"
    );
  } catch (e: any) {
    if (e.message === "JOURNAL_ENTRY_NOT_FOUND") {
      notFound(res);
      return;
    }

    console.error("[journal/put]", e);
    internalError(res);
  }
});

export default router;