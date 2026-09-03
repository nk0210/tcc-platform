import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chat, getConversation, ConversationNotFoundError } from "./copilotService";
import { __setAIProviderForTests, type AIProvider, type AICompletionRequest } from "./copilotAiProvider";
import { watchlistService } from "./watchlistService";
import { createExplicitMemory } from "./copilotMemoryService";
import db from "../../lib/prisma";
import { createTestUser, deleteTestUser, type TestUser } from "../../test/helpers";

const staticProvider: AIProvider = {
  async complete() {
    return { content: "This is a test response.", toolCalls: [], tokensUsed: 42, model: "test-model" };
  },
};

describe("copilotService — conversation ownership and persistence", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    __setAIProviderForTests(staticProvider);
  });

  afterAll(async () => {
    __setAIProviderForTests(null);
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it("creates a new conversation and persists the user + assistant messages", async () => {
    const result = await chat(userA.id, null, "Hello Copilot");

    expect(result.conversationId).toBeTruthy();
    expect(result.message).toBe("This is a test response.");
    expect(result.tokensUsed).toBe(42);

    const { conversation, messages } = await getConversation(result.conversationId, userA.id);
    expect(conversation.id).toBe(result.conversationId);
    // Successfully fetching it at all already proves ownership — a
    // cross-user fetch throws ConversationNotFoundError (tested below).
    expect(conversation.title).toBe("Hello Copilot"); // derived from the first user message
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "USER", content: "Hello Copilot" });
    expect(messages[1]).toMatchObject({ role: "ASSISTANT", content: "This is a test response." });
  });

  it("a user cannot continue another user's conversation", async () => {
    const { conversationId } = await chat(userA.id, null, "A private message");

    await expect(chat(userB.id, conversationId, "trying to hijack this thread"))
      .rejects.toBeInstanceOf(ConversationNotFoundError);
  });

  it("a user cannot fetch another user's conversation via getConversation", async () => {
    const { conversationId } = await chat(userA.id, null, "another private message");

    await expect(getConversation(conversationId, userB.id))
      .rejects.toBeInstanceOf(ConversationNotFoundError);

    // The owner can still fetch it — proves the rejection above is really
    // about ownership, not a broken lookup.
    await expect(getConversation(conversationId, userA.id)).resolves.toBeDefined();
  });

  it("throws ConversationNotFoundError for a conversation id that doesn't exist at all", async () => {
    await expect(chat(userA.id, "nonexistent-conversation-id", "hi"))
      .rejects.toBeInstanceOf(ConversationNotFoundError);
  });
});

describe("copilotService — UI context (Phase 4)", () => {
  let userA: TestUser;
  let userB: TestUser;
  let capturedRequest: AICompletionRequest | null;

  function capturingProvider(): AIProvider {
    return {
      async complete(request) {
        capturedRequest = request;
        return { content: "ok", toolCalls: [], tokensUsed: 1, model: "test-model" };
      },
    };
  }

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
  });

  afterAll(async () => {
    __setAIProviderForTests(null);
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it("includes currentModule/currentPage in the system prompt as a hint", async () => {
    capturedRequest = null;
    __setAIProviderForTests(capturingProvider());

    await chat(userA.id, null, "hi", { currentModule: "trading", currentPage: "analytics" });

    expect(capturedRequest!.systemPrompt).toMatch(/UI CONTEXT/);
    expect(capturedRequest!.systemPrompt).toMatch(/trading \/ analytics/);
  });

  it("includes a verified selectedEntity trade the user actually owns", async () => {
    const trade = await db.trade.create({
      data: { userId: userA.id, symbol: "CTXTRADE", displayName: "x", side: "BUY", lotSize: 1, entryPrice: 100 },
    });

    capturedRequest = null;
    __setAIProviderForTests(capturingProvider());
    await chat(userA.id, null, "why did I lose this?", { selectedEntity: { type: "trade", id: trade.id } });

    expect(capturedRequest!.systemPrompt).toContain(trade.id);
    expect(capturedRequest!.systemPrompt).toContain("CTXTRADE");
  });

  it("silently drops a selectedEntity trade id that belongs to another user — never trusted, never mentioned to the model", async () => {
    const foreignTrade = await db.trade.create({
      data: { userId: userB.id, symbol: "NOTUSERAS", displayName: "x", side: "BUY", lotSize: 1, entryPrice: 100 },
    });

    capturedRequest = null;
    __setAIProviderForTests(capturingProvider());
    await chat(userA.id, null, "why did I lose this?", { selectedEntity: { type: "trade", id: foreignTrade.id } });

    expect(capturedRequest!.systemPrompt).not.toContain(foreignTrade.id);
    expect(capturedRequest!.systemPrompt).not.toContain("NOTUSERAS");
  });

  it("omits the UI CONTEXT block entirely when no context is supplied", async () => {
    capturedRequest = null;
    __setAIProviderForTests(capturingProvider());
    await chat(userA.id, null, "hi");

    expect(capturedRequest!.systemPrompt).not.toMatch(/UI CONTEXT/);
  });
});

describe("copilotService — Phase 8: context orchestration, data minimization", () => {
  let user: TestUser;
  let capturedRequest: AICompletionRequest | null;

  function capturingProvider(): AIProvider {
    return {
      async complete(request) {
        capturedRequest = request;
        return { content: "ok", toolCalls: [], tokensUsed: 1, model: "test-model" };
      },
    };
  }

  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { __setAIProviderForTests(null); await deleteTestUser(user.id); });

  it("an unrelated request never leaks watchlist contents into the system prompt — the model must use get_watchlist", async () => {
    await watchlistService.addSymbol(user.id, { symbol: "NOTINPROMPT", displayName: "Should Not Leak", category: "Forex" });

    capturedRequest = null;
    __setAIProviderForTests(capturingProvider());
    await chat(user.id, null, "What's my risk score?");

    expect(capturedRequest!.systemPrompt).not.toContain("NOTINPROMPT");
  });

  it("bounds the memory block reaching the provider even with far more saved memories than the retrieval cap", async () => {
    const busy = await createTestUser();
    try {
      for (let i = 0; i < 20; i++) {
        await createExplicitMemory(busy.id, `I am fact number ${i} about myself, distinctmarker${i}`);
      }

      capturedRequest = null;
      __setAIProviderForTests(capturingProvider());
      await chat(busy.id, null, "tell me about my trading");

      const injectedFacts = capturedRequest!.systemPrompt.match(/distinctmarker\d+/g) ?? [];
      expect(injectedFacts.length).toBeLessThanOrEqual(8);
    } finally {
      await deleteTestUser(busy.id);
    }
  });

  it("a provider failure still returns the existing graceful fallback — context assembly doesn't change reliability behavior", async () => {
    __setAIProviderForTests({
      async complete() { throw new Error("simulated provider outage"); },
    });

    const result = await chat(user.id, null, "how am I doing?");
    expect(result.message).toMatch(/temporarily busy/i);
    expect(result.conversationId).toBeTruthy();
  });

  it("memory that duplicates something already said this conversation is not redundantly repeated", async () => {
    const fresh = await createTestUser();
    try {
      __setAIProviderForTests(staticProvider);
      const first = await chat(fresh.id, null, "By the way, I prefer concise answers, just so you know.");
      await createExplicitMemory(fresh.id, "I prefer concise answers");

      capturedRequest = null;
      __setAIProviderForTests(capturingProvider());
      await chat(fresh.id, first.conversationId, "how's my performance?");

      // The MEMORY: section's fixed instructional text always mentions
      // "USER MEMORY / CONTEXT" by name, regardless of whether anything
      // was actually injected — so the real signal is the bullet-rendered
      // memory content itself (see formatMemoryContextBlock()), not that
      // phrase.
      expect(capturedRequest!.systemPrompt).not.toContain("- I prefer concise answers");
    } finally {
      await deleteTestUser(fresh.id);
    }
  });
});
