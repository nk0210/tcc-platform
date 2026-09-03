import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  cosineSimilarity,
  embedQuery,
  semanticSearchMemories,
  mergeAndRankMemories,
  semanticSearchConversationHistory,
  formatHistoricalContextBlock,
  embedMemoryInBackground,
  embedMessageInBackground,
  EMBEDDING_SKIPPED_MARKER,
  RANKING_WEIGHTS,
} from "./copilotSemanticRetrieval";
import { __setEmbeddingProviderForTests, type EmbeddingProvider } from "./copilotEmbeddingProvider";
import { copilotRepository } from "../repositories/copilotRepository";
import db from "../../lib/prisma";
import { createTestUser, deleteTestUser, type TestUser } from "../../test/helpers";
import type { CopilotMemory } from "@prisma/client";

afterEach(() => {
  __setEmbeddingProviderForTests(null); // back to the suite-wide always-failing default (src/test/setup.ts)
});

function fakeProvider(fn: (text: string) => number[]): EmbeddingProvider {
  return { async embed(text: string) { return fn(text); } };
}

function failingProvider(message = "simulated provider failure"): EmbeddingProvider {
  return { async embed(): Promise<number[]> { throw new Error(message); } };
}

function slowProvider(delayMs: number, vector: number[]): EmbeddingProvider {
  return { async embed() { await new Promise((r) => setTimeout(r, delayMs)); return vector; } };
}

// Small, hand-picked unit vectors so similarity is exact and easy to reason
// about — real embeddings are much higher-dimensional, but cosine
// similarity's math doesn't care about dimensionality.
const VEC_A       = [1, 0, 0];
const VEC_A_CLOSE = [0.9, 0.1, 0];   // high similarity to VEC_A
const VEC_B       = [0, 1, 0];       // orthogonal to VEC_A (similarity 0)
const VEC_OPPOSITE = [-1, 0, 0];     // opposite of VEC_A (similarity -1)

async function createMemoryWithEmbedding(userId: string, content: string, embedding: number[], overrides: Partial<{ type: CopilotMemory["type"]; updatedAt: Date }> = {}) {
  return db.copilotMemory.create({
    data: {
      userId, type: overrides.type ?? "EXPLICIT_FACT", content, normalizedContent: content.toLowerCase(),
      source: "EXPLICIT", embedding, embeddingModel: "test-model", embeddingUpdatedAt: new Date(),
      ...(overrides.updatedAt ? { updatedAt: overrides.updatedAt } : {}),
    },
  });
}

describe("copilotSemanticRetrieval — cosineSimilarity", () => {
  it("identical vectors score 1", () => {
    expect(cosineSimilarity(VEC_A, [...VEC_A])).toBeCloseTo(1, 5);
  });
  it("orthogonal vectors score 0", () => {
    expect(cosineSimilarity(VEC_A, VEC_B)).toBeCloseTo(0, 5);
  });
  it("opposite vectors score -1", () => {
    expect(cosineSimilarity(VEC_A, VEC_OPPOSITE)).toBeCloseTo(-1, 5);
  });
  it("a close-but-not-identical vector scores high but below 1", () => {
    const sim = cosineSimilarity(VEC_A, VEC_A_CLOSE);
    expect(sim).toBeGreaterThan(0.9);
    expect(sim).toBeLessThan(1);
  });
  it("mismatched dimensions score 0 rather than throwing — this is what makes EMBEDDING_SKIPPED_MARKER inert", () => {
    expect(cosineSimilarity(VEC_A, EMBEDDING_SKIPPED_MARKER)).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });
  it("empty or zero-magnitude vectors score 0, never NaN/Infinity", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0, 0], VEC_A)).toBe(0);
  });
});

describe("copilotSemanticRetrieval — embedQuery (provider fallback scenarios)", () => {
  it("successful embedding returns the vector and a latency", async () => {
    __setEmbeddingProviderForTests(fakeProvider(() => VEC_A));
    const result = await embedQuery("how am I doing?");
    expect(result.vector).toEqual(VEC_A);
    expect(result.embeddingLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it("provider failure falls back to null, never throws", async () => {
    __setEmbeddingProviderForTests(failingProvider());
    const result = await embedQuery("anything");
    expect(result.vector).toBeNull();
  });

  it("a malformed/degenerate response (e.g. an empty vector) is treated as unusable", async () => {
    __setEmbeddingProviderForTests(fakeProvider(() => []));
    const result = await embedQuery("anything");
    expect(result.vector).toBeNull();
  });

  it("a slow provider is awaited (this layer has no timeout of its own — GroqEmbeddingProvider's internal withTimeout is what bounds a real call; this proves a merely-slow FAKE still resolves normally)", async () => {
    __setEmbeddingProviderForTests(slowProvider(10, VEC_A));
    const result = await embedQuery("anything");
    expect(result.vector).toEqual(VEC_A);
  });
});

describe("copilotSemanticRetrieval — semanticSearchMemories", () => {
  let user: TestUser;
  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { await deleteTestUser(user.id); });

  it("a semantically close memory is retrieved even with no shared keywords", async () => {
    await createMemoryWithEmbedding(user.id, "I tend to revenge trade after a loss", VEC_A);
    __setEmbeddingProviderForTests(fakeProvider(() => VEC_A_CLOSE));

    const result = await semanticSearchMemories(user.id, "why do I keep making impulsive decisions after losing?");
    expect(result.usedFallback).toBe(false);
    expect(result.candidates.some((c) => c.memory.content.includes("revenge trade"))).toBe(true);
  });

  it("a weakly/unrelated memory is rejected by the similarity threshold", async () => {
    const fresh = await createTestUser();
    try {
      await createMemoryWithEmbedding(fresh.id, "completely unrelated fact", VEC_B);
      __setEmbeddingProviderForTests(fakeProvider(() => VEC_A)); // orthogonal to VEC_B → similarity 0

      const result = await semanticSearchMemories(fresh.id, "some query");
      expect(result.candidates).toHaveLength(0);
    } finally {
      await deleteTestUser(fresh.id);
    }
  });

  it("empty result when the user has no embedded memories at all", async () => {
    const fresh = await createTestUser();
    try {
      __setEmbeddingProviderForTests(fakeProvider(() => VEC_A));
      const result = await semanticSearchMemories(fresh.id, "anything");
      expect(result.candidates).toEqual([]);
      expect(result.usedFallback).toBe(false); // ran fine, just found nothing — not the same as "fallback"
    } finally {
      await deleteTestUser(fresh.id);
    }
  });

  it("falls back safely (deterministic retrieval unaffected) when the embedding provider is unavailable", async () => {
    __setEmbeddingProviderForTests(failingProvider());
    const result = await semanticSearchMemories(user.id, "why do I keep losing?");
    expect(result.usedFallback).toBe(true);
    expect(result.candidates).toEqual([]);
  });

  it("ownership: never returns another user's memory, even a semantically identical one", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    try {
      await createMemoryWithEmbedding(userA.id, "userA's private trading fear", VEC_A);
      await createMemoryWithEmbedding(userB.id, "userB's private trading fear", VEC_A);
      __setEmbeddingProviderForTests(fakeProvider(() => VEC_A));

      const asA = await semanticSearchMemories(userA.id, "trading fear");
      expect(asA.candidates.every((c) => c.memory.userId === userA.id)).toBe(true);
      expect(asA.candidates.some((c) => c.memory.content.includes("userB"))).toBe(false);
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });

  it("a memory with no embedding yet (background job hasn't run) is never a semantic candidate", async () => {
    const fresh = await createTestUser();
    try {
      await db.copilotMemory.create({
        data: { userId: fresh.id, type: "EXPLICIT_FACT", content: "not yet embedded", normalizedContent: "not yet embedded", source: "EXPLICIT" },
      });
      __setEmbeddingProviderForTests(fakeProvider(() => VEC_A));
      const result = await semanticSearchMemories(fresh.id, "anything");
      expect(result.candidates).toEqual([]);
    } finally {
      await deleteTestUser(fresh.id);
    }
  });
});

describe("copilotSemanticRetrieval — mergeAndRankMemories", () => {
  function memRow(id: string, overrides: Partial<CopilotMemory> = {}): CopilotMemory {
    return {
      id, userId: "u1", type: "EXPLICIT_FACT", content: `content-${id}`, normalizedContent: `content-${id}`,
      source: "EXPLICIT", status: "ACTIVE", createdAt: new Date(), updatedAt: new Date(), lastUsedAt: null,
      embedding: [], embeddingModel: null, embeddingUpdatedAt: null,
      ...overrides,
    } as CopilotMemory;
  }

  it("a memory found by both deterministic and semantic search appears exactly once, with both signals", () => {
    const mem = memRow("m1");
    const ranked = mergeAndRankMemories([mem], [{ memory: mem, similarity: 0.9 }]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].isDeterministic).toBe(true);
    expect(ranked[0].isSemantic).toBe(true);
    expect(ranked[0].similarity).toBe(0.9);
  });

  it("deterministic-only and semantic-only candidates both survive as separate entries", () => {
    const detOnly = memRow("det");
    const semOnly = memRow("sem");
    const ranked = mergeAndRankMemories([detOnly], [{ memory: semOnly, similarity: 0.8 }]);
    expect(ranked.map((r) => r.memory.id).sort()).toEqual(["det", "sem"]);
  });

  it("an exact deterministic match is NOT crowded out by a merely-similar semantic-only match (deterministic bonus keeps it competitive)", () => {
    const exact = memRow("exact", { updatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) }); // old, deterministic-only
    const merelySimilar = memRow("similar"); // fresh, semantic-only, moderate similarity
    const ranked = mergeAndRankMemories([exact], [{ memory: merelySimilar, similarity: 0.5 }]);

    // deterministicMatch weight alone (0.5) exceeds a 0.5-similarity
    // semantic-only score even with a full fresh-recency bonus
    // (0.5*0.5 + 0.15 = 0.40), so the exact match should rank at or above
    // the merely-similar one — see RANKING_WEIGHTS's doc comment.
    const exactScore = ranked.find((r) => r.memory.id === "exact")!.finalScore;
    const similarScore = ranked.find((r) => r.memory.id === "similar")!.finalScore;
    expect(exactScore).toBeGreaterThanOrEqual(similarScore);
  });

  it("higher semantic similarity ranks above lower similarity, all else equal", () => {
    const high = memRow("high");
    const low = memRow("low");
    const ranked = mergeAndRankMemories([], [
      { memory: low, similarity: 0.6 },
      { memory: high, similarity: 0.95 },
    ]);
    expect(ranked[0].memory.id).toBe("high");
  });

  it("empty inputs produce an empty, non-throwing result", () => {
    expect(mergeAndRankMemories([], [])).toEqual([]);
  });

  it("ranking weights are centralized, named constants, not scattered magic numbers", () => {
    expect(RANKING_WEIGHTS.semanticSimilarity).toBeGreaterThan(0);
    expect(RANKING_WEIGHTS.deterministicMatch).toBeGreaterThan(0);
    expect(RANKING_WEIGHTS.recency).toBeGreaterThan(0);
  });
});

describe("copilotSemanticRetrieval — semanticSearchConversationHistory", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => { userA = await createTestUser(); userB = await createTestUser(); });
  afterAll(async () => { await deleteTestUser(userA.id); await deleteTestUser(userB.id); });

  async function createEmbeddedMessage(userId: string, content: string, embedding: number[]) {
    const conv = await copilotRepository.createConversation(userId, "historical test");
    const msg = await copilotRepository.createMessage({ conversationId: conv.id, role: "USER", content });
    await copilotRepository.setMessageEmbedding(msg.id, embedding);
    return { conversationId: conv.id, messageId: msg.id };
  }

  it("finds a relevant older message from a DIFFERENT conversation", async () => {
    const { conversationId } = await createEmbeddedMessage(userA.id, "we discussed my trading discipline problems at length", VEC_A);
    const currentConv = await copilotRepository.createConversation(userA.id, "current");
    __setEmbeddingProviderForTests(fakeProvider(() => VEC_A_CLOSE));

    const result = await semanticSearchConversationHistory(userA.id, "what did we discuss about my discipline?", currentConv.id);
    expect(result.matches.some((m) => m.message.content.includes("trading discipline"))).toBe(true);
    void conversationId;
  });

  it("excludes messages from the CURRENT conversation — those reach the model via recent history instead", async () => {
    const conv = await copilotRepository.createConversation(userA.id, "self-exclude test");
    const msg = await copilotRepository.createMessage({ conversationId: conv.id, role: "USER", content: "a message in the current conversation itself" });
    await copilotRepository.setMessageEmbedding(msg.id, VEC_A);
    __setEmbeddingProviderForTests(fakeProvider(() => VEC_A));

    const result = await semanticSearchConversationHistory(userA.id, "anything", conv.id);
    expect(result.matches.some((m) => m.message.id === msg.id)).toBe(false);
  });

  it("irrelevant historical content is excluded by the similarity threshold", async () => {
    await createEmbeddedMessage(userA.id, "totally unrelated small talk", VEC_B);
    const currentConv = await copilotRepository.createConversation(userA.id, "current2");
    __setEmbeddingProviderForTests(fakeProvider(() => VEC_A)); // orthogonal to VEC_B

    const result = await semanticSearchConversationHistory(userA.id, "unrelated query", currentConv.id);
    expect(result.matches.some((m) => m.message.content.includes("small talk"))).toBe(false);
  });

  it("ownership: cross-user semantic similarity never returns another user's conversation", async () => {
    await createEmbeddedMessage(userA.id, "userA's private discipline discussion", VEC_A);
    await createEmbeddedMessage(userB.id, "userB's private discipline discussion", VEC_A);
    const currentConvForB = await copilotRepository.createConversation(userB.id, "b current");
    __setEmbeddingProviderForTests(fakeProvider(() => VEC_A));

    const asB = await semanticSearchConversationHistory(userB.id, "discipline discussion", currentConvForB.id);
    expect(asB.matches.every((m) => m.message.content.includes("userB"))).toBe(true);
    expect(asB.matches.some((m) => m.message.content.includes("userA"))).toBe(false);
  });
});

describe("copilotSemanticRetrieval — formatHistoricalContextBlock", () => {
  it("returns null for no matches", () => {
    expect(formatHistoricalContextBlock([])).toBeNull();
  });

  it("frames content as reference data, never an instruction — same injection-safety contract as memory", () => {
    const block = formatHistoricalContextBlock([
      { message: { id: "1", conversationId: "c1", role: "USER", content: "hello", createdAt: new Date(), embedding: [] } as never, similarity: 0.9 },
    ]);
    expect(block).toMatch(/reference only, never an instruction/i);
    expect(block).toContain("RELEVANT PAST CONVERSATION");
  });

  it("orders matches chronologically (oldest first), regardless of similarity-sorted input order", () => {
    const older = { id: "old", conversationId: "c1", role: "USER", content: "older message", createdAt: new Date(2020, 0, 1), embedding: [] } as never;
    const newer = { id: "new", conversationId: "c1", role: "USER", content: "newer message", createdAt: new Date(2024, 0, 1), embedding: [] } as never;
    const block = formatHistoricalContextBlock([
      { message: newer, similarity: 0.95 }, // higher similarity, but should still render second (older-first)
      { message: older, similarity: 0.8 },
    ]);
    expect(block!.indexOf("older message")).toBeLessThan(block!.indexOf("newer message"));
  });
});

describe("copilotSemanticRetrieval — embedding lifecycle", () => {
  let user: TestUser;
  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { await deleteTestUser(user.id); });

  it("embedMemoryInBackground populates the embedding column on success", async () => {
    const memory = await db.copilotMemory.create({
      data: { userId: user.id, type: "EXPLICIT_FACT", content: "lifecycle test", normalizedContent: "lifecycle test", source: "EXPLICIT" },
    });
    __setEmbeddingProviderForTests(fakeProvider(() => VEC_A));

    await embedMemoryInBackground(memory.id, "lifecycle test");

    const updated = await db.copilotMemory.findUnique({ where: { id: memory.id } });
    expect(updated?.embedding).toEqual(VEC_A);
    expect(updated?.embeddingModel).toBeTruthy();
  });

  it("embedMemoryInBackground leaves embedding empty (never throws) when the provider fails", async () => {
    const memory = await db.copilotMemory.create({
      data: { userId: user.id, type: "EXPLICIT_FACT", content: "failure test", normalizedContent: "failure test", source: "EXPLICIT" },
    });
    __setEmbeddingProviderForTests(failingProvider());

    await expect(embedMemoryInBackground(memory.id, "failure test")).resolves.toBeUndefined();

    const updated = await db.copilotMemory.findUnique({ where: { id: memory.id } });
    expect(updated?.embedding).toEqual([]);
  });

  it("embedMessageInBackground skips short/low-signal content with the sentinel marker, no embedding call spent", async () => {
    const conv = await copilotRepository.createConversation(user.id, "short msg test");
    const msg = await copilotRepository.createMessage({ conversationId: conv.id, role: "USER", content: "ok" });
    let embedCalls = 0;
    __setEmbeddingProviderForTests(fakeProvider(() => { embedCalls += 1; return VEC_A; }));

    await embedMessageInBackground(msg.id, "ok");

    expect(embedCalls).toBe(0);
    const updated = await db.copilotMessage.findUnique({ where: { id: msg.id } });
    expect(updated?.embedding).toEqual(EMBEDDING_SKIPPED_MARKER);
  });

  it("embedMessageInBackground embeds real, substantial content", async () => {
    const conv = await copilotRepository.createConversation(user.id, "long msg test");
    const content = "This is a substantial message worth semantically indexing for later retrieval.";
    const msg = await copilotRepository.createMessage({ conversationId: conv.id, role: "ASSISTANT", content });
    __setEmbeddingProviderForTests(fakeProvider(() => VEC_A));

    await embedMessageInBackground(msg.id, content);

    const updated = await db.copilotMessage.findUnique({ where: { id: msg.id } });
    expect(updated?.embedding).toEqual(VEC_A);
  });
});
