import { describe, it, expect, afterEach } from "vitest";
import { backfillMemoryEmbeddings, backfillMessageEmbeddings } from "./copilotMemoryBackfill";
import { __setEmbeddingProviderForTests, type EmbeddingProvider } from "./copilotEmbeddingProvider";
import { copilotRepository } from "../repositories/copilotRepository";
import db from "../../lib/prisma";
import { createTestUser, deleteTestUser, type TestUser } from "../../test/helpers";

afterEach(() => {
  __setEmbeddingProviderForTests(null);
});

function fakeProvider(vector: number[]): EmbeddingProvider {
  return { async embed() { return vector; } };
}
function failingProvider(): EmbeddingProvider {
  return { async embed(): Promise<number[]> { throw new Error("simulated failure"); } };
}

describe("copilotMemoryBackfill — memories", () => {
  it("embeds ACTIVE memories that have no embedding yet", async () => {
    const user = await createTestUser();
    try {
      const memory = await db.copilotMemory.create({
        data: { userId: user.id, type: "EXPLICIT_FACT", content: "needs a real embedding", normalizedContent: "needs a real embedding", source: "EXPLICIT" },
      });
      __setEmbeddingProviderForTests(fakeProvider([1, 2, 3]));

      const result = await backfillMemoryEmbeddings(50);
      expect(result.processed).toBeGreaterThanOrEqual(1);

      const updated = await db.copilotMemory.findUnique({ where: { id: memory.id } });
      expect(updated?.embedding).toEqual([1, 2, 3]);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  it("never touches SUPERSEDED or DELETED memories", async () => {
    const user = await createTestUser();
    try {
      const superseded = await db.copilotMemory.create({
        data: { userId: user.id, type: "EXPLICIT_FACT", content: "old", normalizedContent: "old", source: "EXPLICIT", status: "SUPERSEDED" },
      });
      const deleted = await db.copilotMemory.create({
        data: { userId: user.id, type: "EXPLICIT_FACT", content: "gone", normalizedContent: "gone", source: "EXPLICIT", status: "DELETED" },
      });
      __setEmbeddingProviderForTests(fakeProvider([9, 9, 9]));

      await backfillMemoryEmbeddings(50);

      const stillSuperseded = await db.copilotMemory.findUnique({ where: { id: superseded.id } });
      const stillDeleted = await db.copilotMemory.findUnique({ where: { id: deleted.id } });
      expect(stillSuperseded?.embedding).toEqual([]);
      expect(stillDeleted?.embedding).toEqual([]);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  it("is idempotent — rerunning after success finds nothing left for that row", async () => {
    const user = await createTestUser();
    try {
      const memory = await db.copilotMemory.create({
        data: { userId: user.id, type: "EXPLICIT_FACT", content: "idempotent test", normalizedContent: "idempotent test", source: "EXPLICIT" },
      });
      __setEmbeddingProviderForTests(fakeProvider([1, 1, 1]));
      await backfillMemoryEmbeddings(50);

      // A second run must not re-select (or re-call the provider for) the
      // now-embedded row — assert by using a provider that would produce a
      // DIFFERENT vector if it were called again, then checking nothing changed.
      __setEmbeddingProviderForTests(fakeProvider([2, 2, 2]));
      await backfillMemoryEmbeddings(50);

      const updated = await db.copilotMemory.findUnique({ where: { id: memory.id } });
      expect(updated?.embedding).toEqual([1, 1, 1]); // unchanged — never re-embedded
    } finally {
      await deleteTestUser(user.id);
    }
  });

  it("a provider failure leaves the row eligible for a future run, reported as failed not silently dropped", async () => {
    const user = await createTestUser();
    try {
      await db.copilotMemory.create({
        data: { userId: user.id, type: "EXPLICIT_FACT", content: "will fail this run", normalizedContent: "will fail this run", source: "EXPLICIT" },
      });
      __setEmbeddingProviderForTests(failingProvider());

      const result = await backfillMemoryEmbeddings(50);
      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(result.succeeded).toBe(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  it("is bounded — never processes more than batchSize rows in one call", async () => {
    const user = await createTestUser();
    try {
      for (let i = 0; i < 5; i++) {
        await db.copilotMemory.create({
          data: { userId: user.id, type: "EXPLICIT_FACT", content: `bound test ${i}`, normalizedContent: `bound test ${i}`, source: "EXPLICIT" },
        });
      }
      __setEmbeddingProviderForTests(fakeProvider([1]));

      const result = await backfillMemoryEmbeddings(2);
      expect(result.processed).toBeLessThanOrEqual(2);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describe("copilotMemoryBackfill — messages", () => {
  let user: TestUser;

  it("embeds messages with no embedding, and correctly marks a too-short one as skipped (not failed)", async () => {
    user = await createTestUser();
    try {
      const conv = await copilotRepository.createConversation(user.id, "backfill test");
      const long = await copilotRepository.createMessage({ conversationId: conv.id, role: "USER", content: "a message long enough to be worth embedding for real" });
      const short = await copilotRepository.createMessage({ conversationId: conv.id, role: "USER", content: "ok" });

      __setEmbeddingProviderForTests(fakeProvider([4, 5, 6]));
      const result = await backfillMessageEmbeddings(50);

      expect(result.failed).toBe(0); // the short one "succeeds" via the deliberate skip marker, not a failure
      const longUpdated = await db.copilotMessage.findUnique({ where: { id: long.id } });
      const shortUpdated = await db.copilotMessage.findUnique({ where: { id: short.id } });
      expect(longUpdated?.embedding).toEqual([4, 5, 6]);
      expect(shortUpdated?.embedding).toEqual([0]); // EMBEDDING_SKIPPED_MARKER
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
