/**
 * TCC Journal Routes — /api/journal
 */
import { Router }   from "express";
import { z }        from "zod";
import { journalService } from "../server/services/journalService";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { validate }                       from "../middleware/validate";
import { ok, notFound, internalError }    from "../lib/response";

const router = Router();
router.use(authenticate);

const UpdateJournalSchema = z.object({
  emotion:         z.string().optional(),
  confidenceLevel: z.number().int().min(1).max(10).optional(),
  stressLevel:     z.number().int().min(1).max(10).optional(),
  entryQuality:    z.string().optional(),
  followedPlan:    z.boolean().nullable().optional(),
  strategy:        z.string().optional(),
  marketStructure: z.string().optional(),
  session:         z.string().optional(),
  timeframe:       z.string().optional(),
  notes:           z.string().max(5000).optional(),
  whatWentRight:   z.string().max(2000).optional(),
  whatWentWrong:   z.string().max(2000).optional(),
  lessonLearned:   z.string().max(2000).optional(),
  tags:            z.array(z.string()).optional(),
  aiAnalysis:      z.string().max(5000).optional(),
});

const ListJournalSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  symbol:   z.string().optional(),
  session:  z.string().optional(),
  strategy: z.string().optional(),
  from:     z.string().datetime().optional(),
  to:       z.string().datetime().optional(),
});

// GET /journal
router.get("/", validate(ListJournalSchema, "query"), async (req, res) => {
  const authReq = req as AuthRequest;
  const q       = req.query as z.infer<typeof ListJournalSchema>;
  try {
    const result = await journalService.getEntries(authReq.userId, {
      page:     q.page,
      pageSize: q.pageSize,
      symbol:   q.symbol,
      session:  q.session,
      strategy: q.strategy,
      from:     q.from ? new Date(q.from) : undefined,
      to:       q.to   ? new Date(q.to)   : undefined,
    });
    ok(res, result);
  } catch (err) {
    console.error("[journal/list]", err);
    internalError(res);
  }
});

// GET /journal/:id
router.get("/:id", async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const entry = await journalService.getEntryById(req.params.id, authReq.userId);
    ok(res, entry);
  } catch (err: any) {
    if (err.message === "JOURNAL_ENTRY_NOT_FOUND") { notFound(res, "Journal entry not found"); return; }
    console.error("[journal/get/:id]", err);
    internalError(res);
  }
});

// GET /journal/trade/:tradeId
router.get("/trade/:tradeId", async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const entry = await journalService.getEntryByTradeId(req.params.tradeId, authReq.userId);
    ok(res, entry);
  } catch (err: any) {
    if (err.message === "JOURNAL_ENTRY_NOT_FOUND") { notFound(res, "Journal entry not found"); return; }
    console.error("[journal/trade/:id]", err);
    internalError(res);
  }
});

// PUT /journal/:id
router.put("/:id", validate(UpdateJournalSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  const body    = req.body as z.infer<typeof UpdateJournalSchema>;
  try {
    const entry = await journalService.updateEntry(req.params.id, authReq.userId, body);
    ok(res, entry, "Journal entry updated");
  } catch (err: any) {
    if (err.message === "JOURNAL_ENTRY_NOT_FOUND") { notFound(res, "Journal entry not found"); return; }
    console.error("[journal/update]", err);
    internalError(res);
  }
});

export default router;