import { describe, it, expect, beforeEach } from "vitest";
import {
  recordActionOutcome,
  recordContinuationResumed,
  getProviderMetricsSnapshot,
  __resetProviderMetricsForTests,
} from "./copilotObservability";

describe("copilotObservability — confirmation-flow counters (production-hardening pass)", () => {
  beforeEach(() => {
    __resetProviderMetricsForTests();
  });

  it("starts at zero with null rates before any action reaches a terminal state", () => {
    const snapshot = getProviderMetricsSnapshot();
    expect(snapshot.actionsExecuted).toBe(0);
    expect(snapshot.actionsFailed).toBe(0);
    expect(snapshot.actionsCancelled).toBe(0);
    expect(snapshot.actionsExpired).toBe(0);
    expect(snapshot.continuationsResumed).toBe(0);
    expect(snapshot.confirmationRate).toBeNull();
    expect(snapshot.cancellationRate).toBeNull();
    expect(snapshot.expiredRate).toBeNull();
  });

  it("counts each terminal status exactly once, independently", () => {
    recordActionOutcome("EXECUTED",  { actionId: "a1", userId: "u1", toolName: "add_watchlist_item" });
    recordActionOutcome("EXECUTED",  { actionId: "a2", userId: "u1", toolName: "add_watchlist_item" });
    recordActionOutcome("FAILED",    { actionId: "a3", userId: "u1", toolName: "update_journal_entry" });
    recordActionOutcome("CANCELLED", { actionId: "a4", userId: "u1", toolName: "create_post" });
    recordActionOutcome("EXPIRED",   { actionId: "a5", userId: "u1", toolName: "start_copying" });

    const snapshot = getProviderMetricsSnapshot();
    expect(snapshot.actionsExecuted).toBe(2);
    expect(snapshot.actionsFailed).toBe(1);
    expect(snapshot.actionsCancelled).toBe(1);
    expect(snapshot.actionsExpired).toBe(1);
  });

  it("computes confirmation/cancellation/expired rate as a fraction of every terminal action", () => {
    recordActionOutcome("EXECUTED",  { actionId: "a1", userId: "u1", toolName: "add_watchlist_item" });
    recordActionOutcome("EXECUTED",  { actionId: "a2", userId: "u1", toolName: "add_watchlist_item" });
    recordActionOutcome("CANCELLED", { actionId: "a3", userId: "u1", toolName: "create_post" });
    recordActionOutcome("EXPIRED",   { actionId: "a4", userId: "u1", toolName: "start_copying" });
    // 4 terminal actions total: 2 executed, 1 cancelled, 1 expired.

    const snapshot = getProviderMetricsSnapshot();
    expect(snapshot.confirmationRate).toBeCloseTo(0.5);
    expect(snapshot.cancellationRate).toBeCloseTo(0.25);
    expect(snapshot.expiredRate).toBeCloseTo(0.25);
  });

  it("counts a continuation resume independently of action outcome counts", () => {
    recordActionOutcome("EXECUTED", { actionId: "a1", userId: "u1", toolName: "add_watchlist_item" });
    recordContinuationResumed({ conversationId: "c1", userId: "u1" });
    recordContinuationResumed({ conversationId: "c1", userId: "u1" });

    const snapshot = getProviderMetricsSnapshot();
    expect(snapshot.continuationsResumed).toBe(2);
    expect(snapshot.actionsExecuted).toBe(1); // unaffected by the continuation counter
  });

  it("__resetProviderMetricsForTests clears every confirmation-flow counter, not just provider counters", () => {
    recordActionOutcome("EXECUTED", { actionId: "a1", userId: "u1", toolName: "add_watchlist_item" });
    recordContinuationResumed({ conversationId: "c1", userId: "u1" });

    __resetProviderMetricsForTests();

    const snapshot = getProviderMetricsSnapshot();
    expect(snapshot.actionsExecuted).toBe(0);
    expect(snapshot.continuationsResumed).toBe(0);
  });
});
