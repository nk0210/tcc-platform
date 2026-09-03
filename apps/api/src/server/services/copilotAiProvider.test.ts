import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ReliableAIProvider,
  classifyProviderError,
  AIProviderNotConfiguredError,
  type AIProvider,
  type AICompletionResult,
} from "./copilotAiProvider";
import { TimeoutError } from "./copilotUtil";
import {
  RateLimitError,
  InternalServerError,
  APIConnectionError,
  AuthenticationError,
  BadRequestError,
} from "groq-sdk";

function ok(overrides: Partial<AICompletionResult> = {}): AICompletionResult {
  return { content: "ok", toolCalls: [], tokensUsed: 5, model: "test-model", ...overrides };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("classifyProviderError", () => {
  it("AIProviderNotConfiguredError is not_configured and non-retryable", () => {
    expect(classifyProviderError(new AIProviderNotConfiguredError())).toEqual({ category: "not_configured", retryable: false });
  });

  it("a per-attempt TimeoutError is retryable", () => {
    expect(classifyProviderError(new TimeoutError("x"))).toEqual({ category: "timeout", retryable: true });
  });

  it("RateLimitError (429) is retryable", () => {
    expect(classifyProviderError(new RateLimitError(429, {}, "rate limited", new Headers())))
      .toEqual({ category: "rate_limit", retryable: true });
  });

  it("InternalServerError (5xx) is retryable", () => {
    expect(classifyProviderError(new InternalServerError(500, {}, "server error", new Headers())))
      .toEqual({ category: "server_error", retryable: true });
  });

  it("APIConnectionError (network failure) is retryable", () => {
    expect(classifyProviderError(new APIConnectionError({ message: "connection reset" })).retryable).toBe(true);
  });

  it("AuthenticationError (401, invalid API key) is NOT retryable", () => {
    expect(classifyProviderError(new AuthenticationError(401, {}, "invalid key", new Headers())))
      .toEqual({ category: "auth", retryable: false });
  });

  it("BadRequestError (400, malformed request) is NOT retryable", () => {
    expect(classifyProviderError(new BadRequestError(400, {}, "bad request", new Headers())))
      .toEqual({ category: "bad_request", retryable: false });
  });

  it("an unrecognized error is treated as non-retryable by default", () => {
    expect(classifyProviderError(new Error("something weird"))).toEqual({ category: "unknown", retryable: false });
  });
});

describe("ReliableAIProvider", () => {
  it("a successful request makes exactly one attempt", async () => {
    let calls = 0;
    const inner: AIProvider = { async complete() { calls += 1; return ok(); } };

    const result = await new ReliableAIProvider(inner).complete({ systemPrompt: "s", messages: [] });

    expect(calls).toBe(1);
    expect(result.retries).toBe(0);
  });

  it("retries once on a transient RateLimitError, then succeeds", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const inner: AIProvider = {
      async complete() {
        calls += 1;
        if (calls === 1) throw new RateLimitError(429, {}, "rate limited", new Headers());
        return ok();
      },
    };

    const promise = new ReliableAIProvider(inner).complete({ systemPrompt: "s", messages: [] });
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await promise;

    expect(calls).toBe(2);
    expect(result.retries).toBe(1);
  });

  it("retries through a timeout, then a server error, before succeeding", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const inner: AIProvider = {
      async complete() {
        calls += 1;
        if (calls === 1) return new Promise<AICompletionResult>(() => {}); // never resolves — forces the attempt timeout
        if (calls === 2) throw new InternalServerError(500, {}, "server error", new Headers());
        return ok();
      },
    };

    const promise = new ReliableAIProvider(inner).complete({ systemPrompt: "s", messages: [] });
    await vi.advanceTimersByTimeAsync(90_000);
    const result = await promise;

    expect(calls).toBe(3);
    expect(result.retries).toBe(2);
  });

  it("exhausts retries and throws the last error, without retrying forever", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const inner: AIProvider = {
      async complete() {
        calls += 1;
        throw new RateLimitError(429, {}, "rate limited", new Headers());
      },
    };

    const promise = new ReliableAIProvider(inner).complete({ systemPrompt: "s", messages: [] });
    const assertion = expect(promise).rejects.toBeInstanceOf(RateLimitError);
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;

    // Default COPILOT_PROVIDER_MAX_RETRIES=2 → 3 total attempts, never more.
    expect(calls).toBe(3);
  });

  it("a non-retryable failure (invalid API key) makes exactly one attempt", async () => {
    let calls = 0;
    const inner: AIProvider = {
      async complete() {
        calls += 1;
        throw new AuthenticationError(401, {}, "invalid key", new Headers());
      },
    };

    await expect(new ReliableAIProvider(inner).complete({ systemPrompt: "s", messages: [] }))
      .rejects.toBeInstanceOf(AuthenticationError);
    expect(calls).toBe(1);
  });

  it("AIProviderNotConfiguredError makes exactly one attempt and is rethrown unchanged", async () => {
    let calls = 0;
    const inner: AIProvider = {
      async complete() {
        calls += 1;
        throw new AIProviderNotConfiguredError();
      },
    };

    await expect(new ReliableAIProvider(inner).complete({ systemPrompt: "s", messages: [] }))
      .rejects.toBeInstanceOf(AIProviderNotConfiguredError);
    expect(calls).toBe(1);
  });

  it("honors a Retry-After header over the computed backoff", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const inner: AIProvider = {
      async complete() {
        calls += 1;
        if (calls === 1) throw new RateLimitError(429, {}, "rate limited", new Headers({ "retry-after": "3" }));
        return ok();
      },
    };

    let settled = false;
    const promise = new ReliableAIProvider(inner).complete({ systemPrompt: "s", messages: [] });
    void promise.then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).toBe(false); // still honoring the 3s Retry-After, not a shorter computed backoff

    await vi.advanceTimersByTimeAsync(2500);
    await promise;
    expect(settled).toBe(true);
  });

  it("never exceeds the overall MAX_TOTAL_MS budget even if every attempt individually hangs", async () => {
    vi.useFakeTimers();
    const inner: AIProvider = { async complete() { return new Promise<AICompletionResult>(() => {}); } };

    const before = Date.now();
    let settledAt: number | null = null;
    const promise = new ReliableAIProvider(inner).complete({ systemPrompt: "s", messages: [] });
    promise.catch(() => { settledAt = Date.now(); });

    // Advance in small steps and check after each one — advancing by one
    // huge jump would just report however far we told the clock to go,
    // not the moment the operation actually gave up.
    for (let i = 0; i < 130 && settledAt === null; i++) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    expect(settledAt).not.toBeNull();
    // Default COPILOT_PROVIDER_MAX_TOTAL_MS=45000 — allow a little slack for
    // the loop's own bookkeeping, but nowhere near the 130s of headroom above.
    expect((settledAt as unknown as number) - before).toBeLessThanOrEqual(46_000);
    await expect(promise).rejects.toBeInstanceOf(TimeoutError);
  });
});
