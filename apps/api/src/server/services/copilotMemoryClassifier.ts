/**
 * Copilot Memory Classifier — Phase 7
 *
 * Pure, deterministic text helpers used by copilotMemoryService.ts. No AI
 * call, no embeddings, no external dependency — same philosophy as
 * copilotService.deriveConversationTitle() (Phase 6): small, inspectable,
 * and testable in isolation from the database.
 *
 * Everything here is intentionally narrow. It is not an attempt at general
 * language understanding — it recognizes a small, hand-authored set of
 * patterns and falls back to "I'm not confident" behavior (a generic
 * classification, or declining to resolve an ambiguous case) rather than
 * guessing. Broader semantic understanding (real conflict detection,
 * flexible "forget" resolution) is explicitly deferred to a future phase
 * once structured memory behavior like this has been proven — see the
 * Phase 7 spec's "No Vector Database Yet" section.
 */
import type { CopilotMemoryType } from "@prisma/client";

export const MEMORY_CONTENT_MAX_LENGTH = 300;

// ── Sanitization / normalization ────────────────────────────────────────

/** Whitespace-collapsed, trimmed, and length-bounded — the actual `content`
 *  stored for a memory. Preserves the user's own casing/punctuation for
 *  readability; see normalizeMemoryContent() below for the separate,
 *  comparison-only form. Mirrors deriveConversationTitle()'s truncation
 *  approach (safe ellipsis, never a hard reject on length alone). */
export function sanitizeMemoryContent(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MEMORY_CONTENT_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, MEMORY_CONTENT_MAX_LENGTH - 1).trimEnd()}…`;
}

/** Lowercased on top of sanitizeMemoryContent() — used ONLY for equality
 *  comparisons (exact-duplicate detection, conflict-axis matching). Never
 *  stored as the displayed content and never shown to a user or the model. */
export function normalizeMemoryContent(raw: string): string {
  return sanitizeMemoryContent(raw).toLowerCase();
}

// ── Data minimization: reject secret-like content outright ─────────────
// Per the Phase 7 spec: "If a memory proposal contains secret-like
// information, reject it" — the whole memory, never a partial/redacted
// store. These are heuristics, not a secrets scanner; false negatives are
// expected and acceptable (the boundary that actually matters — the model
// never gets direct database access — holds regardless of whether this
// catches every case).

const SECRET_PATTERNS: RegExp[] = [
  /\bapi[\s_-]?key\b/i,
  /\bsecret[\s_-]?key\b/i,
  /\bprivate[\s_-]?key\b/i,
  /\baccess[\s_-]?token\b/i,
  /\bpassword\b/i,
  /\bpasswd\b/i,
  /\bseed\s?phrase\b/i,
  /\brecovery\s?phrase\b/i,
  /\bpin\s?(code|number)?\s*(is|:)/i,
  // JWT-shaped: three dot-separated base64url segments.
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
  // AWS access key id.
  /\bAKIA[0-9A-Z]{16}\b/,
  // A long contiguous alphanumeric run — very unlikely in an ordinary
  // sentence, common shape for API keys/tokens/hashes.
  /\b[A-Za-z0-9_-]{32,}\b/,
  // Card-number-shaped digit run (13-19 digits, optionally grouped).
  /\b(?:\d[ -]?){13,19}\b/,
];

export function looksLikeSecret(content: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(content));
}

// ── Memory type classification (used when the caller doesn't already know
//    the type — the explicit "remember that ..." pathway) ─────────────────

const COPILOT_KEYWORDS = /\b(copilot|respond|responses?|answers?|explain(ation)?s?|concise|brief(ly)?|detailed|verbose|thorough|tone|style|format(ting)?|wording|repl(y|ies))\b/i;
const TRADING_KEYWORDS  = /\b(trade|trades|trading|symbol|instrument|pair|xauusd|eurusd|gbpusd|usdjpy|btc|bitcoin|eth|ethereum|gold|silver|forex|crypto|leverage|lot\s?size|stop\s?loss|take\s?profit|strategy|session|timeframe|watchlist|risk)\b/i;
const GOAL_KEYWORDS      = /\b(goal|aim(ing)?|working\s?towards|working\s?on|improve|improving|becoming|focus(ing)?\s?on|target)\b/i;
const PREFERENCE_VERBS   = /\b(prefer(s|red)?|like[sd]?|love[sd]?|enjoy(s|ed)?|favorite|favourite)\b/i;

/** Priority order matters: a message can match several groups (e.g.
 *  "I prefer concise trading summaries" mentions both style and trading
 *  words) — Copilot-configuration language wins first since it's the most
 *  specific/actionable category, then trading, then goals, then a bare
 *  preference verb, with EXPLICIT_FACT as the catch-all for anything that
 *  reads as a plain statement rather than a preference. */
export function classifyMemoryType(content: string): CopilotMemoryType {
  if (COPILOT_KEYWORDS.test(content)) return "COPILOT_PREFERENCE";
  if (TRADING_KEYWORDS.test(content))  return "TRADING_PREFERENCE";
  if (GOAL_KEYWORDS.test(content))     return "GOAL";
  if (PREFERENCE_VERBS.test(content))  return "PREFERENCE";
  return "EXPLICIT_FACT";
}

/** Which memory types are plausibly relevant to a given in-conversation
 *  message — the structured (non-embedding) retrieval filter described in
 *  the Phase 7 spec's "Context Injection" section. COPILOT_PREFERENCE is
 *  always included because it shapes how every answer is phrased,
 *  regardless of topic; PREFERENCE/EXPLICIT_FACT are broadly-useful
 *  background and always included too (the volume is bounded anyway — see
 *  MAX_MEMORIES_INJECTED in copilotMemoryService.ts); TRADING_PREFERENCE
 *  and GOAL are included only when the message's own words suggest they
 *  matter, so an unrelated question (e.g. "how should I configure
 *  Copilot?") doesn't pull in trading-preference memories.
 *
 *  Phase 8: `module` is an extra, optional relevance signal — being in the
 *  trading interface itself is a hint that trading-flavored memory is
 *  plausibly relevant even when the message's own wording doesn't happen
 *  to mention a trading keyword (e.g. "how am I doing?" asked from the
 *  Trading Dashboard). Only "TRADING" changes anything here today, because
 *  it's the only module with real backend tools/context — recognizing any
 *  other module identifier (see copilotContextOrchestrator.ts) never
 *  invents retrieval behavior for a module that has no real data yet. */
export function relevantMemoryTypesForMessage(message: string, module?: string | null): CopilotMemoryType[] {
  const types = new Set<CopilotMemoryType>(["COPILOT_PREFERENCE", "PREFERENCE", "EXPLICIT_FACT"]);
  if (TRADING_KEYWORDS.test(message)) types.add("TRADING_PREFERENCE");
  if (GOAL_KEYWORDS.test(message))    types.add("GOAL");
  if (module === "TRADING")           types.add("TRADING_PREFERENCE");
  return Array.from(types);
}

// ── Explicit remember/forget command detection ──────────────────────────
// Deliberately narrow: only fires for a short, single-intent instruction.
// A message containing a "?" or an unusually long tail is more likely a
// compound request ("remember X and also tell me Y") — those fall through
// to the normal agent loop instead of being (mis)handled here. This is the
// "safer deterministic path" the Phase 7 spec asks for, applied only where
// it's actually safe.

const EXPLICIT_COMMAND_MAX_LENGTH = 200;

const FORGET_PATTERNS: RegExp[] = [
  /^(?:please\s+)?forget\s+(?:that\s+)?(.+)$/i,
  /^stop\s+remembering\s+(?:that\s+)?(.+)$/i,
  /^delete\s+(?:the\s+)?memory\s+(?:of|about)\s+(.+)$/i,
];

const REMEMBER_PATTERNS: RegExp[] = [
  /^(?:please\s+)?remember\s+(?:that\s+)?(.+)$/i,
  /^(?:can|could)\s+you\s+remember\s+(?:that\s+)?(.+)$/i,
  /^save\s+(?:this|that)(?:\s+to\s+memory)?:?\s+(.+)$/i,
];

export type ExplicitMemoryCommand =
  | { kind: "remember"; content: string }
  | { kind: "forget"; subject: string };

function extractOne(message: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = message.match(p);
    const captured = m?.[1]?.trim();
    if (captured) return captured;
  }
  return null;
}

/** Returns null (defer to the normal agent loop) for anything that isn't a
 *  clean, single-intent "remember X" / "forget X" instruction. */
export function detectExplicitMemoryCommand(message: string): ExplicitMemoryCommand | null {
  const trimmed = message.trim();
  if (trimmed.includes("?")) return null;

  const forgetSubject = extractOne(trimmed, FORGET_PATTERNS);
  if (forgetSubject && forgetSubject.length <= EXPLICIT_COMMAND_MAX_LENGTH) {
    return { kind: "forget", subject: forgetSubject };
  }

  const rememberContent = extractOne(trimmed, REMEMBER_PATTERNS);
  if (rememberContent && rememberContent.length <= EXPLICIT_COMMAND_MAX_LENGTH) {
    return { kind: "remember", content: rememberContent };
  }

  return null;
}

// ── "Forget" target resolution ──────────────────────────────────────────
// Given a free-text subject ("that I prefer XAUUSD" → "i prefer xauusd"
// after normalization) and the user's own active memories, find candidates
// by simple bidirectional substring containment plus majority-word overlap
// — no embeddings. Only ever acted on automatically when exactly one
// candidate matches; anything else (zero or multiple) is left for the
// agent to resolve conversationally (get_memories + delete_memory, with the
// normal confirmation step) rather than guessing.

const STOPWORDS = new Set([
  "i", "my", "me", "that", "the", "a", "an", "is", "am", "to", "of", "for",
  "and", "about", "prefer", "preference", "preferences", "you", "your",
]);

function meaningfulWords(normalized: string): string[] {
  return normalized.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function findForgetCandidates<T extends { normalizedContent: string }>(
  subject: string,
  memories: T[]
): T[] {
  const normSubject = normalizeMemoryContent(subject);
  const subjectWords = new Set(meaningfulWords(normSubject));

  return memories.filter((m) => {
    if (normSubject.includes(m.normalizedContent) || m.normalizedContent.includes(normSubject)) return true;
    const memWords = meaningfulWords(m.normalizedContent);
    if (memWords.length === 0) return false;
    const overlap = memWords.filter((w) => subjectWords.has(w));
    return overlap.length / memWords.length >= 0.6;
  });
}

// ── Conflict axes ────────────────────────────────────────────────────────
// See the module doc comment: a small, hand-authored table of mutually-
// exclusive keyword groups, scoped to one memory type per axis. A new
// EXPLICIT memory matching one group supersedes any ACTIVE memory of the
// same type matching a DIFFERENT group on the same axis. No axis match on
// either side means no conflict — unrelated facts of the same type (e.g.
// "prefers XAUUSD" and "prefers EURUSD") simply coexist. Extend this list
// deliberately as new real contradictions turn out to be worth catching.

export interface ConflictAxis {
  type: CopilotMemoryType;
  groups: RegExp[];
}

export const CONFLICT_AXES: ConflictAxis[] = [
  {
    // Response-length preference — the concrete case the Phase 7 spec's own
    // example and test scenario describe ("prefers concise" → later
    // "prefers detailed").
    type: "COPILOT_PREFERENCE",
    groups: [
      /\b(concise|brief|short(er)?|less\s?detail)\b/i,
      /\b(detailed|verbose|long(er)?|thorough|in-depth|more\s?detail)\b/i,
    ],
  },
];

/** Index of the first group in `axis` that matches `normalizedContent`, or
 *  null if none match (i.e. this content isn't on this axis at all). */
export function findConflictGroup(axis: ConflictAxis, normalizedContent: string): number | null {
  for (let i = 0; i < axis.groups.length; i++) {
    if (axis.groups[i].test(normalizedContent)) return i;
  }
  return null;
}
