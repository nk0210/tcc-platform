/**
 * Copilot Observability
 *
 * Not a metrics platform — just enough structure that provider reliability
 * (success rate, 429 rate, timeout rate, latency, retry rate, tokens/tool
 * calls per request) is measurable now and easy to wire into a real metrics
 * system later without touching call sites again. Two things live here:
 *
 *   - a structured console.log per provider attempt and per agent turn
 *     (never raw prompts, messages, or model output — only counts, ids,
 *     durations, and error categories);
 *   - a small in-memory counters snapshot (reset on process restart, not
 *     persisted) that a future health/metrics endpoint could read.
 *
 * Deliberately excluded from every log line: API keys, tokens/secrets,
 * trade/journal content, prompts, and model output text.
 */

export interface ProviderCallLogEntry {
  requestId:       string;
  conversationId?: string;
  userId?:         string;
  provider:        string;
  model:           string | null;
  /** 0-indexed: 0 is the first attempt, 1+ are retries. */
  attempt:         number;
  durationMs:      number;
  status:          "success" | "failure";
  /** Only present on failure — see copilotAiProvider.ts's classifyProviderError(). */
  errorCategory?:  string;
  promptTokens?:   number;
  completionTokens?: number;
  totalTokens?:    number;
}

export interface AgentTurnLogEntry {
  requestId:       string;
  conversationId:  string;
  userId:          string;
  steps:           number;
  toolCalls:       number;
  providerCalls:   number;
  providerRetries: number;
  tokensUsed:      number;
  durationMs:      number;
  outcome:         "completed" | "pending_confirmation" | "step_limit_exhausted" | "provider_unavailable";
  /** Phase 9: which tools were actually called this turn (deduplicated
   *  names only — never arguments, results, or reasoning), so cross-tool
   *  usage is visible without logging any content. */
  toolNames?: string[];
}

interface Counters {
  providerCalls:       number;
  providerSuccesses:   number;
  providerFailures:    number;
  providerRetries:     number;
  rateLimitFailures:   number;
  timeoutFailures:     number;
  totalLatencyMs:      number;
  totalTokens:         number;
  agentTurns:          number;
  agentTurnToolCalls:  number;
  // ── Confirmation-flow counters (production-hardening pass) ─────────────
  // Every pending MEDIUM/HIGH-risk action ends in exactly one of these four
  // terminal states (see copilotActionService.ts's finishAction() and
  // diagnoseClaimFailure()) — together they're the denominator for
  // confirmation/cancellation/expiry rate, without logging any tool
  // argument or result content.
  actionsExecuted:     number;
  actionsFailed:       number;
  actionsCancelled:    number;
  actionsExpired:      number;
  /** How many confirm/cancel calls resumed an interrupted multi-step turn
   *  (continuationState was present) — see copilotActionService.ts's
   *  finishAction(). Counted once per resume attempt, regardless of
   *  whether the resumed turn itself succeeded, proposed a further
   *  pending action, or degraded on a provider failure. */
  continuationsResumed: number;
}

function freshCounters(): Counters {
  return {
    providerCalls: 0, providerSuccesses: 0, providerFailures: 0, providerRetries: 0,
    rateLimitFailures: 0, timeoutFailures: 0, totalLatencyMs: 0, totalTokens: 0,
    agentTurns: 0, agentTurnToolCalls: 0,
    actionsExecuted: 0, actionsFailed: 0, actionsCancelled: 0, actionsExpired: 0,
    continuationsResumed: 0,
  };
}

let counters = freshCounters();

export function recordProviderCall(entry: ProviderCallLogEntry): void {
  counters.providerCalls += 1;
  counters.totalLatencyMs += entry.durationMs;
  if (entry.status === "success") {
    counters.providerSuccesses += 1;
  } else {
    counters.providerFailures += 1;
    if (entry.errorCategory === "rate_limit") counters.rateLimitFailures += 1;
    if (entry.errorCategory === "timeout")    counters.timeoutFailures += 1;
  }
  if (entry.attempt > 0) counters.providerRetries += 1;
  if (entry.totalTokens) counters.totalTokens += entry.totalTokens;

  // eslint-disable-next-line no-console
  console.log("[copilot:provider]", JSON.stringify(entry));
}

export function recordAgentTurn(entry: AgentTurnLogEntry): void {
  counters.agentTurns += 1;
  counters.agentTurnToolCalls += entry.toolCalls;

  // eslint-disable-next-line no-console
  console.log("[copilot:turn]", JSON.stringify(entry));
}

/** Phase 6: lightweight conversation lifecycle events — ids and an event
 *  name only, never message content. */
export function recordConversationEvent(
  event: "conversation_created" | "conversation_opened" | "conversation_continued" | "conversation_deleted",
  fields: { conversationId: string; userId: string }
): void {
  // eslint-disable-next-line no-console
  console.log("[copilot:conversation]", JSON.stringify({ event, ...fields, at: new Date().toISOString() }));
}

/** Phase 7: memory lifecycle events — ids, event name, and small non-content
 *  metadata only. `content` is deliberately never a field on this type —
 *  nothing calling this can accidentally log what was actually remembered. */
export function recordMemoryEvent(
  event: "memory_created" | "memory_updated" | "memory_deleted" | "memory_retrieved" | "memory_rejected",
  fields: {
    userId:   string;
    memoryId?: string;
    type?:     string;
    count?:    number;
    reason?:   string;
    deduped?:  boolean;
  }
): void {
  // eslint-disable-next-line no-console
  console.log("[copilot:memory]", JSON.stringify({ event, ...fields, at: new Date().toISOString() }));
}

/** Phase 8: one structured event per turn, from the Context Orchestrator
 *  (copilotContextOrchestrator.ts) — counts and sizes only, never the
 *  actual conversation, memory, or entity content. `contextChars` is a
 *  plain character count of the assembled variable context (history +
 *  memory + app-context line), not a token estimate — see the module doc
 *  comment on copilotContextOrchestrator.ts for why a token estimator
 *  wasn't built. */
export function recordContextAssembly(entry: {
  requestId:            string;
  conversationId:       string;
  userId:               string;
  memoryCandidates:     number;
  memoriesSelected:     number;
  conversationMessages: number;
  contextChars:         number;
  truncatedHistory:     boolean;
  selectedEntityType:   string | null;
  module:               string | null;
  // Phase 10 — hybrid retrieval. Counts/timings/flags only, answering "why
  // was this memory retrieved" without ever logging the memory itself.
  semanticRetrievalUsed?:   boolean;
  embeddingLatencyMs?:      number;
  semanticCandidates?:      number;
  deterministicCandidates?: number;
  retrievalThreshold?:      number;
  retrievalFallback?:       boolean;
  historicalMatches?:       number;
}): void {
  // eslint-disable-next-line no-console
  console.log("[copilot:context]", JSON.stringify(entry));
}

/** Phase 11 (production-hardening pass): one event per pending action's
 *  terminal state — id, tool name, and outcome only, never tool arguments
 *  or results. See copilotActionService.ts's finishAction() (EXECUTED/
 *  FAILED/CANCELLED) and diagnoseClaimFailure() (EXPIRED) for the only two
 *  call sites. */
export function recordActionOutcome(
  status: "EXECUTED" | "FAILED" | "CANCELLED" | "EXPIRED",
  fields: { actionId: string; userId: string; toolName: string }
): void {
  if (status === "EXECUTED")  counters.actionsExecuted  += 1;
  if (status === "FAILED")    counters.actionsFailed    += 1;
  if (status === "CANCELLED") counters.actionsCancelled += 1;
  if (status === "EXPIRED")   counters.actionsExpired   += 1;

  // eslint-disable-next-line no-console
  console.log("[copilot:action]", JSON.stringify({ status, ...fields, at: new Date().toISOString() }));
}

/** Phase 11: one event per resumed multi-step continuation — see
 *  copilotActionService.ts's finishAction(). */
export function recordContinuationResumed(fields: { conversationId: string; userId: string }): void {
  counters.continuationsResumed += 1;

  // eslint-disable-next-line no-console
  console.log("[copilot:continuation]", JSON.stringify({ ...fields, at: new Date().toISOString() }));
}

/** Snapshot of process-lifetime counters — not persisted, resets on
 *  restart. A future `/copilot/metrics` (owner-only) endpoint or external
 *  scraper can read this; nothing here needs to change to add one. */
export function getProviderMetricsSnapshot() {
  const successRate = counters.providerCalls > 0 ? counters.providerSuccesses / counters.providerCalls : null;
  const avgLatencyMs = counters.providerCalls > 0 ? counters.totalLatencyMs / counters.providerCalls : null;

  // Denominator: every pending action that reached a terminal state —
  // see the Counters interface doc comment on why these four are exhaustive.
  const actionsTerminal = counters.actionsExecuted + counters.actionsFailed + counters.actionsCancelled + counters.actionsExpired;
  const confirmationRate = actionsTerminal > 0 ? counters.actionsExecuted  / actionsTerminal : null;
  const cancellationRate = actionsTerminal > 0 ? counters.actionsCancelled / actionsTerminal : null;
  const expiredRate      = actionsTerminal > 0 ? counters.actionsExpired   / actionsTerminal : null;

  return {
    providerCalls:      counters.providerCalls,
    providerSuccesses:  counters.providerSuccesses,
    providerFailures:   counters.providerFailures,
    providerRetries:    counters.providerRetries,
    rateLimitFailures:  counters.rateLimitFailures,
    timeoutFailures:    counters.timeoutFailures,
    successRate,
    avgLatencyMs,
    totalTokens:        counters.totalTokens,
    agentTurns:         counters.agentTurns,
    agentTurnToolCalls: counters.agentTurnToolCalls,
    actionsExecuted:     counters.actionsExecuted,
    actionsFailed:       counters.actionsFailed,
    actionsCancelled:    counters.actionsCancelled,
    actionsExpired:      counters.actionsExpired,
    confirmationRate,
    cancellationRate,
    expiredRate,
    continuationsResumed: counters.continuationsResumed,
  };
}

/** Test-only: process-lifetime counters otherwise never reset, which would
 *  make counter assertions order-dependent across test files. */
export function __resetProviderMetricsForTests(): void {
  counters = freshCounters();
}
