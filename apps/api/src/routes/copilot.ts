/**
 * Copilot Routes
 * Mounted at: /copilot
 */
import { Router, type Response } from "express";
import { z } from "zod";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { ok, notFound, conflict, badRequest, internalError } from "../lib/response";
import {
  chat,
  analyzeJournal,
  interpretAnalytics,
  getConversation,
  listConversations,
  deleteConversation,
  ConversationNotFoundError,
} from "../server/services/copilotService";
import {
  confirmAction,
  cancelAction,
  PendingActionNotFoundError,
  PendingActionNotAvailableError,
} from "../server/services/copilotActionService";
import { buildUserContext } from "../server/services/copilotContextService";
import { AIProviderNotConfiguredError } from "../server/services/copilotAiProvider";
import { listMemories, deleteMemory, updateMemory, MemoryNotFoundError } from "../server/services/copilotMemoryService";
import { getProviderMetricsSnapshot } from "../server/services/copilotObservability";

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

// ── Rate limiting (in-memory — Phase Beta should move this to Redis) ───────
// One agent turn can make several Groq calls (one per tool round-trip, up
// to MAX_AGENT_STEPS), so this caps *user messages*, not raw LLM calls —
// still the right unit to bound cost per user.

const RATE_LIMIT_MAX    = 20;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now   = Date.now();
  const entry = rateLimits.get(userId);

  if (!entry || entry.resetAt < now) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;

  entry.count += 1;
  return true;
}

function handleCopilotError(err: unknown, res: Response, routeLabel: string): void {
  if (err instanceof AIProviderNotConfiguredError) {
    res.status(503).json({ success: false, error: "AI service not configured. Add GROQ_API_KEY to apps/api/.env", code: "AI_NOT_CONFIGURED" });
    return;
  }
  console.error(`[copilot ${routeLabel}]`, err);
  internalError(res);
}

// ── Schemas ────────────────────────────────────────────────────────────────

// A hint only — never trusted for authorization. selectedEntity.type is
// restricted to entity types copilotContextOrchestrator.verifySelectedEntity()
// (Phase 8) actually knows how to re-verify; anything else is rejected here
// rather than silently ignored deeper in the stack.
const ContextSchema = z.object({
  currentModule:  z.string().max(50).optional(),
  currentPage:    z.string().max(50).optional(),
  selectedEntity: z.object({
    type: z.enum(["trade", "journal", "community_post", "copy_relationship"]),
    id:   z.string().min(1).max(100),
  }).optional(),
});

const ChatSchema = z.object({
  message:        z.string().min(1).max(2000),
  conversationId: z.string().min(1).optional(),
  context:        ContextSchema.optional(),
});

// ── POST /copilot/chat ─ Agent-backed chat ──────────────────────────────────

router.post(
  "/chat",
  validate(ChatSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof ChatSchema>;

    if (!checkRateLimit(authReq.userId)) {
      res.status(429).json({ success: false, error: "Copilot rate limit reached. Max 20 messages per hour.", code: "RATE_LIMIT" });
      return;
    }

    try {
      const result = await chat(authReq.userId, body.conversationId ?? null, body.message, body.context);
      ok(res, result);
    } catch (err: unknown) {
      if (err instanceof ConversationNotFoundError) {
        notFound(res, "Conversation not found");
        return;
      }
      handleCopilotError(err, res, "POST /chat");
    }
  }
);

// ── GET /copilot/conversations ─ List own conversations, paginated ─────────

const ListConversationsSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

router.get(
  "/conversations",
  validate(ListConversationsSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query    = req.query as unknown as z.infer<typeof ListConversationsSchema>;

    try {
      ok(res, await listConversations(authReq.userId, query));
    } catch (err) {
      console.error("[copilot GET /conversations]", err);
      internalError(res);
    }
  }
);

// ── GET /copilot/conversations/:id ─ Fetch one conversation (owner only) ───

router.get(
  "/conversations/:id",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await getConversation(req.params.id, authReq.userId));
    } catch (err: unknown) {
      if (err instanceof ConversationNotFoundError) {
        notFound(res, "Conversation not found");
        return;
      }
      console.error("[copilot GET /conversations/:id]", err);
      internalError(res);
    }
  }
);

// ── DELETE /copilot/conversations/:id ─ Delete own conversation (Phase 11) ─

router.delete(
  "/conversations/:id",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      await deleteConversation(req.params.id, authReq.userId);
      ok(res, { deleted: true });
    } catch (err: unknown) {
      if (err instanceof ConversationNotFoundError) {
        notFound(res, "Conversation not found");
        return;
      }
      console.error("[copilot DELETE /conversations/:id]", err);
      internalError(res);
    }
  }
);

// ── POST /copilot/actions/:id/confirm ─ Execute a pending MEDIUM/HIGH action

router.post(
  "/actions/:id/confirm",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await confirmAction(req.params.id, authReq.userId));
    } catch (err: unknown) {
      if (err instanceof PendingActionNotFoundError) {
        notFound(res, "Pending action not found");
        return;
      }
      if (err instanceof PendingActionNotAvailableError) {
        conflict(res, `This action is ${err.currentStatus.toLowerCase().replace("_", " ")} and can no longer be confirmed.`);
        return;
      }
      console.error("[copilot POST /actions/:id/confirm]", err);
      internalError(res);
    }
  }
);

// ── POST /copilot/actions/:id/cancel ─ Cancel a pending MEDIUM/HIGH action ─

router.post(
  "/actions/:id/cancel",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await cancelAction(req.params.id, authReq.userId));
    } catch (err: unknown) {
      if (err instanceof PendingActionNotFoundError) {
        notFound(res, "Pending action not found");
        return;
      }
      if (err instanceof PendingActionNotAvailableError) {
        conflict(res, `This action is ${err.currentStatus.toLowerCase().replace("_", " ")} and can no longer be cancelled.`);
        return;
      }
      console.error("[copilot POST /actions/:id/cancel]", err);
      internalError(res);
    }
  }
);

// ── GET /copilot/memories ─ List own memories, paginated (Phase 7) ─────────

const ListMemoriesSchema = z.object({
  type:     z.enum(["PREFERENCE", "GOAL", "TRADING_PREFERENCE", "COPILOT_PREFERENCE", "EXPLICIT_FACT"]).optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

router.get(
  "/memories",
  validate(ListMemoriesSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query    = req.query as unknown as z.infer<typeof ListMemoriesSchema>;

    try {
      ok(res, await listMemories(authReq.userId, query));
    } catch (err) {
      console.error("[copilot GET /memories]", err);
      internalError(res);
    }
  }
);

// ── DELETE /copilot/memories/:id ─ Forget one memory (owner only) ──────────

router.delete(
  "/memories/:id",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      await deleteMemory(req.params.id, authReq.userId);
      ok(res, { deleted: true });
    } catch (err: unknown) {
      if (err instanceof MemoryNotFoundError) {
        notFound(res, "Memory not found");
        return;
      }
      console.error("[copilot DELETE /memories/:id]", err);
      internalError(res);
    }
  }
);

// ── PATCH /copilot/memories/:id ─ Edit own memory's content (Phase 11) ─────

const UpdateMemorySchema = z.object({
  content: z.string().min(1).max(2000),
});

router.patch(
  "/memories/:id",
  validate(UpdateMemorySchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof UpdateMemorySchema>;

    try {
      const result = await updateMemory(req.params.id, authReq.userId, body.content);
      if ("rejected" in result) {
        badRequest(res, result.reason);
        return;
      }
      ok(res, result);
    } catch (err: unknown) {
      if (err instanceof MemoryNotFoundError) {
        notFound(res, "Memory not found");
        return;
      }
      console.error("[copilot PATCH /memories/:id]", err);
      internalError(res);
    }
  }
);

// ── POST /copilot/analyze-journal ───────────────────────────────────────────

router.post(
  "/analyze-journal",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    if (!checkRateLimit(authReq.userId)) {
      res.status(429).json({ success: false, error: "Copilot rate limit reached. Max 20 requests per hour.", code: "RATE_LIMIT" });
      return;
    }

    try {
      ok(res, await analyzeJournal(authReq.userId));
    } catch (err: unknown) {
      handleCopilotError(err, res, "POST /analyze-journal");
    }
  }
);

// ── POST /copilot/interpret-analytics ───────────────────────────────────────

router.post(
  "/interpret-analytics",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    if (!checkRateLimit(authReq.userId)) {
      res.status(429).json({ success: false, error: "Copilot rate limit reached. Max 20 requests per hour.", code: "RATE_LIMIT" });
      return;
    }

    try {
      ok(res, await interpretAnalytics(authReq.userId));
    } catch (err: unknown) {
      handleCopilotError(err, res, "POST /interpret-analytics");
    }
  }
);

// ── GET /copilot/context ─ Debug: view the context the AI sees ─────────────

router.get(
  "/context",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, { context: await buildUserContext(authReq.userId) });
    } catch (err) {
      console.error("[copilot GET /context]", err);
      internalError(res);
    }
  }
);

// ── GET /copilot/metrics ─ Aggregate operational counters (final closure pass)

router.get(
  "/metrics",
  async (_req, res) => {
    try {
      // getProviderMetricsSnapshot() only ever aggregates counts/rates/
      // durations (see copilotObservability.ts's module doc comment) — never
      // prompts, message content, tool arguments, model output, or secrets.
      // Process-wide, not per-user: any authenticated Copilot user can see
      // overall system health, same as a lightweight status page would.
      ok(res, getProviderMetricsSnapshot());
    } catch (err) {
      console.error("[copilot GET /metrics]", err);
      internalError(res);
    }
  }
);

export default router;
