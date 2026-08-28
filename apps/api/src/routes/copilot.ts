/**
 * Copilot Routes
 * Mounted at: /copilot
 */
import { Router } from "express";
import { z } from "zod";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { ok, internalError } from "../lib/response";
import { chat, analyzeJournal, interpretAnalytics } from "../server/services/copilotService";
import { buildUserContext } from "../server/services/copilotContextService";

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

// ── Rate limiting (in-memory — Phase Beta should move this to Redis) ───────

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

// ── Schemas ────────────────────────────────────────────────────────────────

const ChatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role:    z.enum(["user", "assistant"]),
    content: z.string().max(2000),
  })).max(20).default([]),
});

// ── POST /copilot/chat ─────────────────────────────────────────────────────

router.post(
  "/chat",
  validate(ChatSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof ChatSchema>;

    if (!checkRateLimit(authReq.userId)) {
      res.status(429).json({ success: false, error: "Copilot rate limit reached. Max 20 requests per hour.", code: "RATE_LIMIT" });
      return;
    }

    try {
      const result = await chat(authReq.userId, [{ role: "user", content: body.message }], body.history);
      ok(res, result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "GROQ_API_KEY not configured") {
        res.status(503).json({ success: false, error: "AI service not configured. Add GROQ_API_KEY to apps/api/.env", code: "AI_NOT_CONFIGURED" });
        return;
      }
      console.error("[copilot POST /chat]", err);
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
      if (err instanceof Error && err.message === "GROQ_API_KEY not configured") {
        res.status(503).json({ success: false, error: "AI service not configured. Add GROQ_API_KEY to apps/api/.env", code: "AI_NOT_CONFIGURED" });
        return;
      }
      console.error("[copilot POST /analyze-journal]", err);
      internalError(res);
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
      if (err instanceof Error && err.message === "GROQ_API_KEY not configured") {
        res.status(503).json({ success: false, error: "AI service not configured. Add GROQ_API_KEY to apps/api/.env", code: "AI_NOT_CONFIGURED" });
        return;
      }
      console.error("[copilot POST /interpret-analytics]", err);
      internalError(res);
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

export default router;
