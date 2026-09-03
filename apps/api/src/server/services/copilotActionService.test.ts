import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chat, type ChatResult } from "./copilotService";
import {
  confirmAction,
  cancelAction,
  PendingActionNotFoundError,
  PendingActionNotAvailableError,
} from "./copilotActionService";
import { MAX_AGENT_STEPS } from "./copilotAgentService";
import { __setAIProviderForTests, AIProviderNotConfiguredError, ReliableAIProvider, type AIProvider, type AICompletionResult } from "./copilotAiProvider";
import { RateLimitError } from "groq-sdk";
import { watchlistService } from "./watchlistService";
import { journalRepository } from "../repositories/journalRepository";
import db from "../../lib/prisma";
import { generateTccId } from "../../lib/tccId";
import { createTestUser, deleteTestUser, type TestUser } from "../../test/helpers";

async function createMasterTrader(userId: string, displayName: string) {
  const application = await db.masterTraderApplication.create({
    data: { userId, tccId: generateTccId("TRD"), displayName, status: "APPROVED" },
  });
  return db.masterTrader.create({
    data: {
      userId, applicationId: application.id, tccId: application.tccId, displayName,
      status: "ACTIVE", approvedBy: "test-fixture",
    },
  });
}

function toolCallResponse(name: string, args: object): AICompletionResult {
  return { content: null, toolCalls: [{ id: "call_1", name, arguments: JSON.stringify(args) }], tokensUsed: 10, model: "test-model" };
}

function finalResponse(content: string): AICompletionResult {
  return { content, toolCalls: [], tokensUsed: 5, model: "test-model" };
}

/** One tool call, then a final answer if the model gets asked again (it
 *  shouldn't, for a MEDIUM/HIGH tool — the loop stops after the proposal —
 *  but this keeps the fake safe to reuse either way). */
function proposalProvider(toolName: string, args: object): AIProvider {
  let step = 0;
  return {
    async complete() {
      step += 1;
      return step === 1 ? toolCallResponse(toolName, args) : finalResponse("(should not be reached)");
    },
  };
}

/** Replays `responses` in order, repeating the last one if called more
 *  times than scripted — used to script a continuation's own agent turn
 *  after propose()'s provider has already been fully consumed. */
function scriptedProvider(responses: AICompletionResult[]): AIProvider {
  let i = 0;
  return {
    async complete() {
      const r = responses[Math.min(i, responses.length - 1)];
      i += 1;
      return r;
    },
  };
}

async function propose(userId: string, toolName: string, args: object): Promise<NonNullable<ChatResult["pendingAction"]>> {
  __setAIProviderForTests(proposalProvider(toolName, args));
  const result = await chat(userId, null, `please ${toolName}`);
  if (!result.pendingAction) throw new Error(`expected a pending action from ${toolName}, got: ${JSON.stringify(result)}`);
  return result.pendingAction;
}

async function createJournalEntry(userId: string, overrides: Partial<{ symbol: string }> = {}) {
  return db.journalEntry.create({
    data: {
      userId,
      symbol:      overrides.symbol ?? "BTCUSDT",
      displayName: "Bitcoin",
      side:        "BUY",
      lotSize:     1,
      entryPrice:  100,
    },
  });
}

describe("copilotActionService — confirmation flow (real DB, real tools)", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
  });

  afterAll(async () => {
    __setAIProviderForTests(null);
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it("proposing a MEDIUM-risk tool does NOT execute it", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "XAUUSD", displayName: "Gold", category: "Commodities" });
    expect(pending.toolName).toBe("add_watchlist_item");

    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "XAUUSD")).toBe(false);
  });

  it("confirming executes the real watchlist service and reports EXECUTED", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "EURUSD", displayName: "Euro/Dollar", category: "Forex" });

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");
    expect(outcome.toolName).toBe("add_watchlist_item");

    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "EURUSD")).toBe(true);
  });

  it("cancelling never executes the tool", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "GBPUSD", displayName: "Pound/Dollar", category: "Forex" });

    const outcome = await cancelAction(pending.id, userA.id);
    expect(outcome.status).toBe("CANCELLED");

    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "GBPUSD")).toBe(false);
  });

  it("removes a real watchlist item through remove_watchlist_item once confirmed", async () => {
    await watchlistService.addSymbol(userA.id, { symbol: "SILVER", displayName: "Silver", category: "Commodities" });

    const pending = await propose(userA.id, "remove_watchlist_item", { symbol: "SILVER" });
    const outcome = await confirmAction(pending.id, userA.id);

    expect(outcome.status).toBe("EXECUTED");
    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "SILVER")).toBe(false);
  });

  it("updates a real journal entry through update_journal_entry once confirmed", async () => {
    const entry = await createJournalEntry(userA.id, { symbol: "ETHUSDT" });

    const pending = await propose(userA.id, "update_journal_entry", {
      entryId: entry.id,
      lessonLearned: "Wait for the confirmation, always.",
    });
    const outcome = await confirmAction(pending.id, userA.id);

    expect(outcome.status).toBe("EXECUTED");
    const updated = await journalRepository.findById(entry.id, userA.id);
    expect(updated?.lessonLearned).toBe("Wait for the confirmation, always.");
  });

  // ── Ownership ──────────────────────────────────────────────────────────

  it("a user cannot confirm another user's pending action", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "AUDUSD", displayName: "Aussie/Dollar", category: "Forex" });

    await expect(confirmAction(pending.id, userB.id)).rejects.toBeInstanceOf(PendingActionNotFoundError);

    // Not leaked, and not consumed — the real owner can still confirm it.
    await expect(confirmAction(pending.id, userA.id)).resolves.toMatchObject({ status: "EXECUTED" });
  });

  it("a user cannot cancel another user's pending action", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "USDJPY", displayName: "Dollar/Yen", category: "Forex" });

    await expect(cancelAction(pending.id, userB.id)).rejects.toBeInstanceOf(PendingActionNotFoundError);
    await expect(confirmAction(pending.id, userA.id)).resolves.toMatchObject({ status: "EXECUTED" });
  });

  it("a compromised model targeting another user's journal entry cannot modify it, even once confirmed by the entry owner's own attacker session", async () => {
    // userB owns the entry; userA's conversation is tricked into proposing
    // an update against userB's entryId. Even though userA is the one
    // confirming (a legitimate action from userA's point of view), the
    // underlying journalService re-checks ownership against the
    // authenticated confirmer (userA), not whoever the entryId belongs to.
    const entry = await createJournalEntry(userB.id, { symbol: "XRPUSDT" });

    const pending = await propose(userA.id, "update_journal_entry", { entryId: entry.id, notes: "hacked" });
    const outcome = await confirmAction(pending.id, userA.id);

    expect(outcome.status).toBe("FAILED");
    const unchanged = await journalRepository.findById(entry.id, userB.id);
    expect(unchanged?.notes).not.toBe("hacked");
  });

  // ── Invalid / stale state ────────────────────────────────────────────────

  it("rejects confirmation of a nonexistent action id", async () => {
    await expect(confirmAction("nonexistent-action-id", userA.id)).rejects.toBeInstanceOf(PendingActionNotFoundError);
  });

  it("rejects cancellation of a nonexistent action id", async () => {
    await expect(cancelAction("nonexistent-action-id", userA.id)).rejects.toBeInstanceOf(PendingActionNotFoundError);
  });

  it("cannot confirm an already-cancelled action", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "NZDUSD", displayName: "Kiwi/Dollar", category: "Forex" });
    await cancelAction(pending.id, userA.id);

    await expect(confirmAction(pending.id, userA.id)).rejects.toMatchObject({ currentStatus: "CANCELLED" });
  });

  it("cannot confirm an already-executed action a second time", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "USDCAD", displayName: "Dollar/Loonie", category: "Forex" });
    await confirmAction(pending.id, userA.id);

    await expect(confirmAction(pending.id, userA.id)).rejects.toMatchObject({ currentStatus: "EXECUTED" });
  });

  it("cannot cancel an already-executed action", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "USDCHF", displayName: "Dollar/Franc", category: "Forex" });
    await confirmAction(pending.id, userA.id);

    await expect(cancelAction(pending.id, userA.id)).rejects.toMatchObject({ currentStatus: "EXECUTED" });
  });

  it("an expired action cannot be confirmed and is marked EXPIRED, without executing the tool", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "USDSEK", displayName: "Dollar/Krona", category: "Forex" });

    // Simulate time passing past the TTL without waiting for it.
    await db.copilotToolExecution.update({ where: { id: pending.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    await expect(confirmAction(pending.id, userA.id)).rejects.toMatchObject({ currentStatus: "EXPIRED" });

    const row = await db.copilotToolExecution.findUnique({ where: { id: pending.id } });
    expect(row?.status).toBe("EXPIRED");

    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "USDSEK")).toBe(false);
  });

  // ── Race safety ────────────────────────────────────────────────────────

  it("two simultaneous confirmations execute the tool exactly once", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "XPTUSD", displayName: "Platinum", category: "Commodities" });

    const results = await Promise.allSettled([
      confirmAction(pending.id, userA.id),
      confirmAction(pending.id, userA.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected  = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(PendingActionNotAvailableError);

    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.filter((i) => i.symbol === "XPTUSD")).toHaveLength(1);
  });
});

describe("copilotActionService — Phase 3: continuation after confirmation", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
  });

  afterAll(async () => {
    __setAIProviderForTests(null);
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it("confirming a MEDIUM action from a multi-step request resumes the turn and executes the rest", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "XAUUSD", displayName: "Gold", category: "Commodities" });

    // Continuation script: the resumed turn calls a LOW tool, then answers.
    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("get_watchlist", {}),
      finalResponse("Your watchlist now includes XAUUSD."),
    ]));

    const outcome = await confirmAction(pending.id, userA.id);

    expect(outcome.status).toBe("EXECUTED");
    expect(outcome.message).toMatch(/Added XAUUSD/);
    expect(outcome.continuation).toBeDefined();
    expect(outcome.continuation!.toolCalls).toContainEqual({ name: "get_watchlist", status: "EXECUTED" });
    // The action's own outcome is always stated, never left purely to the
    // model's phrasing of the continuation.
    expect(outcome.continuation!.message).toContain("Added XAUUSD to your watchlist.");
    expect(outcome.continuation!.message).toContain("Your watchlist now includes XAUUSD.");

    // Persisted coherently: GET-style history would show this as one
    // assistant message containing both parts (checked directly here via
    // the repository since there is no GET route test in this file).
    const messages = await db.copilotMessage.findMany({ where: { conversationId: outcome.conversationId }, orderBy: { createdAt: "asc" } });
    const last = messages[messages.length - 1];
    expect(last.content).toBe(outcome.continuation!.message);
  });

  it("a simple single-action request still resumes (one extra model call) but needs no further tools", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "EURJPY2", displayName: "Euro/Yen", category: "Forex" });

    __setAIProviderForTests(scriptedProvider([finalResponse("All done, nothing else to do.")]));

    const outcome = await confirmAction(pending.id, userA.id);

    expect(outcome.continuation).toBeDefined();
    expect(outcome.continuation!.toolCalls).toHaveLength(0);
    expect(outcome.continuation!.pendingAction).toBeUndefined();
  });

  it("a continuation that itself needs another confirmation pauses again — the first confirmation does not cascade", async () => {
    await watchlistService.addSymbol(userA.id, { symbol: "OLDPAIR", displayName: "Old Pair", category: "Forex" });
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "XAUUSD2", displayName: "Gold", category: "Commodities" });

    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("remove_watchlist_item", { symbol: "OLDPAIR" }),
    ]));

    const outcome = await confirmAction(pending.id, userA.id);

    expect(outcome.status).toBe("EXECUTED"); // the FIRST action succeeded
    expect(outcome.continuation?.pendingAction).toBeDefined();
    expect(outcome.continuation!.pendingAction!.toolName).toBe("remove_watchlist_item");

    // Confirming the first action must NOT have implicitly authorized the
    // second — it has not executed yet.
    let watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "OLDPAIR")).toBe(true);

    // Only an explicit second confirmation executes it.
    const secondOutcome = await confirmAction(outcome.continuation!.pendingAction!.id, userA.id);
    expect(secondOutcome.status).toBe("EXECUTED");

    watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "OLDPAIR")).toBe(false);
  });

  it('named compound workflow: "Add XAUUSD to my watchlist, then analyze its performance" — one confirmation, both steps land', async () => {
    __setAIProviderForTests(proposalProvider("add_watchlist_item", { symbol: "XAUCOMPOUND", displayName: "Gold", category: "Commodities" }));
    const propose1 = await chat(userA.id, null, "Add XAUUSD to my watchlist, then analyze its performance");
    expect(propose1.pendingAction).toBeDefined();
    expect(propose1.pendingAction!.toolName).toBe("add_watchlist_item");

    // Continuation script: the resumed turn calls the LOW analytics tool
    // (never itself needing confirmation) and answers with the analysis.
    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("get_instrument_performance", {}),
      finalResponse("XAUCOMPOUND is now on your watchlist. You have no closed trades on it yet."),
    ]));

    const outcome = await confirmAction(propose1.pendingAction!.id, userA.id);

    expect(outcome.status).toBe("EXECUTED");
    expect(outcome.continuation).toBeDefined();
    expect(outcome.continuation!.toolCalls).toContainEqual({ name: "get_instrument_performance", status: "EXECUTED" });
    expect(outcome.continuation!.pendingAction).toBeUndefined(); // a read-only analysis step never needs its own confirmation

    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "XAUCOMPOUND")).toBe(true);
  });

  it('named compound workflow: "Add EURUSD, remove GBPUSD, then tell me how my watchlist looks" — each write needs its own confirmation, nothing auto-cascades', async () => {
    await watchlistService.addSymbol(userA.id, { symbol: "GBPCOMPOUND", displayName: "Pound", category: "Forex" });

    __setAIProviderForTests(proposalProvider("add_watchlist_item", { symbol: "EURCOMPOUND", displayName: "Euro", category: "Forex" }));
    const propose1 = await chat(userA.id, null, "Add EURUSD, remove GBPUSD, then tell me how my watchlist looks");
    expect(propose1.pendingAction!.toolName).toBe("add_watchlist_item");

    // Confirming step 1 must not silently also perform step 2 — the
    // continuation proposes remove_watchlist_item as its OWN pending action.
    __setAIProviderForTests(scriptedProvider([toolCallResponse("remove_watchlist_item", { symbol: "GBPCOMPOUND" })]));
    const outcome1 = await confirmAction(propose1.pendingAction!.id, userA.id);
    expect(outcome1.status).toBe("EXECUTED");
    expect(outcome1.continuation?.pendingAction).toBeDefined();
    expect(outcome1.continuation!.pendingAction!.toolName).toBe("remove_watchlist_item");

    let watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "EURCOMPOUND")).toBe(true);
    expect(watchlist.items.some((i) => i.symbol === "GBPCOMPOUND")).toBe(true); // not yet removed — step 2 unconfirmed

    // Only the explicit second confirmation removes it, and only then does
    // the final "tell me how my watchlist looks" read-only step run.
    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("get_watchlist", {}),
      finalResponse("Your watchlist now has EURCOMPOUND and no longer has GBPCOMPOUND."),
    ]));
    const outcome2 = await confirmAction(outcome1.continuation!.pendingAction!.id, userA.id);
    expect(outcome2.status).toBe("EXECUTED");
    expect(outcome2.continuation!.toolCalls).toContainEqual({ name: "get_watchlist", status: "EXECUTED" });
    expect(outcome2.continuation!.pendingAction).toBeUndefined();

    watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "GBPCOMPOUND")).toBe(false);
  });

  it("a user cannot confirm another user's second-stage pending action either", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "USDMXN", displayName: "Dollar/Peso", category: "Forex" });
    __setAIProviderForTests(scriptedProvider([toolCallResponse("remove_watchlist_item", { symbol: "USDMXN" })]));
    const outcome = await confirmAction(pending.id, userA.id);
    const secondPendingId = outcome.continuation!.pendingAction!.id;

    await expect(confirmAction(secondPendingId, userB.id)).rejects.toBeInstanceOf(PendingActionNotFoundError);

    // The failed cross-user attempt must not have consumed, corrupted, or
    // otherwise disturbed the claim — the real owner can still confirm it
    // normally afterward, and it still executes for real.
    const realOutcome = await confirmAction(secondPendingId, userA.id);
    expect(realOutcome.status).toBe("EXECUTED");
    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "USDMXN")).toBe(false);
  });

  it("a pending action cascade-deleted along with its conversation can no longer be confirmed by anyone, including its rightful owner", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "CASCADETEST", displayName: "x", category: "Forex" });
    const conversationId = (await db.copilotToolExecution.findUniqueOrThrow({ where: { id: pending.id }, include: { message: true } })).message.conversationId;

    await db.copilotConversation.delete({ where: { id: conversationId } });

    await expect(confirmAction(pending.id, userA.id)).rejects.toBeInstanceOf(PendingActionNotFoundError);
    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "CASCADETEST")).toBe(false);
  });

  it("accurately reports a succeeded action alongside a failed continuation tool call", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "AUDJPY2", displayName: "Aussie/Yen", category: "Forex" });

    // get_journal_entries' limit must be 1-50 — this deterministically fails validation.
    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("get_journal_entries", { limit: 999999 }),
      finalResponse("I added AUDJPY2, but I couldn't check your journal entries."),
    ]));

    const outcome = await confirmAction(pending.id, userA.id);

    expect(outcome.status).toBe("EXECUTED"); // the confirmed action itself still succeeded
    expect(outcome.continuation!.toolCalls[0]).toMatchObject({ name: "get_journal_entries", status: "FAILED" });
    expect(outcome.continuation!.message).toMatch(/couldn't/i);
  });

  it("degrades gracefully (keeps the action's own success) if the continuation's AI provider is unreachable", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "NZDCAD", displayName: "Kiwi/Loonie", category: "Forex" });

    __setAIProviderForTests({ async complete() { throw new Error("network exploded"); } });

    const outcome = await confirmAction(pending.id, userA.id);

    // runAgent() itself catches a generic provider failure and returns a
    // graceful fallback message rather than throwing, so the continuation
    // still "succeeds" architecturally — this proves the action's own
    // success is reported either way.
    expect(outcome.status).toBe("EXECUTED");
    expect(outcome.message).toMatch(/Added NZDCAD/);

    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "NZDCAD")).toBe(true);
  });

  it("degrades gracefully (keeps the action's own success) if the AI provider is not configured for the continuation", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "GBPCHF", displayName: "Pound/Franc", category: "Forex" });

    __setAIProviderForTests({ async complete() { throw new AIProviderNotConfiguredError(); } });

    const outcome = await confirmAction(pending.id, userA.id);

    expect(outcome.status).toBe("EXECUTED");
    expect(outcome.message).toMatch(/Added GBPCHF/);
    expect(outcome.continuation).toBeUndefined(); // continuation genuinely failed — not fabricated

    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "GBPCHF")).toBe(true);
  });

  it("cancelling an action with a continuation still resumes the rest of the request", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "SEKJPY", displayName: "Krona/Yen", category: "Forex" });

    __setAIProviderForTests(scriptedProvider([finalResponse("Okay — is there anything else I can help with?")]));

    const outcome = await cancelAction(pending.id, userA.id);

    expect(outcome.status).toBe("CANCELLED");
    expect(outcome.continuation).toBeDefined();

    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.some((i) => i.symbol === "SEKJPY")).toBe(false);
  });

  it("two simultaneous confirmations of an action with a continuation still run the action and its continuation exactly once", async () => {
    const pending = await propose(userA.id, "add_watchlist_item", { symbol: "XPTUSD2", displayName: "Platinum", category: "Commodities" });

    __setAIProviderForTests(scriptedProvider([
      toolCallResponse("get_watchlist", {}),
      finalResponse("All set."),
    ]));

    const results = await Promise.allSettled([
      confirmAction(pending.id, userA.id),
      confirmAction(pending.id, userA.id),
    ]);

    const fulfilled = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof confirmAction>>> => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

    // Exactly one execution of the underlying watchlist add — not two.
    const watchlist = await watchlistService.getWatchlist(userA.id);
    expect(watchlist.items.filter((i) => i.symbol === "XPTUSD2")).toHaveLength(1);

    // Exactly one continuation ran: exactly one assistant message exists
    // beyond the original proposal for this conversation (propose's
    // "Add XPTUSD2..." prompt, then this single combined continuation
    // message — never two).
    const conversationId = fulfilled[0].value.conversationId;
    const assistantMessages = await db.copilotMessage.findMany({ where: { conversationId, role: "ASSISTANT" } });
    expect(assistantMessages).toHaveLength(2); // the original proposal + this one continuation
  });

  it("cannot bypass MAX_AGENT_STEPS by repeatedly confirming across many pauses", async () => {
    let pending = await propose(userA.id, "add_watchlist_item", { symbol: "STEP0", displayName: "Step Test", category: "Forex" });

    let confirms = 0;
    let lastOutcome: Awaited<ReturnType<typeof confirmAction>>;

    do {
      confirms += 1;
      __setAIProviderForTests(scriptedProvider([
        toolCallResponse("add_watchlist_item", { symbol: `STEP${confirms}`, displayName: "Step Test", category: "Forex" }),
      ]));
      lastOutcome = await confirmAction(pending.id, userA.id);
      if (lastOutcome.continuation?.pendingAction) pending = lastOutcome.continuation.pendingAction;
    } while (lastOutcome.continuation?.pendingAction && confirms <= MAX_AGENT_STEPS + 2); // safety valve for the test itself

    // The chain must have terminated on its own, within the shared step
    // budget — never bypassed by repeated confirmation.
    expect(confirms).toBeLessThanOrEqual(MAX_AGENT_STEPS);
    expect(lastOutcome.continuation?.pendingAction).toBeUndefined();
    expect(lastOutcome.continuation?.message).toMatch(/couldn't finish/i);
  });
});

describe("copilotActionService — state machine: every terminal status rejects both confirm and cancel", () => {
  let user: TestUser;

  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { await deleteTestUser(user.id); });

  const terminalStatuses = ["EXECUTED", "CANCELLED", "EXPIRED", "FAILED"] as const;

  it.each(terminalStatuses)("a %s action rejects a further confirm", async (status) => {
    const pending = await propose(user.id, "add_watchlist_item", { symbol: `TERM${status}A`, displayName: "x", category: "Forex" });
    // Force the row directly into the terminal status under test, bypassing
    // the normal claim flow — isolates "is this transition rejected"
    // from "does the normal flow reach this status correctly" (already
    // covered by the tests above).
    await db.copilotToolExecution.update({ where: { id: pending.id }, data: { status } });

    await expect(confirmAction(pending.id, user.id)).rejects.toMatchObject({ currentStatus: status });
  });

  it.each(terminalStatuses)("a %s action rejects a further cancel", async (status) => {
    const pending = await propose(user.id, "add_watchlist_item", { symbol: `TERM${status}B`, displayName: "x", category: "Forex" });
    await db.copilotToolExecution.update({ where: { id: pending.id }, data: { status } });

    await expect(cancelAction(pending.id, user.id)).rejects.toMatchObject({ currentStatus: status });
  });
});

describe("copilotActionService — Phase 5: provider retry cannot duplicate a confirmed write action", () => {
  let user: TestUser;
  beforeAll(async () => { user = await createTestUser(); });
  afterAll(async () => { __setAIProviderForTests(null); await deleteTestUser(user.id); });

  it("a transient provider failure during the post-confirmation continuation never re-executes add_watchlist_item", async () => {
    const pending = await propose(user.id, "add_watchlist_item", { symbol: "IDEMPOTENT1", displayName: "x", category: "Forex" });

    // The confirmed action itself never touches the AI provider at all —
    // it's a direct tool.execute() call inside confirmAction(). Only the
    // CONTINUATION that follows goes through the (real, retrying)
    // ReliableAIProvider, and only its own tool calls could possibly
    // duplicate anything — never the already-executed confirmed action.
    let innerCalls = 0;
    const flakyInner: AIProvider = {
      async complete() {
        innerCalls += 1;
        if (innerCalls === 1) throw new RateLimitError(429, {}, "rate limited", new Headers());
        return { content: "All set.", toolCalls: [], tokensUsed: 5, model: "test-model" };
      },
    };
    __setAIProviderForTests(new ReliableAIProvider(flakyInner));

    const outcome = await confirmAction(pending.id, user.id);

    expect(outcome.status).toBe("EXECUTED");
    expect(outcome.continuation).toBeDefined();
    expect(innerCalls).toBe(2); // one failed attempt + one retry, for the continuation only

    const watchlist = await watchlistService.getWatchlist(user.id);
    expect(watchlist.items.filter((i) => i.symbol === "IDEMPOTENT1")).toHaveLength(1); // exactly once, never twice
  });
});

describe("copilotActionService — memory tools (Phase 7)", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
  });

  afterAll(async () => {
    __setAIProviderForTests(null);
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it("propose_memory does NOT persist anything until confirmed", async () => {
    const pending = await propose(userA.id, "propose_memory", {
      type: "TRADING_PREFERENCE", content: "trades gold most heavily on Fridays",
    });
    expect(pending.toolName).toBe("propose_memory");

    const stored = await db.copilotMemory.findMany({ where: { userId: userA.id } });
    expect(stored).toHaveLength(0);
  });

  it("confirming propose_memory persists it with source USER_APPROVED", async () => {
    const pending = await propose(userA.id, "propose_memory", {
      type: "TRADING_PREFERENCE", content: "seems to favor short timeframes",
    });

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");

    const stored = await db.copilotMemory.findFirst({ where: { userId: userA.id, content: "seems to favor short timeframes" } });
    expect(stored?.source).toBe("USER_APPROVED");
    expect(stored?.status).toBe("ACTIVE");
  });

  it("cancelling propose_memory never persists it", async () => {
    const pending = await propose(userA.id, "propose_memory", {
      type: "PREFERENCE", content: "prefers dark mode",
    });

    const outcome = await cancelAction(pending.id, userA.id);
    expect(outcome.status).toBe("CANCELLED");

    const stored = await db.copilotMemory.findFirst({ where: { userId: userA.id, content: "prefers dark mode" } });
    expect(stored).toBeNull();
  });

  it("a secret-like propose_memory proposal is rejected by governance even after confirmation", async () => {
    const pending = await propose(userA.id, "propose_memory", {
      type: "EXPLICIT_FACT", content: "their password is hunter2ishunter2",
    });

    const outcome = await confirmAction(pending.id, userA.id);
    // Governance rejection surfaces through the tool's own result, not a
    // thrown error — the confirmation itself still "succeeds" as an
    // EXECUTED tool call (the tool ran), but nothing was stored.
    expect(outcome.status).toBe("EXECUTED");

    const stored = await db.copilotMemory.findMany({ where: { userId: userA.id, content: { contains: "hunter2" } } });
    expect(stored).toHaveLength(0);
  });

  it("confirming delete_memory removes the memory; a user cannot delete another user's memory this way", async () => {
    __setAIProviderForTests(proposalProvider("propose_memory", { type: "GOAL", content: "wants to reach a 60% win rate" }));
    const saveResult = await chat(userA.id, null, "please propose_memory");
    if (!saveResult.pendingAction) throw new Error("expected a pending action");
    await confirmAction(saveResult.pendingAction.id, userA.id);

    const memory = await db.copilotMemory.findFirst({ where: { userId: userA.id, content: "wants to reach a 60% win rate" } });
    expect(memory).toBeTruthy();

    const deletePending = await propose(userA.id, "delete_memory", { memoryId: memory!.id });

    await expect(confirmAction(deletePending.id, userB.id)).rejects.toBeInstanceOf(PendingActionNotFoundError);

    const deleteOutcome = await confirmAction(deletePending.id, userA.id);
    expect(deleteOutcome.status).toBe("EXECUTED");

    const afterDelete = await db.copilotMemory.findUnique({ where: { id: memory!.id } });
    expect(afterDelete?.status).toBe("DELETED");
  });
});

describe("copilotActionService — TCC-wide write tools (Phase 9)", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
  });
  afterAll(async () => {
    __setAIProviderForTests(null);
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it("create_post does NOT publish until confirmed, then publishes real content once confirmed", async () => {
    const pending = await propose(userA.id, "create_post", { content: "phase9 confirm test post" });

    const before = await db.communityPost.findFirst({ where: { authorId: userA.id, content: "phase9 confirm test post" } });
    expect(before).toBeNull();

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");

    const after = await db.communityPost.findFirst({ where: { authorId: userA.id, content: "phase9 confirm test post" } });
    expect(after).toBeTruthy();
  });

  it("add_comment requires confirmation and is ownership-scoped to the confirming user", async () => {
    const post = await db.communityPost.create({
      data: { authorId: userA.id, type: "TEXT", content: "target post for comment test", visibility: "PUBLIC" },
    });

    const pending = await propose(userA.id, "add_comment", { postId: post.id, content: "confirmed comment" });

    await expect(confirmAction(pending.id, userB.id)).rejects.toBeInstanceOf(PendingActionNotFoundError);

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");

    const comment = await db.communityComment.findFirst({ where: { postId: post.id, authorId: userA.id } });
    expect(comment?.content).toBe("confirmed comment");
  });

  it("start_copying does not create a relationship until confirmed", async () => {
    const master = await createMasterTrader(userB.id, `ActionMaster${Date.now()}`);

    const pending = await propose(userA.id, "start_copying", { masterTraderId: master.id, maxRiskPerTradePercent: 2 });

    const beforeCount = await db.copyRelationship.count({ where: { followerUserId: userA.id, masterTraderId: master.id } });
    expect(beforeCount).toBe(0);

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");

    const relationship = await db.copyRelationship.findFirst({ where: { followerUserId: userA.id, masterTraderId: master.id } });
    expect(relationship).toBeTruthy();
    expect(relationship?.maxRiskPerTradePercent).toBe(2);
  });

  it("stop_copying is ownership-scoped — another user's confirmation attempt fails, the real owner's succeeds", async () => {
    const masterOwner = await createTestUser();
    try {
      const master = await createMasterTrader(masterOwner.id, `ActionMaster2${Date.now()}`);
      const relationship = await db.copyRelationship.create({
        data: { followerUserId: userA.id, masterTraderId: master.id, masterDisplayName: master.displayName },
      });

      const pending = await propose(userA.id, "stop_copying", { relationshipId: relationship.id });

      await expect(confirmAction(pending.id, userB.id)).rejects.toBeInstanceOf(PendingActionNotFoundError);
      await expect(confirmAction(pending.id, userA.id)).resolves.toMatchObject({ status: "EXECUTED" });

      const stopped = await db.copyRelationship.findUnique({ where: { id: relationship.id } });
      expect(stopped?.status).toBe("STOPPED");
    } finally {
      await deleteTestUser(masterOwner.id);
    }
  });

  it("enroll_course does not enroll until confirmed", async () => {
    const course = await db.course.upsert({
      where:  { id: "action-service-phase9-course" },
      create: { id: "action-service-phase9-course", title: "x", description: "x", type: "FREE_RESOURCE", level: "BEGINNER", category: "trading", thumbnail: "x", totalDuration: "1h" },
      update: {},
    });

    const pending = await propose(userA.id, "enroll_course", { courseId: course.id });

    const before = await db.academyProgress.findUnique({ where: { userId_courseId: { userId: userA.id, courseId: course.id } } });
    expect(before).toBeNull();

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");

    const after = await db.academyProgress.findUnique({ where: { userId_courseId: { userId: userA.id, courseId: course.id } } });
    expect(after).toBeTruthy();
  });

  it("update_profile does not change the profile until confirmed, and only under the confirming user", async () => {
    const uniqueBio = `confirm-test-bio-${Date.now()}`;
    const pending = await propose(userA.id, "update_profile", { bio: uniqueBio });

    const before = await db.user.findUnique({ where: { id: userA.id } });
    expect(before?.bio).not.toBe(uniqueBio);

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");

    const after = await db.user.findUnique({ where: { id: userA.id } });
    expect(after?.bio).toBe(uniqueBio);

    const bUser = await db.user.findUnique({ where: { id: userB.id } });
    expect(bUser?.bio).not.toBe(uniqueBio);
  });

  it("cancelling create_post never publishes anything", async () => {
    const pending = await propose(userA.id, "create_post", { content: "should never be published" });
    const outcome = await cancelAction(pending.id, userA.id);
    expect(outcome.status).toBe("CANCELLED");

    const post = await db.communityPost.findFirst({ where: { authorId: userA.id, content: "should never be published" } });
    expect(post).toBeNull();
  });

  it("edit_post does not change content until confirmed, and only the author can edit it", async () => {
    const post = await db.communityPost.create({
      data: { authorId: userA.id, type: "TEXT", content: "original content", visibility: "PUBLIC" },
    });

    const pending = await propose(userA.id, "edit_post", { postId: post.id, content: "edited content" });

    const before = await db.communityPost.findUnique({ where: { id: post.id } });
    expect(before?.content).toBe("original content");

    await expect(confirmAction(pending.id, userB.id)).rejects.toBeInstanceOf(PendingActionNotFoundError);

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");

    const after = await db.communityPost.findUnique({ where: { id: post.id } });
    expect(after?.content).toBe("edited content");
  });

  it("delete_post does not delete until confirmed, and rejects deleting another user's post", async () => {
    const ownPost = await db.communityPost.create({
      data: { authorId: userA.id, type: "TEXT", content: "userA's own post to delete", visibility: "PUBLIC" },
    });
    const otherPost = await db.communityPost.create({
      data: { authorId: userB.id, type: "TEXT", content: "userB's post — must survive", visibility: "PUBLIC" },
    });

    // Confirming a pending delete_post proposed by userA against userB's own post fails.
    const badPending = await propose(userA.id, "delete_post", { postId: otherPost.id });
    const badOutcome = await confirmAction(badPending.id, userA.id);
    expect(badOutcome.status).toBe("FAILED");
    expect(await db.communityPost.findUnique({ where: { id: otherPost.id } })).toBeTruthy();

    const pending = await propose(userA.id, "delete_post", { postId: ownPost.id });
    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");
    expect(await db.communityPost.findUnique({ where: { id: ownPost.id } })).toBeNull();
  });

  it("toggle_post_like requires confirmation, then toggles like state on the confirmed post", async () => {
    const post = await db.communityPost.create({
      data: { authorId: userB.id, type: "TEXT", content: "likeable post", visibility: "PUBLIC" },
    });

    const pending = await propose(userA.id, "toggle_post_like", { postId: post.id });
    expect(await db.postLike.findFirst({ where: { postId: post.id, userId: userA.id } })).toBeNull();

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");
    expect(await db.postLike.findFirst({ where: { postId: post.id, userId: userA.id } })).toBeTruthy();
  });

  it("toggle_post_like against a private post the user cannot see is rejected, never a bypass around visibility", async () => {
    const privatePost = await db.communityPost.create({
      data: { authorId: userB.id, type: "TEXT", content: "private post", visibility: "PRIVATE" },
    });

    const pending = await propose(userA.id, "toggle_post_like", { postId: privatePost.id });
    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("FAILED");
    expect(await db.postLike.findFirst({ where: { postId: privatePost.id, userId: userA.id } })).toBeNull();
  });

  it("toggle_post_bookmark requires confirmation, then toggles bookmark state on the confirmed post", async () => {
    const post = await db.communityPost.create({
      data: { authorId: userB.id, type: "TEXT", content: "bookmarkable post", visibility: "PUBLIC" },
    });

    const pending = await propose(userA.id, "toggle_post_bookmark", { postId: post.id });
    expect(await db.savedPost.findFirst({ where: { postId: post.id, userId: userA.id } })).toBeNull();

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");
    expect(await db.savedPost.findFirst({ where: { postId: post.id, userId: userA.id } })).toBeTruthy();
  });

  it("edit_comment does not change content until confirmed, and only the author can edit it", async () => {
    const post = await db.communityPost.create({
      data: { authorId: userB.id, type: "TEXT", content: "post for comment edit test", visibility: "PUBLIC" },
    });
    const comment = await db.communityComment.create({
      data: { postId: post.id, authorId: userA.id, content: "original comment" },
    });

    const pending = await propose(userA.id, "edit_comment", { commentId: comment.id, content: "edited comment" });
    expect((await db.communityComment.findUnique({ where: { id: comment.id } }))?.content).toBe("original comment");

    await expect(confirmAction(pending.id, userB.id)).rejects.toBeInstanceOf(PendingActionNotFoundError);

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");
    expect((await db.communityComment.findUnique({ where: { id: comment.id } }))?.content).toBe("edited comment");
  });

  it("delete_comment does not delete until confirmed, and rejects deleting another user's comment", async () => {
    const post = await db.communityPost.create({
      data: { authorId: userB.id, type: "TEXT", content: "post for comment delete test", visibility: "PUBLIC" },
    });
    const otherComment = await db.communityComment.create({
      data: { postId: post.id, authorId: userB.id, content: "userB's comment — must survive" },
    });

    const badPending = await propose(userA.id, "delete_comment", { commentId: otherComment.id });
    const badOutcome = await confirmAction(badPending.id, userA.id);
    expect(badOutcome.status).toBe("FAILED");
    expect(await db.communityComment.findUnique({ where: { id: otherComment.id } })).toBeTruthy();

    const ownComment = await db.communityComment.create({
      data: { postId: post.id, authorId: userA.id, content: "userA's own comment to delete" },
    });
    const pending = await propose(userA.id, "delete_comment", { commentId: ownComment.id });
    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");
    expect(await db.communityComment.findUnique({ where: { id: ownComment.id } })).toBeNull();
  });

  it("follow_user requires confirmation, then creates a real follow relationship once confirmed", async () => {
    const pending = await propose(userA.id, "follow_user", { handle: userB.handle });
    expect(await db.follow.findFirst({ where: { sourceId: userA.id, targetId: userB.id } })).toBeNull();

    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");
    expect(await db.follow.findFirst({ where: { sourceId: userA.id, targetId: userB.id } })).toBeTruthy();
  });

  it("follow_user against a PRIVATE profile is rejected — the dead-code PrivateProfileError gap is now closed", async () => {
    const privateUser = await createTestUser();
    try {
      await db.user.update({ where: { id: privateUser.id }, data: { profileVisibility: "PRIVATE" } });

      const pending = await propose(userA.id, "follow_user", { handle: privateUser.handle });
      const outcome = await confirmAction(pending.id, userA.id);
      expect(outcome.status).toBe("FAILED");
      expect(await db.follow.findFirst({ where: { sourceId: userA.id, targetId: privateUser.id } })).toBeNull();
    } finally {
      await deleteTestUser(privateUser.id);
    }
  });

  it("unfollow_user requires confirmation, then removes a real follow relationship once confirmed", async () => {
    await db.follow.upsert({
      where:  { sourceId_targetId: { sourceId: userA.id, targetId: userB.id } },
      create: { sourceId: userA.id, targetId: userB.id },
      update: {},
    });

    const pending = await propose(userA.id, "unfollow_user", { handle: userB.handle });
    const outcome = await confirmAction(pending.id, userA.id);
    expect(outcome.status).toBe("EXECUTED");
    expect(await db.follow.findFirst({ where: { sourceId: userA.id, targetId: userB.id } })).toBeNull();
  });
});
