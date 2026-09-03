/**
 * Phase 4 capability-expansion tests: new/extended read tools, schema
 * validation, cross-user security, and multi-tool agent composition.
 * Registers tools via copilotAgentService's module-level
 * registerAllCopilotTools() side effect, same as every other Copilot test
 * file — importing runAgent is enough to populate the registry.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTool } from "./copilotToolRegistry";
import { runAgent } from "./copilotAgentService";
import { __setAIProviderForTests, type AIProvider, type AICompletionResult } from "./copilotAiProvider";
import db from "../../lib/prisma";
import { createTestUser, deleteTestUser, type TestUser } from "../../test/helpers";

function toolCallResponse(name: string, args: object): AICompletionResult {
  return { content: null, toolCalls: [{ id: "call_1", name, arguments: JSON.stringify(args) }], tokensUsed: 10, model: "test-model" };
}
function finalResponse(content: string): AICompletionResult {
  return { content, toolCalls: [], tokensUsed: 5, model: "test-model" };
}
function scriptedProvider(responses: AICompletionResult[]): AIProvider {
  let i = 0;
  return { async complete() { const r = responses[Math.min(i, responses.length - 1)]; i += 1; return r; } };
}

async function createClosedTrade(userId: string, overrides: Partial<{
  symbol: string; side: "BUY" | "SELL"; netPnl: number; result: "WIN" | "LOSS" | "BREAKEVEN"; closedAt: Date;
}> = {}) {
  return db.trade.create({
    data: {
      userId,
      symbol:      overrides.symbol ?? "XAUUSD",
      displayName: "Gold",
      category:    "commodities",
      side:        overrides.side ?? "BUY",
      lotSize:     1,
      entryPrice:  100,
      exitPrice:   overrides.result === "LOSS" ? 90 : 110,
      grossPnl:    overrides.netPnl ?? 10,
      netPnl:      overrides.netPnl ?? 10,
      commission:  0,
      result:      overrides.result ?? "WIN",
      isOpen:      false,
      openedAt:    new Date(Date.now() - 60_000),
      closedAt:    overrides.closedAt ?? new Date(),
    },
  });
}

async function createJournalEntryWithStrategy(userId: string, strategy: string, netPnl: number, result: "WIN" | "LOSS") {
  return db.journalEntry.create({
    data: {
      userId, symbol: "XAUUSD", displayName: "Gold", side: "BUY", lotSize: 1, entryPrice: 100,
      strategy, netPnl, result, closedAt: new Date(),
    },
  });
}

describe("Phase 4 — tool schema validation", () => {
  it("get_trade requires a non-empty tradeId", () => {
    const tool = getTool("get_trade")!;
    expect(tool.parameters.safeParse({}).success).toBe(false);
    expect(tool.parameters.safeParse({ tradeId: "" }).success).toBe(false);
    expect(tool.parameters.safeParse({ tradeId: "abc123" }).success).toBe(true);
  });

  it("get_trades rejects an out-of-range limit and an invalid result enum", () => {
    const tool = getTool("get_trades")!;
    expect(tool.parameters.safeParse({ limit: 51 }).success).toBe(false);
    expect(tool.parameters.safeParse({ limit: 0 }).success).toBe(false);
    expect(tool.parameters.safeParse({ result: "MAYBE" }).success).toBe(false);
    expect(tool.parameters.safeParse({ result: "LOSS", side: "BUY", limit: 10 }).success).toBe(true);
  });

  it("get_journal_entries rejects an invalid result enum and accepts the new filters", () => {
    const tool = getTool("get_journal_entries")!;
    expect(tool.parameters.safeParse({ result: "PROFIT" }).success).toBe(false);
    expect(tool.parameters.safeParse({ result: "LOSS", emotion: "fearful", tradeId: "t1" }).success).toBe(true);
  });

  it("get_notifications caps limit at 20 and defaults unreadOnly to false", () => {
    const tool = getTool("get_notifications")!;
    expect(tool.parameters.safeParse({ limit: 21 }).success).toBe(false);
    const parsed = tool.parameters.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ limit: 10, unreadOnly: false });
  });

  it("get_academy_progress and get_account_state take no arguments", () => {
    expect(getTool("get_academy_progress")!.parameters.safeParse({}).success).toBe(true);
    expect(getTool("get_account_state")!.parameters.safeParse({}).success).toBe(true);
  });

  it("get_instrument_performance and get_strategy_performance accept an optional date range", () => {
    expect(getTool("get_instrument_performance")!.parameters.safeParse({ from: new Date().toISOString() }).success).toBe(true);
    expect(getTool("get_strategy_performance")!.parameters.safeParse({}).success).toBe(true);
    expect(getTool("get_strategy_performance")!.parameters.safeParse({ from: "not-a-date" }).success).toBe(false);
  });

  // Regression test for a real failure discovered during Phase 4 live
  // verification: Groq validates the model's own generated tool-call
  // arguments against our JSON Schema before the completion ever reaches
  // this code, and gpt-oss-20b generates `null` (not an omitted key) for
  // arguments it wants to skip — e.g. {"from": null, "to": null} for
  // get_strategy_performance. A plain `{type: "string"}` schema (and the
  // matching Zod `.optional()`) rejects that, so every optional argument
  // across every tool must tolerate null exactly like it tolerates
  // "omitted" — see copilotTools/zodHelpers.ts.
  it("every optional argument tolerates an explicit null the same as omitting it entirely", () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["get_strategy_performance",    { from: null, to: null }],
      ["get_instrument_performance",  { from: null, to: null }],
      ["get_trading_analytics",       { from: null, to: null }],
      ["get_trades",                  { status: null, symbol: null, side: null, result: null, from: null, to: null, limit: null }],
      ["get_journal_entries",         { symbol: null, strategy: null, result: null, emotion: null, tradeId: null, from: null, to: null, limit: null }],
      ["get_notifications",           { limit: null, unreadOnly: null }],
      ["add_watchlist_item",          { symbol: "X", displayName: "X", category: "X", emoji: null }],
    ];

    for (const [toolName, args] of cases) {
      const tool = getTool(toolName)!;
      const parsed = tool.parameters.safeParse(args);
      expect(parsed.success, `${toolName} should accept ${JSON.stringify(args)}`).toBe(true);
    }
  });

  it("the JSON schema sent to the provider allows null for every optional property, matching the Zod side", () => {
    const toolsWithOptionalArgs = [
      "get_trades", "get_journal_entries", "get_trading_analytics",
      "get_instrument_performance", "get_strategy_performance",
      "get_notifications", "add_watchlist_item",
    ];
    for (const name of toolsWithOptionalArgs) {
      const tool = getTool(name)!;
      const required = new Set((tool.jsonSchema as { required?: string[] }).required ?? []);
      const properties = (tool.jsonSchema as { properties: Record<string, { type: string | string[] }> }).properties;
      for (const [propName, prop] of Object.entries(properties)) {
        if (required.has(propName)) continue; // required args are allowed to reject null
        const types = Array.isArray(prop.type) ? prop.type : [prop.type];
        expect(types, `${name}.${propName} should allow null`).toContain("null");
      }
    }
  });
});

describe("Phase 4 — cross-user security", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => { userA = await createTestUser(); userB = await createTestUser(); });
  afterAll(async () => { await deleteTestUser(userA.id); await deleteTestUser(userB.id); });

  it("get_trade cannot retrieve another user's trade by guessing its id", async () => {
    const trade = await createClosedTrade(userA.id);
    const tool = getTool("get_trade")!;

    await expect(tool.execute({ tradeId: trade.id }, { userId: userB.id }))
      .rejects.toThrow(/no trade found/i);

    // Confirms the rejection above is really about ownership, not a broken lookup.
    await expect(tool.execute({ tradeId: trade.id }, { userId: userA.id })).resolves.toMatchObject({ id: trade.id });
  });

  it("get_trades never returns another user's trades", async () => {
    await createClosedTrade(userA.id, { symbol: "ONLYUSERA" });
    const tool = getTool("get_trades")!;

    const asB = await tool.execute({ status: "closed", limit: 50 }, { userId: userB.id }) as { closed: Array<{ symbol: string }> };
    expect(asB.closed.some((t) => t.symbol === "ONLYUSERA")).toBe(false);
  });

  it("get_account_state, get_academy_progress, get_notifications are all scoped to ctx.userId, never a model-supplied id", async () => {
    // None of these tools even accept an id argument — this is the
    // structural guarantee (see copilotToolRegistry.registerTool, which
    // refuses to register a tool whose schema declares userId at all).
    for (const name of ["get_account_state", "get_academy_progress", "get_notifications"]) {
      const tool = getTool(name)!;
      const shape = (tool.parameters as unknown as { shape?: Record<string, unknown> }).shape ?? {};
      expect(Object.keys(shape)).not.toContain("userId");
    }
  });
});

describe("Phase 4 — real-data tool behavior", () => {
  let user: TestUser;
  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { await deleteTestUser(user.id); });

  it("get_trades filters by result (win/loss)", async () => {
    await createClosedTrade(user.id, { symbol: "FILTERTEST", result: "LOSS", netPnl: -20 });
    await createClosedTrade(user.id, { symbol: "FILTERTEST", result: "WIN", netPnl: 30 });

    const tool = getTool("get_trades")!;
    const result = await tool.execute({ status: "closed", symbol: "FILTERTEST", result: "LOSS", limit: 50 }, { userId: user.id }) as { closed: Array<{ result: string }> };

    expect(result.closed.length).toBeGreaterThan(0);
    expect(result.closed.every((t) => t.result === "LOSS")).toBe(true);
  });

  it("get_instrument_performance groups by symbol using real analyticsService data", async () => {
    await createClosedTrade(user.id, { symbol: "INSTRTEST", result: "WIN", netPnl: 50 });

    const tool = getTool("get_instrument_performance")!;
    const result = await tool.execute({}, { userId: user.id }) as { instruments: Array<{ symbol: string; netPnl: number }> };

    const row = result.instruments.find((i) => i.symbol === "INSTRTEST");
    expect(row).toBeDefined();
    expect(row!.netPnl).toBeGreaterThanOrEqual(50);
  });

  it("get_strategy_performance groups journal entries by strategy tag, worst first when sorted", async () => {
    const tag = `strat-${Date.now()}`;
    await createJournalEntryWithStrategy(user.id, tag, -40, "LOSS");
    await createJournalEntryWithStrategy(user.id, tag, -10, "LOSS");

    const tool = getTool("get_strategy_performance")!;
    const result = await tool.execute({}, { userId: user.id }) as { strategies: Array<{ strategy: string; netPnl: number; trades: number }> };

    const row = result.strategies.find((s) => s.strategy === tag);
    expect(row).toBeDefined();
    expect(row!.trades).toBe(2);
    expect(row!.netPnl).toBeCloseTo(-50, 5);
  });

  it("get_account_state returns real balance/equity from tradeService", async () => {
    const tool = getTool("get_account_state")!;
    const result = await tool.execute({}, { userId: user.id }) as { balance: number; equity: number };
    expect(typeof result.balance).toBe("number");
    expect(typeof result.equity).toBe("number");
  });

  it("get_journal_entries filters by tradeId", async () => {
    const trade = await createClosedTrade(user.id, { symbol: "JOURNALTRADE" });
    const entry = await db.journalEntry.create({
      data: {
        userId: user.id, tradeId: trade.id, symbol: "JOURNALTRADE", displayName: "x",
        side: "BUY", lotSize: 1, entryPrice: 100, netPnl: 5, result: "WIN", closedAt: new Date(),
      },
    });

    const tool = getTool("get_journal_entries")!;
    const result = await tool.execute({ tradeId: trade.id, limit: 10 }, { userId: user.id }) as { entries: Array<{ id: string }> };
    expect(result.entries.map((e) => e.id)).toContain(entry.id);
  });

  it("get_academy_progress returns an empty list rather than erroring when nothing is enrolled", async () => {
    const tool = getTool("get_academy_progress")!;
    const result = await tool.execute({}, { userId: user.id }) as { courses: unknown[] };
    expect(Array.isArray(result.courses)).toBe(true);
  });

  it("get_notifications returns an empty list rather than erroring when there are none", async () => {
    const tool = getTool("get_notifications")!;
    // Calling execute() directly (bypassing the agent loop) means Zod's
    // .default() values never get applied — unlike production, where
    // tool.parameters.safeParse() always runs first. Pass explicit values.
    const result = await tool.execute({ limit: 10, unreadOnly: false }, { userId: user.id }) as { total: number; notifications: unknown[] };
    expect(result.total).toBe(0);
    expect(result.notifications).toEqual([]);
  });
});

describe("Phase 4 — agent composition (multi-tool reasoning)", () => {
  let user: TestUser;
  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { __setAIProviderForTests(null); await deleteTestUser(user.id); });

  it("composes get_trades + get_trading_analytics for a 'why did I lose money' style question", async () => {
    await createClosedTrade(user.id, { symbol: "COMPOSEA", result: "LOSS", netPnl: -30 });

    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("get_trades", { status: "closed", result: "LOSS" }),
      toolCallResponse("get_trading_analytics", {}),
      finalResponse("You lost money mainly on COMPOSEA."),
    ]));

    const result = await runAgent({ userId: user.id, systemPrompt: "sys", history: [], userMessage: "why did I lose money?" });

    expect(result.steps.map((s) => s.toolName)).toEqual(["get_trades", "get_trading_analytics"]);
    expect(result.steps.every((s) => s.status === "EXECUTED")).toBe(true);
    expect(result.finalMessage).toMatch(/COMPOSEA/);
  });

  it("composes get_trade + get_journal_entries for a 'why was this trade bad' style question", async () => {
    const trade = await createClosedTrade(user.id, { symbol: "COMPOSEB", result: "LOSS", netPnl: -15 });

    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("get_trade", { tradeId: trade.id }),
      toolCallResponse("get_journal_entries", { tradeId: trade.id }),
      finalResponse("This trade lost because of poor entry timing."),
    ]));

    const result = await runAgent({ userId: user.id, systemPrompt: "sys", history: [], userMessage: `why was trade ${trade.id} bad?` });

    expect(result.steps.map((s) => s.toolName)).toEqual(["get_trade", "get_journal_entries"]);
    expect(result.steps[0].output).toMatchObject({ id: trade.id });
  });

  it("composes get_strategy_performance + get_trades for a 'worst strategy' style question", async () => {
    const tag = `worst-${Date.now()}`;
    await createJournalEntryWithStrategy(user.id, tag, -25, "LOSS");

    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("get_strategy_performance", {}),
      toolCallResponse("get_trades", { status: "closed", limit: 10 }),
      finalResponse(`Your worst strategy is ${tag}.`),
    ]));

    const result = await runAgent({ userId: user.id, systemPrompt: "sys", history: [], userMessage: "what's my worst strategy?" });

    expect(result.steps.map((s) => s.toolName)).toEqual(["get_strategy_performance", "get_trades"]);
    expect(result.finalMessage).toContain(tag);
  });

  it("composes two get_trading_analytics calls (different date ranges) for a period comparison — no dedicated comparison tool exists or is needed", async () => {
    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("get_trading_analytics", { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T23:59:59.999Z" }),
      toolCallResponse("get_trading_analytics", { from: "2026-07-01T00:00:00.000Z", to: "2026-07-31T23:59:59.999Z" }),
      finalResponse("This month vs last month comparison: ..."),
    ]));

    const result = await runAgent({ userId: user.id, systemPrompt: "sys", history: [], userMessage: "compare this month to last month" });

    expect(result.steps).toHaveLength(2);
    expect(result.steps.every((s) => s.toolName === "get_trading_analytics")).toBe(true);
    // Two distinct date ranges were actually requested — not the same call twice.
    expect(result.steps[0].input).not.toEqual(result.steps[1].input);
  });

  it("data minimization: a narrow watchlist question triggers only the watchlist tool, nothing else", async () => {
    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("get_watchlist", {}),
      finalResponse("Your watchlist is empty."),
    ]));

    const result = await runAgent({ userId: user.id, systemPrompt: "sys", history: [], userMessage: "what's on my watchlist?" });

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].toolName).toBe("get_watchlist");
  });
});
