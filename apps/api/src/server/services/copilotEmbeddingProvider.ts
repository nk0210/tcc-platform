/**
 * Copilot Embedding Provider — Phase 10, made pluggable in the production-
 * hardening pass
 *
 * Thin, provider-agnostic abstraction over whatever embedding backend
 * powers Copilot's semantic memory/conversation retrieval — mirrors
 * copilotAiProvider.ts's AIProvider abstraction exactly (same reasoning:
 * everything above this file talks only to EmbeddingProvider /
 * getEmbeddingProvider(), never a concrete SDK/HTTP client directly, so
 * swapping providers later means writing one new class here).
 *
 * IMPORTANT live-environment finding (kept from Phase 10, still true):
 * this dev environment's GROQ_API_KEY has no embedding-model access —
 * `groq.embeddings.create()` returns 404 model_not_found for
 * "nomic-embed-text-v1_5", and `groq.models.list()` confirms the key's
 * catalog is chat/audio-only. That's exactly the "embedding provider
 * unavailable" case this whole architecture is built to tolerate — see
 * EmbeddingProviderNotConfiguredError and every semantic-retrieval call
 * site's fallback path. This pass makes the provider genuinely
 * SWAPPABLE via configuration rather than hardcoded to Groq, so a real
 * embedding-capable account (Groq or otherwise) can be dropped in with an
 * env change, no code change: COPILOT_EMBEDDING_PROVIDER selects between
 * "groq" and "openai-compatible" (any endpoint implementing OpenAI's
 * POST /embeddings shape — OpenAI itself, or a local server like Ollama/
 * LM Studio/vLLM's OpenAI-compatible mode, which is what "local, lightweight,
 * no new ML stack" means in practice here: this file makes an HTTP call
 * to wherever COPILOT_EMBEDDING_BASE_URL points, using Node's built-in
 * `fetch` — no new SDK dependency added for it).
 *
 * Deliberately NOT wrapped in copilotAiProvider.ts's ReliableAIProvider
 * retry/backoff machinery: a failed chat completion has no good fallback
 * (the user gets nothing), so retrying to recover the turn is worth the
 * extra latency; a failed embedding has a cheap, correct fallback
 * (deterministic retrieval continues), so retrying would only add latency
 * to a path that should degrade fast instead. One bounded-timeout attempt,
 * fail closed to "no embedding this time" — see embed()/embedMany() below.
 */
import Groq from "groq-sdk";
import { randomUUID } from "crypto";
import { getEnv } from "../../config/env";
import { withTimeout } from "./copilotUtil";
import { recordProviderCall } from "./copilotObservability";
import { classifyProviderError, type ProviderErrorCategory } from "./copilotAiProvider";

export class EmbeddingProviderNotConfiguredError extends Error {
  constructor(detail?: string) { super(detail ? `EMBEDDING_PROVIDER_NOT_CONFIGURED: ${detail}` : "EMBEDDING_PROVIDER_NOT_CONFIGURED"); }
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  /** Batch form — one round trip for many inputs, used by the backfill job
   *  (copilotMemoryBackfill.ts). Optional so a future minimal provider
   *  implementation isn't forced to support batching. */
  embedMany?(texts: string[]): Promise<number[][]>;
}

// ── Groq implementation ──────────────────────────────────────────────────

class GroqEmbeddingProvider implements EmbeddingProvider {
  private client(): Groq {
    const apiKey = getEnv().GROQ_API_KEY;
    if (!apiKey) throw new EmbeddingProviderNotConfiguredError("GROQ_API_KEY not set");
    return new Groq({ apiKey });
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedMany([text]);
    return vector;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const groq = this.client();
    const model = getEnv().COPILOT_EMBEDDING_MODEL;
    const timeoutMs = Number(getEnv().COPILOT_EMBEDDING_TIMEOUT_MS);
    const requestId = randomUUID();
    const start = Date.now();

    try {
      const response = await withTimeout(
        groq.embeddings.create({ input: texts, model, encoding_format: "float" }),
        timeoutMs,
        "Embedding provider"
      );

      recordProviderCall({
        requestId, provider: "groq-embeddings", model, attempt: 0,
        durationMs: Date.now() - start, status: "success", totalTokens: response.usage?.total_tokens,
      });

      // encoding_format: "float" guarantees number[] (never the base64
      // string form the SDK's type also allows for the alternative format).
      return response.data
        .sort((a, b) => a.index - b.index)
        .map((d) => (Array.isArray(d.embedding) ? d.embedding : []));
    } catch (err) {
      const { category } = classifyProviderError(err);
      recordProviderCall({
        requestId, provider: "groq-embeddings", model: null, attempt: 0,
        durationMs: Date.now() - start, status: "failure", errorCategory: category,
      });
      throw err;
    }
  }
}

// ── OpenAI-compatible implementation (OpenAI itself, or a local/self-hosted
//    server exposing the same POST /embeddings shape — Ollama, LM Studio,
//    vLLM, etc. all support this without any new dependency here) ────────

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { total_tokens?: number };
}

function classifyHttpStatus(status: number): ProviderErrorCategory {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server_error";
  return "bad_request";
}

/** Config is read from getEnv() at construction time by default (see
 *  buildConfiguredProvider() below), but can be overridden explicitly —
 *  this is what makes the class unit-testable without mutating the
 *  process-wide, cached-after-first-call getEnv() singleton. */
interface OpenAICompatibleConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  dimensions?: string;
  timeoutMs?: number;
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly config: OpenAICompatibleConfig = {}) {}

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedMany([text]);
    return vector;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const env = getEnv();
    const baseUrl = this.config.baseUrl ?? env.COPILOT_EMBEDDING_BASE_URL;
    if (!baseUrl) throw new EmbeddingProviderNotConfiguredError("COPILOT_EMBEDDING_BASE_URL not set");

    const model = this.config.model ?? env.COPILOT_EMBEDDING_MODEL;
    const apiKey = this.config.apiKey ?? env.COPILOT_EMBEDDING_API_KEY;
    const dimensions = this.config.dimensions ?? env.COPILOT_EMBEDDING_DIMENSIONS;
    const timeoutMs = this.config.timeoutMs ?? Number(env.COPILOT_EMBEDDING_TIMEOUT_MS);
    const requestId = randomUUID();
    const start = Date.now();
    const url = `${baseUrl.replace(/\/+$/, "")}/embeddings`;

    try {
      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Many local/self-hosted servers need no key at all — only
            // sent when configured, never a hardcoded/blank Authorization
            // header that could confuse a server that rejects malformed auth.
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            input: texts,
            model,
            ...(dimensions ? { dimensions: Number(dimensions) } : {}),
          }),
        }),
        timeoutMs,
        "Embedding provider"
      );

      if (!res.ok) {
        const category = classifyHttpStatus(res.status);
        recordProviderCall({
          requestId, provider: "openai-compatible-embeddings", model: null, attempt: 0,
          durationMs: Date.now() - start, status: "failure", errorCategory: category,
        });
        // Already recorded above — tagged so the catch block below doesn't
        // record the same failure a second time under a misclassified category.
        throw Object.assign(new Error(`Embedding provider responded ${res.status} ${res.statusText}`), { alreadyRecorded: true });
      }

      const body = (await res.json()) as OpenAIEmbeddingResponse;
      recordProviderCall({
        requestId, provider: "openai-compatible-embeddings", model, attempt: 0,
        durationMs: Date.now() - start, status: "success", totalTokens: body.usage?.total_tokens,
      });

      return body.data
        .sort((a, b) => a.index - b.index)
        .map((d) => (Array.isArray(d.embedding) ? d.embedding : []));
    } catch (err) {
      if (err instanceof EmbeddingProviderNotConfiguredError) throw err;
      if (err instanceof Error && (err as Error & { alreadyRecorded?: boolean }).alreadyRecorded) throw err;
      const { category } = classifyProviderError(err); // handles our own TimeoutError from withTimeout
      recordProviderCall({
        requestId, provider: "openai-compatible-embeddings", model: null, attempt: 0,
        durationMs: Date.now() - start, status: "failure", errorCategory: category === "unknown" ? "connection_error" : category,
      });
      throw err;
    }
  }
}

// ── Provider selection ───────────────────────────────────────────────────

function buildConfiguredProvider(): EmbeddingProvider {
  const providerName = getEnv().COPILOT_EMBEDDING_PROVIDER;
  if (providerName === "openai-compatible") return new OpenAICompatibleEmbeddingProvider();
  return new GroqEmbeddingProvider(); // "groq", or an unrecognized value — the documented default
}

// ── Singleton accessor ───────────────────────────────────────────────────
// Same pattern as copilotAiProvider.ts's getAIProvider().

let providerInstance: EmbeddingProvider | null = null;
let testOverride:     EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (testOverride) return testOverride;
  if (!providerInstance) providerInstance = buildConfiguredProvider();
  return providerInstance;
}

/** Test-only: inject a fake EmbeddingProvider, same reasoning as
 *  copilotAiProvider.ts's __setAIProviderForTests. Pass null to restore. */
export function __setEmbeddingProviderForTests(provider: EmbeddingProvider | null): void {
  testOverride = provider;
}

/** The single feature flag that gates ALL of Phase 10's semantic behavior
 *  (memory and conversation alike) — see copilotSemanticRetrieval.ts. When
 *  false, every semantic-retrieval call site short-circuits to "no
 *  candidates" before ever touching this provider, so Copilot runs exactly
 *  as it did at the end of Phase 8/9: deterministic retrieval only. */
export function isSemanticRetrievalEnabled(): boolean {
  return getEnv().COPILOT_SEMANTIC_RETRIEVAL_ENABLED === "true";
}
