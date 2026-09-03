import "dotenv/config";
import { beforeEach } from "vitest";
import { __setEmbeddingProviderForTests, type EmbeddingProvider } from "../server/services/copilotEmbeddingProvider";

/** Phase 10: every existing test predates semantic retrieval and was
 *  written against fully deterministic, network-free memory/conversation
 *  retrieval. Without a global default here, selectRelevantMemories() and
 *  friends would make a REAL Groq embeddings call in every one of those
 *  tests the moment this module is imported (GROQ_API_KEY is configured in
 *  this dev environment) — slow, flaky, and burns the same shared quota
 *  that's already been exhausted once this session (see the Phase 9
 *  report's live-verification section).
 *
 * Defaulting to a provider that always fails makes semanticSearchMemories/
 * semanticSearchConversationHistory take their documented fallback path
 * (usedFallback: true, zero candidates) in every test that doesn't
 * explicitly opt in — which is exactly the old Phase 7/8/9 behavior
 * (deterministic retrieval alone determines the result), so no existing
 * test needed to change for Phase 10. Reset before EVERY test (not just
 * once) so a Phase 10 test that installs its own fake embedding provider
 * can never accidentally leak it into the next test. Phase 10's own tests
 * override this explicitly (see copilotSemanticRetrieval.test.ts and
 * friends) to exercise real hybrid-retrieval logic against controlled,
 * fast, deterministic fake vectors — never a live network call either way. */
const alwaysFailingEmbeddingProvider: EmbeddingProvider = {
  async embed(): Promise<number[]> {
    throw new Error("embedding provider disabled by default in tests — see src/test/setup.ts");
  },
};

beforeEach(() => {
  __setEmbeddingProviderForTests(alwaysFailingEmbeddingProvider);
});
