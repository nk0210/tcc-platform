import { z } from "zod";

const schema = z.object({
  NODE_ENV:               z.enum(["development", "production", "test"]).default("development"),
  PORT:                   z.string().default("4000"),
  DATABASE_URL:           z.string({ required_error: "DATABASE_URL is required" }),
  JWT_ACCESS_SECRET:      z.string({ required_error: "JWT_ACCESS_SECRET is required" }),
  JWT_REFRESH_SECRET:     z.string({ required_error: "JWT_REFRESH_SECRET is required" }),
  JWT_ACCESS_EXPIRES_IN:  z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  CORS_ORIGIN:            z.string().default("http://localhost:3000"),
  BCRYPT_ROUNDS:          z.string().default("12"),
  // Optional, not required to boot: Copilot degrades to a 503
  // ("AI service not configured") on its own routes when this is unset,
  // rather than blocking the rest of the API from starting.
  GROQ_API_KEY:                    z.string().optional(),
  // Copilot agent loop limits — sensible defaults, overridable per
  // environment without a code change. See copilotAgentService.ts.
  COPILOT_MAX_AGENT_STEPS:         z.string().default("5"),
  // Per-attempt provider timeout — how long a single Groq call is allowed
  // to take before the retry layer (copilotAiProvider.ts) treats it as
  // failed and (if retryable) tries again. Not the overall request bound —
  // see COPILOT_PROVIDER_MAX_TOTAL_MS for that.
  COPILOT_PROVIDER_TIMEOUT_MS:     z.string().default("20000"),
  COPILOT_TOOL_TIMEOUT_MS:         z.string().default("10000"),
  // Provider retry policy (copilotAiProvider.ts's ReliableAIProvider).
  // MAX_RETRIES=2 means up to 3 total attempts. MAX_TOTAL_MS is a hard
  // ceiling on the whole complete() call (all attempts + backoff combined)
  // regardless of the other three — the one setting that actually bounds a
  // user's worst-case wait, so retries can never stack into an unbounded
  // request time.
  COPILOT_PROVIDER_MAX_RETRIES:         z.string().default("2"),
  COPILOT_PROVIDER_INITIAL_BACKOFF_MS:  z.string().default("500"),
  COPILOT_PROVIDER_MAX_BACKOFF_MS:      z.string().default("8000"),
  COPILOT_PROVIDER_MAX_TOTAL_MS:        z.string().default("45000"),
  // How long a MEDIUM/HIGH-risk pending action stays confirmable before it
  // expires. See copilotActionService.ts.
  COPILOT_PENDING_ACTION_TTL_MS:   z.string().default("300000"),
  // Phase 10: hybrid (deterministic + semantic) memory/conversation
  // retrieval. Reuses GROQ_API_KEY (Groq's embeddings endpoint, already a
  // dependency) — no separate provider key. Flip to "false" for an
  // instant, safe rollback to Phase 7/8's deterministic-only retrieval;
  // semantic retrieval is always an enhancement layered on top, never a
  // single point of failure — see copilotEmbeddingProvider.ts.
  COPILOT_SEMANTIC_RETRIEVAL_ENABLED:      z.string().default("true"),
  // Which EmbeddingProvider implementation to construct — see
  // copilotEmbeddingProvider.ts. "groq" reuses GROQ_API_KEY (default,
  // zero extra config). "openai-compatible" calls COPILOT_EMBEDDING_BASE_URL
  // directly via fetch — use this for OpenAI itself or any local/self-hosted
  // server (Ollama, LM Studio, vLLM, ...) that implements the same
  // POST /embeddings shape. An unrecognized value falls back to "groq".
  COPILOT_EMBEDDING_PROVIDER:              z.enum(["groq", "openai-compatible"]).default("groq"),
  COPILOT_EMBEDDING_MODEL:                 z.string().default("nomic-embed-text-v1_5"),
  // Required only when COPILOT_EMBEDDING_PROVIDER=openai-compatible, e.g.
  // "https://api.openai.com/v1" or "http://localhost:11434/v1" for a local
  // Ollama server. Ignored for "groq". No trailing slash required.
  COPILOT_EMBEDDING_BASE_URL:              z.string().optional(),
  // Optional even for openai-compatible — many local/self-hosted servers
  // accept requests with no Authorization header at all.
  COPILOT_EMBEDDING_API_KEY:               z.string().optional(),
  // Optional — only sent to the openai-compatible provider when set (some
  // models, e.g. OpenAI's text-embedding-3-*, accept a `dimensions` field
  // to truncate their native output size).
  COPILOT_EMBEDDING_DIMENSIONS:            z.string().optional(),
  // Bounded like every other Copilot external call (copilotUtil.withTimeout)
  // — an embedding call that hangs must never hang the whole turn.
  COPILOT_EMBEDDING_TIMEOUT_MS:            z.string().default("5000"),
  // Cosine similarity in [-1, 1]; a candidate below this is discarded, not
  // just deprioritized — "nearest available" is not the same as "relevant
  // enough". Initial value, easy to tune per environment/model.
  COPILOT_SEMANTIC_SIMILARITY_THRESHOLD:   z.string().default("0.55"),
});

export type Env = z.infer<typeof schema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌  Invalid environment variables:");
    for (const e of parsed.error.errors) {
      console.error(`   ${e.path.join(".")}: ${e.message}`);
    }
    process.exit(1);
  }
  _env = parsed.data;
  return _env;
}

export const isDev = (): boolean => getEnv().NODE_ENV === "development";