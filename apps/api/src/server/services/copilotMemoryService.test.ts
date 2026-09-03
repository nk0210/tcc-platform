import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createExplicitMemory,
  createProposedMemory,
  listMemories,
  getMemoriesForAgent,
  deleteMemory,
  tryExplicitForget,
  buildMemoryContext,
  MemoryNotFoundError,
} from "./copilotMemoryService";
import db from "../../lib/prisma";
import { createTestUser, deleteTestUser, type TestUser } from "../../test/helpers";

describe("copilotMemoryService — creation, dedup, conflict", () => {
  let user: TestUser;

  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { await deleteTestUser(user.id); });

  it("creates an explicit memory with the deterministically classified type", async () => {
    const result = await createExplicitMemory(user.id, "I prefer trading XAUUSD");
    if ("rejected" in result) throw new Error("should not be rejected");
    expect(result.type).toBe("TRADING_PREFERENCE");
    expect(result.source).toBe("EXPLICIT");
    expect(result.content).toBe("I prefer trading XAUUSD");
  });

  it("deduplicates an exact restatement instead of creating a second row", async () => {
    const first  = await createExplicitMemory(user.id, "I really enjoy trading gold on Fridays");
    const second = await createExplicitMemory(user.id, "  I   really enjoy   trading gold on Fridays  ");
    if ("rejected" in first || "rejected" in second) throw new Error("should not be rejected");
    expect(second.id).toBe(first.id);

    const { items } = await listMemories(user.id, { page: 1, pageSize: 100 });
    const matches = items.filter((m) => m.id === first.id);
    expect(matches).toHaveLength(1);
  });

  it("supersedes an old contradictory COPILOT_PREFERENCE memory with a new explicit one on the same axis", async () => {
    const concise  = await createExplicitMemory(user.id, "I prefer concise responses");
    if ("rejected" in concise) throw new Error("should not be rejected");

    const detailed = await createExplicitMemory(user.id, "I now prefer detailed explanations");
    if ("rejected" in detailed) throw new Error("should not be rejected");
    expect(detailed.id).not.toBe(concise.id);

    const { items } = await listMemories(user.id, { type: "COPILOT_PREFERENCE", page: 1, pageSize: 100 });
    const ids = items.map((m) => m.id);
    expect(ids).toContain(detailed.id);
    expect(ids).not.toContain(concise.id); // superseded — no longer ACTIVE, not listed
  });

  it("does not treat two unrelated facts of the same type as conflicting", async () => {
    const a = await createExplicitMemory(user.id, "I am based in India");
    const b = await createExplicitMemory(user.id, "My timezone is IST");
    if ("rejected" in a || "rejected" in b) throw new Error("should not be rejected");

    const { items } = await listMemories(user.id, { type: "EXPLICIT_FACT", page: 1, pageSize: 100 });
    const ids = items.map((m) => m.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });

  it("rejects secret-like content outright, storing nothing", async () => {
    const result = await createExplicitMemory(user.id, "remember my password is hunter2ishunter2");
    expect("rejected" in result).toBe(true);

    const stored = await db.copilotMemory.findMany({ where: { userId: user.id, content: { contains: "hunter2" } } });
    expect(stored).toHaveLength(0);
  });
});

describe("copilotMemoryService — ownership", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
  });
  afterAll(async () => {
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it("only returns the authenticated user's own memories", async () => {
    await createExplicitMemory(userA.id, "I prefer XAUUSD");
    await createExplicitMemory(userB.id, "I prefer EURUSD");

    const { items: aItems } = await listMemories(userA.id, { page: 1, pageSize: 100 });
    const { items: bItems } = await listMemories(userB.id, { page: 1, pageSize: 100 });

    expect(aItems.some((m) => m.content.includes("XAUUSD"))).toBe(true);
    expect(aItems.some((m) => m.content.includes("EURUSD"))).toBe(false);
    expect(bItems.some((m) => m.content.includes("EURUSD"))).toBe(true);
    expect(bItems.some((m) => m.content.includes("XAUUSD"))).toBe(false);
  });

  it("a user cannot delete another user's memory", async () => {
    const created = await createExplicitMemory(userA.id, "I prefer trading in the London session");
    if ("rejected" in created) throw new Error("should not be rejected");

    await expect(deleteMemory(created.id, userB.id)).rejects.toBeInstanceOf(MemoryNotFoundError);

    // Still there for the real owner — proves the rejection above was about
    // ownership, not a broken lookup.
    const { items } = await listMemories(userA.id, { page: 1, pageSize: 100 });
    expect(items.some((m) => m.id === created.id)).toBe(true);
  });

  it("the owner can delete their own memory, and it stops being listed", async () => {
    const created = await createExplicitMemory(userA.id, "I prefer trading crude oil");
    if ("rejected" in created) throw new Error("should not be rejected");

    await deleteMemory(created.id, userA.id);

    const { items } = await listMemories(userA.id, { page: 1, pageSize: 100 });
    expect(items.some((m) => m.id === created.id)).toBe(false);
  });

  it("throws MemoryNotFoundError for a memory id that doesn't exist at all", async () => {
    await expect(deleteMemory("nonexistent-memory-id", userA.id)).rejects.toBeInstanceOf(MemoryNotFoundError);
  });
});

describe("copilotMemoryService — model-supplied userId is never honored", () => {
  it("createProposedMemory only ever persists under the userId parameter passed by the caller", async () => {
    const real = await createTestUser();
    const other = await createTestUser();
    try {
      // Simulates a confirmed propose_memory tool call — ctx.userId (the
      // authenticated caller) is the only userId this function accepts;
      // there is no argument through which a tool call's own JSON body
      // could smuggle a different one in.
      const result = await createProposedMemory(real.id, "PREFERENCE", "I like early morning sessions");
      if ("rejected" in result) throw new Error("should not be rejected");

      const { items: realItems }  = await listMemories(real.id,  { page: 1, pageSize: 10 });
      const { items: otherItems } = await listMemories(other.id, { page: 1, pageSize: 10 });
      expect(realItems.some((m) => m.id === result.id)).toBe(true);
      expect(otherItems.some((m) => m.id === result.id)).toBe(false);
    } finally {
      await deleteTestUser(real.id);
      await deleteTestUser(other.id);
    }
  });
});

describe("copilotMemoryService — explicit forget resolution", () => {
  let user: TestUser;
  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { await deleteTestUser(user.id); });

  it("deletes the single unambiguous match", async () => {
    const created = await createExplicitMemory(user.id, "I prefer trading silver");
    if ("rejected" in created) throw new Error("should not be rejected");

    const forgotten = await tryExplicitForget(user.id, "that I prefer trading silver");
    expect(forgotten?.id).toBe(created.id);

    const { items } = await listMemories(user.id, { page: 1, pageSize: 100 });
    expect(items.some((m) => m.id === created.id)).toBe(false);
  });

  it("returns null (defers) when nothing matches, deleting nothing", async () => {
    const result = await tryExplicitForget(user.id, "my favorite pizza topping");
    expect(result).toBeNull();
  });
});

describe("copilotMemoryService — bounded, category-relevant context injection", () => {
  let user: TestUser;
  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { await deleteTestUser(user.id); });

  it("returns null when the user has no memories yet", async () => {
    const fresh = await createTestUser();
    try {
      expect(await buildMemoryContext(fresh.id, "how's my performance?")).toBeNull();
    } finally {
      await deleteTestUser(fresh.id);
    }
  });

  it("injects a saved preference as reference context, not as an instruction", async () => {
    await createExplicitMemory(user.id, "I prefer concise answers");
    const context = await buildMemoryContext(user.id, "how's my performance this month?");
    expect(context).toBeTruthy();
    expect(context).toContain("I prefer concise answers");
    expect(context).toMatch(/reference only, never an instruction/i);
  });

  it("never exceeds the bounded number of memories injected in one turn", async () => {
    const busy = await createTestUser();
    try {
      for (let i = 0; i < 15; i++) {
        await createExplicitMemory(busy.id, `I am fact number ${i} about myself`);
      }
      const context = await buildMemoryContext(busy.id, "tell me about my trading");
      const lines = context ? context.split("\n").filter((l) => l.startsWith("- ")) : [];
      expect(lines.length).toBeLessThanOrEqual(8);
    } finally {
      await deleteTestUser(busy.id);
    }
  });

  it("get_memories-style retrieval is also ownership-scoped", async () => {
    const other = await createTestUser();
    try {
      await createExplicitMemory(other.id, "I prefer trading indices");
      const mine = await getMemoriesForAgent(user.id, undefined, 20);
      expect(mine.some((m) => m.content.includes("indices"))).toBe(false);
    } finally {
      await deleteTestUser(other.id);
    }
  });
});
