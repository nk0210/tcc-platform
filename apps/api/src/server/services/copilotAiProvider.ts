/**
 * Copilot AI Provider
 *
 * Thin, provider-agnostic abstraction over whatever LLM backs TCC Copilot.
 * Everything above this file (agent loop, chat, analyze-journal,
 * interpret-analytics) talks only to `AIProvider` / `getAIProvider()` — none
 * of it imports `groq-sdk` directly. Swapping providers later means writing
 * one new class here, not touching the agent or any route.
 *
 * Uses the existing groq-sdk@1.6.0 dependency — no new AI SDK added. Groq's
 * chat-completions API is OpenAI-compatible, including `tools`/`tool_choice`
 * function calling, which is what the agent loop (copilotAgentService.ts)
 * needs.
 *
 * Phase 5: `getAIProvider()` now returns a `ReliableAIProvider` wrapping the
 * concrete `GroqAIProvider` — bounded retry/backoff/jitter for transient
 * failures, a hard overall time budget, and structured observability, all
 * living above the concrete provider so a second provider later gets this
 * for free instead of reimplementing it. See ReliableAIProvider below.
 */
import Groq, {
  APIError,
  RateLimitError,
  InternalServerError,
  APIConnectionError,
} from "groq-sdk";
import { randomUUID } from "crypto";
import { getEnv } from "../../config/env";
import { withTimeout, sleep, TimeoutError } from "./copilotUtil";
import { recordProviderCall } from "./copilotObservability";

// llama-3.1-8b-instant was retired from Groq's catalog; gpt-oss-20b is its
// current fastest small-model equivalent and supports tool calling. It's a
// reasoning model, so reasoning_effort is pinned to "low" to keep
// latency/response length predictable instead of burning the token budget
// on internal reasoning before it ever emits `content` or a tool call.
const MODEL = "openai/gpt-oss-20b";

export class AIProviderNotConfiguredError extends Error {
  constructor() { super("AI_PROVIDER_NOT_CONFIGURED"); }
}

// ── Provider-agnostic message/tool shapes ───────────────────────────────────
// Deliberately not the Groq/OpenAI SDK's own types — those leak provider
// details (e.g. `tool_call_id` naming) into every caller. This is the one
// place that translates between TCC's shape and whatever the active
// provider expects.

export type AIRole = "system" | "user" | "assistant" | "tool";

export interface AIToolCall {
  id:        string;
  name:      string;
  /** Raw JSON string exactly as the model produced it — unvalidated. The
   *  caller (agent loop) is responsible for parsing and validating this
   *  before it ever reaches a tool's execute(). */
  arguments: string;
}

export interface AIMessage {
  role:      AIRole;
  /** Required for every role except an assistant message that is ONLY a
   *  tool call with no accompanying text. */
  content:   string | null;
  /** Present only on assistant messages that requested tool calls. */
  toolCalls?: AIToolCall[];
  /** Present only on role "tool" — which tool call this result answers. */
  toolCallId?: string;
}

export interface AIToolSpec {
  name:        string;
  description: string;
  /** JSON Schema describing the tool's parameters, shown to the model. */
  parameters:  Record<string, unknown>;
}

export interface AICompletionRequest {
  systemPrompt: string;
  messages:     AIMessage[];
  tools?:       AIToolSpec[];
  /** Correlation ids for observability only — never sent to the provider,
   *  never used for authorization (the tool layer re-verifies ownership
   *  independently regardless of what's logged here). Optional so every
   *  existing call site and test fixture keeps compiling unchanged. */
  metadata?: {
    conversationId?: string;
    userId?:         string;
  };
}

export interface AICompletionResult {
  content:    string | null;
  toolCalls:  AIToolCall[];
  tokensUsed: number;
  model:      string;
  /** Additional cost visibility beyond the total — undefined for a
   *  provider (or test fixture) that doesn't report the split. */
  promptTokens?:     number;
  completionTokens?: number;
  /** How many retries ReliableAIProvider needed beyond the first attempt
   *  to produce this result. Optional so every existing raw test fixture
   *  (constructed without this field) keeps compiling unchanged; treat
   *  undefined as 0. Only ReliableAIProvider ever sets it explicitly. */
  retries?: number;
}

export interface AIProvider {
  complete(request: AICompletionRequest): Promise<AICompletionResult>;
}

// ── Groq implementation ──────────────────────────────────────────────────

function toGroqMessage(m: AIMessage): Groq.Chat.Completions.ChatCompletionMessageParam {
  if (m.role === "tool") {
    return {
      role:         "tool",
      tool_call_id: m.toolCallId ?? "",
      content:      m.content ?? "",
    };
  }
  if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role:    "assistant",
      content: m.content,
      tool_calls: m.toolCalls.map((tc) => ({
        id:   tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
  }
  return { role: m.role as "system" | "user" | "assistant", content: m.content ?? "" };
}

function toGroqTool(spec: AIToolSpec): Groq.Chat.Completions.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name:        spec.name,
      description: spec.description,
      parameters:  spec.parameters,
    },
  };
}

class GroqAIProvider implements AIProvider {
  private client(): Groq {
    const apiKey = getEnv().GROQ_API_KEY;
    if (!apiKey) throw new AIProviderNotConfiguredError();
    return new Groq({ apiKey });
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const groq = this.client();

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: request.systemPrompt },
      ...request.messages.map(toGroqMessage),
    ];

    const tools = request.tools && request.tools.length > 0
      ? request.tools.map(toGroqTool)
      : undefined;

    const response = await groq.chat.completions.create({
      model:            MODEL,
      messages,
      max_tokens:       800,
      temperature:      0.7,
      reasoning_effort: "low",
      ...(tools ? { tools, tool_choice: "auto" as const } : {}),
    });

    const message = response.choices[0]?.message;

    return {
      content: message?.content ?? null,
      toolCalls: (message?.tool_calls ?? [])
        .filter((tc): tc is Groq.Chat.Completions.ChatCompletionMessageToolCall & { function: { name: string; arguments: string } } => tc.type === "function")
        .map((tc) => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments })),
      tokensUsed:        response.usage?.total_tokens ?? 0,
      promptTokens:      response.usage?.prompt_tokens,
      completionTokens:  response.usage?.completion_tokens,
      model:             MODEL,
    };
  }
}

// ── Failure classification ────────────────────────────────────────────────
// What gets retried and what doesn't. Deliberately conservative: anything
// we don't recognize is treated as NON-retryable — retrying is the
// exception that has to be justified (transient infra), not the default.

export type ProviderErrorCategory =
  | "not_configured"   // AIProviderNotConfiguredError — no API key at all
  | "auth"              // 401/403 — invalid key or forbidden
  | "bad_request"       // 400/404/409/422 — malformed request, bad model, unsupported tool schema, etc.
  | "rate_limit"        // 429
  | "server_error"      // 5xx
  | "connection_error"  // network-level failure (DNS, reset, etc.)
  | "timeout"           // our own withTimeout firing on one attempt
  | "unknown";          // anything not recognized above — never retried

export function classifyProviderError(err: unknown): { category: ProviderErrorCategory; retryable: boolean } {
  if (err instanceof AIProviderNotConfiguredError) return { category: "not_configured", retryable: false };
  if (err instanceof TimeoutError)                 return { category: "timeout", retryable: true };

  if (err instanceof RateLimitError)      return { category: "rate_limit", retryable: true };
  if (err instanceof InternalServerError) return { category: "server_error", retryable: true };
  if (err instanceof APIConnectionError)  return { category: "connection_error", retryable: true }; // covers APIConnectionTimeoutError too

  if (err instanceof APIError) {
    // 400/401/403/404/409/422 — the request itself is the problem (bad
    // model, malformed tool schema, invalid/expired key, etc.). Retrying
    // an identical request would just fail identically.
    return { category: err.status === 401 || err.status === 403 ? "auth" : "bad_request", retryable: false };
  }

  return { category: "unknown", retryable: false };
}

/** Best-effort: honors a standard `Retry-After` header (seconds, or an
 *  HTTP-date) if the provider sends one, since that's a more accurate wait
 *  than our own guess. Still always clamped by the caller against our own
 *  max backoff and remaining time budget — never trusted unbounded (a
 *  provider could in principle ask for an absurd delay). Returns undefined
 *  if absent or unparseable, letting the caller fall back to computed
 *  exponential backoff. */
function extractRetryAfterMs(err: unknown): number | undefined {
  if (!(err instanceof APIError) || !err.headers) return undefined;
  const header = err.headers.get?.("retry-after");
  if (!header) return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;

  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());

  return undefined;
}

// ── Reliable provider (retry / backoff / timeout / observability) ─────────

/** AWS-style "full jitter": a random value in [0, cap] — spreads retries
 *  from many concurrent requests apart instead of having them all retry in
 *  lockstep (thundering herd), while still respecting the exponential cap. */
function computeBackoffMs(attempt: number, initialMs: number, maxMs: number): number {
  const exponential = initialMs * 2 ** attempt;
  const cap = Math.min(exponential, maxMs);
  return Math.random() * cap;
}

/** Wraps any AIProvider with bounded retry/backoff for transient failures,
 *  a hard overall time budget, and structured observability. Sits above
 *  the concrete provider (per the module doc) so a second provider
 *  implementation later gets all of this for free — it never needs its own
 *  retry logic.
 *
 *  Retries live ENTIRELY inside this one complete() call — the agent loop
 *  (copilotAgentService.ts) calls complete() exactly once per iteration and
 *  only acts on tool calls after it resolves. That is what makes a provider
 *  retry structurally unable to execute a tool twice: retries can only
 *  happen before the model's tool-call decision is known, never after. */
export class ReliableAIProvider implements AIProvider {
  constructor(private readonly inner: AIProvider) {}

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const env = getEnv();
    const maxRetries    = Number(env.COPILOT_PROVIDER_MAX_RETRIES);
    const attemptMs      = Number(env.COPILOT_PROVIDER_TIMEOUT_MS);
    const initialBackoff = Number(env.COPILOT_PROVIDER_INITIAL_BACKOFF_MS);
    const maxBackoff      = Number(env.COPILOT_PROVIDER_MAX_BACKOFF_MS);
    const maxTotalMs      = Number(env.COPILOT_PROVIDER_MAX_TOTAL_MS);

    const requestId = randomUUID();
    const deadline   = Date.now() + maxTotalMs;

    let lastErr: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break; // overall budget exhausted before this attempt could even start

      const start = Date.now();
      try {
        // Never let a single attempt run longer than what's left of the
        // overall budget, even if that's shorter than the configured
        // per-attempt timeout — this is what makes MAX_TOTAL_MS a real
        // hard ceiling rather than just another number to add up.
        const result = await withTimeout(this.inner.complete(request), Math.min(attemptMs, remaining), "AI provider");

        recordProviderCall({
          requestId, conversationId: request.metadata?.conversationId, userId: request.metadata?.userId,
          provider: "groq", model: result.model, attempt, durationMs: Date.now() - start, status: "success",
          promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.tokensUsed,
        });

        return { ...result, retries: attempt };
      } catch (err) {
        lastErr = err;
        const { category, retryable } = classifyProviderError(err);

        recordProviderCall({
          requestId, conversationId: request.metadata?.conversationId, userId: request.metadata?.userId,
          provider: "groq", model: null, attempt, durationMs: Date.now() - start, status: "failure", errorCategory: category,
        });

        if (!retryable || attempt === maxRetries) break;

        const now = Date.now();
        if (now >= deadline) break;

        const retryAfterMs = extractRetryAfterMs(err);
        const backoff = retryAfterMs ?? computeBackoffMs(attempt, initialBackoff, maxBackoff);
        const delay = Math.max(0, Math.min(backoff, maxBackoff, deadline - now));
        if (delay > 0) await sleep(delay);
      }
    }

    throw lastErr;
  }
}

// ── Singleton accessor ───────────────────────────────────────────────────
// Same pattern as apps/api/src/lib/prisma.ts's singleton.

let providerInstance: AIProvider | null = null;
let testOverride:     AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (testOverride) return testOverride;
  if (!providerInstance) providerInstance = new ReliableAIProvider(new GroqAIProvider());
  return providerInstance;
}

/** Test-only: inject a fake AIProvider so the agent loop can be tested
 *  deterministically, without real network calls, an API key, or
 *  non-deterministic model output. Returned as-is — deliberately NOT
 *  wrapped in ReliableAIProvider, so every existing test's "exactly one
 *  call per scripted response" expectation keeps holding; tests that want
 *  to exercise retry behavior wrap their own fake in `new
 *  ReliableAIProvider(fakeInner)` explicitly (see
 *  copilotAiProvider.test.ts). Pass null to restore the real provider. */
export function __setAIProviderForTests(provider: AIProvider | null): void {
  testOverride = provider;
}
