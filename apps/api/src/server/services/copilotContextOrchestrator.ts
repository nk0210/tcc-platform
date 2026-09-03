/**
 * Copilot Context Orchestrator — Phase 8 (extended Phase 9, Phase 10)
 *
 * Phases 6/7 already assembled per-turn context in copilotService.
 * runAndPersistTurn() as three independent pieces built in parallel:
 * conversation history (a local loadHistory()), verified page/entity
 * context (a local buildContextLine()), and memory (copilotMemoryService.
 * buildMemoryContext()). This file makes that assembly one explicit,
 * testable step — a "Context Orchestrator" — and adds what the Phase 8
 * audit found genuinely missing: module-aware relevance, a second verified
 * entity type (journal, alongside Phase 4's trade), a conversation/memory
 * deduplication pass, an explicit bounded context-size budget, and one
 * structured observability event per turn. Phase 9 added two more verified
 * entity types (community_post, copy_relationship). Phase 10 adds
 * SEMANTIC retrieval alongside the existing deterministic mechanisms —
 * memory retrieval becomes hybrid (see copilotMemoryService.
 * selectRelevantMemories(), unchanged call site here) and a new, small,
 * clearly-bounded "relevant past conversation" section supplements (never
 * replaces) the recent-history load. This file still only ever ASSEMBLES
 * what copilotSemanticRetrieval.ts and copilotMemoryService.ts compute —
 * it has no embedding logic, no ranking logic, and no ownership logic of
 * its own for the semantic pieces, same "assemble, don't reimplement"
 * relationship it already has with memory/entity verification.
 *
 * What this file explicitly does NOT do:
 *   - run the agent loop or call any tool. copilotAgentService.ts /
 *     copilotToolRegistry.ts still own that entirely — this only decides
 *     what's already IN context before the model's first turn, never what
 *     the model must actively retrieve (see "Tool selection vs. context
 *     selection" in the Phase 8 spec). It calls no tool and executes no
 *     write of any kind.
 *   - talk to the AI provider.
 *   - change any risk level, confirmation requirement, or ownership check —
 *     it only ever narrows what's shown to the model, never what the model
 *     (or a confirmed tool call) is authorized to do.
 *   - build the fixed trader-stats block (copilotContextService.
 *     buildUserContext) — that's a small, already-bounded, always-relevant
 *     summary unrelated to per-request relevance decisions, so it's
 *     untouched and stays a separate call in copilotService.ts.
 *   - summarize anything. Bounding conversation history here means
 *     dropping the oldest messages, never compressing them — the Phase 8
 *     spec explicitly defers summarization until a demonstrated need.
 */
import { randomUUID } from "crypto";
import { getEnv } from "../../config/env";
import { copilotRepository } from "../repositories/copilotRepository";
import { tradeService } from "./tradeService";
import { journalRepository } from "../repositories/journalRepository";
import { communityPostService } from "./communityPostService";
import { copyTradingService } from "./copyTradingService";
import { selectRelevantMemories, formatMemoryContextBlock } from "./copilotMemoryService";
import {
  embedQuery,
  semanticSearchConversationHistory,
  formatHistoricalContextBlock,
} from "./copilotSemanticRetrieval";
import { recordContextAssembly } from "./copilotObservability";
import type { AIMessage, AIRole } from "./copilotAiProvider";

// ── Module identifiers ───────────────────────────────────────────────────
// The Copilot exists primarily in the trading interface today — TRADING is
// the only module with real backend tools (the entire Phase 1-7 tool
// registry). The others are recognized so the orchestrator can correctly
// LABEL where a request came from, never so it can pretend that module has
// capabilities it doesn't (Phase 8 spec, "Module-Aware Context").

export const COPILOT_MODULES = ["TRADING", "ACADEMY", "COMMUNITY", "PROFILE", "COPY_TRADING"] as const;
export type CopilotModule = (typeof COPILOT_MODULES)[number];

/** Case/spacing-insensitive; anything unrecognized normalizes to null
 *  rather than being guessed at — an unsupported module is identified as
 *  "not one we know", never silently mapped onto TRADING or invented. */
export function normalizeModule(raw?: string | null): CopilotModule | null {
  if (!raw) return null;
  const canonical = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (COPILOT_MODULES as readonly string[]).includes(canonical) ? (canonical as CopilotModule) : null;
}

// ── Selected entity verification ─────────────────────────────────────────
// Phase 4 introduced "trade"; Phase 8 added "journal"
// (journalRepository.findById(id, userId), already used by journalTools.ts).
// Phase 9 re-audited every entity type the spec suggested (watchlist item,
// academy lesson, community post, competition, copy-trading relationship)
// against what already has a clean, ownership-scoped, single-record lookup:
//   - "community_post": communityPostService.getPost(id, userId), then
//     verifying post.authorId === userId — the post is the user's OWN, same
//     "this is yours" semantics as trade/journal (viewing someone else's
//     public post is still fine, it just isn't a *verified-owned* pointer).
//   - "copy_relationship": copyTradingService.getOwnedRelationship(id,
//     userId) — added in Phase 9 as a thin public wrapper around the exact
//     ownership check every copy-trading mutation already used internally.
// Still unsupported, deliberately: "watchlist item" (no single-record
// lookup exists — items are keyed by (userId, symbol), not a fetchable id),
// "academy lesson" (a lesson belongs to a course, not to a user — "owned"
// would mean "enrolled in its course", one hop removed from a clean check),
// and "competition" (no real backend at all — see
// COPILOT_CAPABILITY_MAP.md). Adding any of these would mean inventing new
// service logic well beyond "extend carefully" and "never trust a
// client-supplied entity blindly", so they stay unsupported rather than
// guessed at.

export type VerifiedEntityType = "trade" | "journal" | "community_post" | "copy_relationship";

export interface VerifiedEntityPointer {
  type:  VerifiedEntityType;
  id:    string;
  /** Short, non-sensitive pointer text for the prompt — an id and a
   *  couple of identifying fields, never the entity's full data. The model
   *  still has to call the matching tool (get_trade / get_journal_entry)
   *  to retrieve details — this only tells it what the user is probably
   *  asking about (same data-minimization contract Phase 4 established). */
  label: string;
}

export interface CopilotUiContextInput {
  currentModule?:  string;
  currentPage?:    string;
  selectedEntity?: { type: string; id: string };
}

/** client entity id → authenticated userId → service ownership lookup →
 *  verified entity → context pointer. Never trusts the client's claimed
 *  type/id: an unrecognized type or an entity that doesn't resolve under
 *  THIS userId is silently dropped, never mentioned to the model. */
async function verifySelectedEntity(
  userId: string,
  entity?: { type: string; id: string }
): Promise<VerifiedEntityPointer | null> {
  if (!entity) return null;

  if (entity.type === "trade") {
    const owned = await tradeService.getTradeById(entity.id, userId).catch(() => null);
    return owned ? { type: "trade", id: owned.id, label: `trade ${owned.id} (${owned.symbol} ${owned.side})` } : null;
  }

  if (entity.type === "journal") {
    const owned = await journalRepository.findById(entity.id, userId).catch(() => null);
    return owned ? { type: "journal", id: owned.id, label: `journal entry ${owned.id} (${owned.symbol} ${owned.side})` } : null;
  }

  if (entity.type === "community_post") {
    const post = await communityPostService.getPost(entity.id, userId).catch(() => null) as { id: string; authorId: string; type: string } | null;
    // getPost() verifies the post is *visible* to userId (public, or the
    // viewer follows a followers-only author) — that's not the same thing
    // as *owned*. A selected-entity pointer means "this is the user's own
    // content", so authorId must additionally match, exactly like trade/
    // journal ownership above.
    if (!post || post.authorId !== userId) return null;
    return { type: "community_post", id: post.id, label: `community post ${post.id} (${post.type})` };
  }

  if (entity.type === "copy_relationship") {
    const owned = await copyTradingService.getOwnedRelationship(entity.id, userId);
    return owned ? { type: "copy_relationship", id: owned.id, label: `copy relationship ${owned.id} (${owned.masterDisplayName}, ${owned.status})` } : null;
  }

  return null;
}

function buildAppContextLine(
  rawModule: string | undefined,
  rawPage:   string | undefined,
  entity:    VerifiedEntityPointer | null
): string | null {
  const parts: string[] = [];
  if (rawModule || rawPage) {
    parts.push(`currently viewing ${[rawModule, rawPage].filter(Boolean).join(" / ")}`);
  }
  if (entity) parts.push(`currently looking at ${entity.label}`);
  return parts.length > 0 ? `UI CONTEXT: The user is ${parts.join("; ")}.` : null;
}

// ── Conversation history ─────────────────────────────────────────────────

/** Unchanged from the Phase 6/7 hardcoded value — now a named, exported
 *  constant instead of a magic number, per the Phase 8 spec's "Context
 *  Size Budget" section. */
export const MAX_CONVERSATION_HISTORY_MESSAGES = 10;

/** A conservative character budget for the *variable* per-request context
 *  this orchestrator assembles (history + memory + the app-context line) —
 *  NOT the full system prompt (the fixed trader-stats block and tool
 *  schemas are small and already bounded, untouched by Phase 8). Groq's
 *  openai/gpt-oss-20b (see copilotAiProvider.ts) has a context window far
 *  larger than this — this exists for bounded/predictable/observable
 *  behavior regardless of how much headroom the provider currently has,
 *  per the Phase 8 spec, not because of any observed overflow. A plain
 *  character count, not a token estimate: the provider already reports
 *  real token usage per call (see copilotObservability.recordProviderCall),
 *  so building a separate estimator here would be redundant machinery for
 *  a number the system already has more accurately elsewhere. */
export const MAX_CONTEXT_CHARS = 24_000;

function historyCharLength(messages: AIMessage[]): number {
  return messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
}

/** Drops the OLDEST messages first — never the most recent, which are the
 *  most likely to matter — until what's left fits the budget. Deterministic
 *  truncation, not summarization; the Phase 8 spec explicitly defers
 *  summarization until a demonstrated need, and in practice this almost
 *  never fires (see MAX_CONTEXT_CHARS's doc comment). */
function trimHistoryToBudget(history: AIMessage[], budgetChars: number): { history: AIMessage[]; truncated: boolean } {
  let trimmed = history;
  let truncated = false;
  while (trimmed.length > 1 && historyCharLength(trimmed) > budgetChars) {
    trimmed = trimmed.slice(1);
    truncated = true;
  }
  return { history: trimmed, truncated };
}

async function loadHistory(conversationId: string, limit: number): Promise<AIMessage[]> {
  const recent = await copilotRepository.getRecentMessages(conversationId, limit);
  return recent.reverse().map((m) => ({ role: m.role.toLowerCase() as AIRole, content: m.content }));
}

// ── Assembly ──────────────────────────────────────────────────────────────

export interface CopilotContextBundle {
  /** Bounded, oldest-first prior turns — exactly what's passed to
   *  runAgent() as `history`. */
  history:        AIMessage[];
  /** The formatted "USER MEMORY / CONTEXT" block, or null. */
  memoryContext:  string | null;
  /** Phase 10: the formatted "RELEVANT PAST CONVERSATION" block (matches
   *  from OTHER, older conversations), or null. Always separate from
   *  `history` — never merged into the recent-turns list. */
  historicalContext: string | null;
  /** The formatted "UI CONTEXT: ..." line (module/page/entity), or null. */
  appContextLine: string | null;
  module:         CopilotModule | null;
  selectedEntity: VerifiedEntityPointer | null;
}

/** The Context Orchestrator: assembles conversation, memory, and verified
 *  application context into one bounded bundle for a single turn. Called
 *  once per turn from copilotService.runAndPersistTurn() — this replaces
 *  what used to be three separately-invoked pieces with one explicit,
 *  independently-testable step. Every category it returns is already
 *  bounded (history to `historyLimit` messages and `maxContextChars`;
 *  memory to copilotMemoryService's MAX_MEMORIES_INJECTED); nothing here
 *  ever fetches "everything". */
export async function assembleContext(params: {
  userId:           string;
  conversationId:   string;
  /** What the model will see as this turn's user message — the same text
   *  memory relevance and conversation-dedup are computed against. */
  userMessage:      string;
  uiContext?:       CopilotUiContextInput;
  historyLimit?:    number;
  maxContextChars?: number;
}): Promise<CopilotContextBundle> {
  const historyLimit    = params.historyLimit ?? MAX_CONVERSATION_HISTORY_MESSAGES;
  const maxContextChars = params.maxContextChars ?? MAX_CONTEXT_CHARS;
  const module = normalizeModule(params.uiContext?.currentModule);

  const [rawHistory, selectedEntity] = await Promise.all([
    loadHistory(params.conversationId, historyLimit),
    verifySelectedEntity(params.userId, params.uiContext?.selectedEntity),
  ]);

  const appContextLine = buildAppContextLine(params.uiContext?.currentModule, params.uiContext?.currentPage, selectedEntity);

  // Deduplication (Phase 8 spec section 14): don't repeat a memory whose
  // content is already visible in the recent transcript — checked against
  // the history that's already been loaded, so this never costs an extra
  // query. A plain substring containment check on normalized text, not
  // embeddings — good enough to catch the concrete example the spec gives
  // (a memory that just restates something the user already said this
  // conversation) without pretending to understand paraphrases.
  const historyText = rawHistory.map((m) => m.content ?? "").join("\n");

  // Phase 10: one embedding of the current message, shared by both
  // semantic searches below (memory + historical conversation) — computed
  // once here rather than twice, per the spec's own cost-control guidance.
  // A no-op (null vector, 0ms) whenever semantic retrieval is disabled or
  // the provider is unavailable; every call site below already treats that
  // as "no semantic candidates this turn", so nothing downstream needs its
  // own disabled/unavailable branch.
  const queryEmbedding = await embedQuery(params.userMessage);

  const [memorySelection, historicalOutcome] = await Promise.all([
    selectRelevantMemories(params.userId, params.userMessage, {
      module,
      excludeIfPresentIn: historyText || undefined,
      precomputedQueryEmbedding: queryEmbedding,
    }),
    semanticSearchConversationHistory(params.userId, params.userMessage, params.conversationId, queryEmbedding),
  ]);
  const { memories, candidateCount, semanticCandidateCount, usedSemanticFallback } = memorySelection;
  const memoryContext = formatMemoryContextBlock(memories);
  const historicalContext = formatHistoricalContextBlock(historicalOutcome.matches);

  const { history, truncated } = trimHistoryToBudget(rawHistory, maxContextChars);

  recordContextAssembly({
    requestId:            randomUUID(),
    conversationId:       params.conversationId,
    userId:               params.userId,
    memoryCandidates:     candidateCount,
    memoriesSelected:     memories.length,
    conversationMessages: history.length,
    contextChars: (
      historyCharLength(history) + (memoryContext?.length ?? 0) +
      (appContextLine?.length ?? 0) + (historicalContext?.length ?? 0)
    ),
    truncatedHistory:     truncated,
    selectedEntityType:   selectedEntity?.type ?? null,
    module,
    // Phase 10 hybrid-retrieval observability — counts/timings/flags only,
    // never memory or conversation content. See copilotObservability.ts.
    semanticRetrievalUsed: !usedSemanticFallback || historicalOutcome.matches.length > 0,
    embeddingLatencyMs:    Math.max(queryEmbedding.embeddingLatencyMs, historicalOutcome.embeddingLatencyMs),
    semanticCandidates:    semanticCandidateCount,
    deterministicCandidates: candidateCount,
    retrievalThreshold:    Number(getEnv().COPILOT_SEMANTIC_SIMILARITY_THRESHOLD),
    retrievalFallback:     usedSemanticFallback,
    historicalMatches:     historicalOutcome.matches.length,
  });

  return { history, memoryContext, historicalContext, appContextLine, module, selectedEntity };
}
