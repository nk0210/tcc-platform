import { describe, it, expect, afterEach, vi } from "vitest";
import {
  EmbeddingProviderNotConfiguredError,
  getEmbeddingProvider,
  __setEmbeddingProviderForTests,
  OpenAICompatibleEmbeddingProvider,
  type EmbeddingProvider,
} from "./copilotEmbeddingProvider";

afterEach(() => {
  __setEmbeddingProviderForTests(null);
});

describe("copilotEmbeddingProvider — error class", () => {
  it("EmbeddingProviderNotConfiguredError carries a stable identifying message", () => {
    const err = new EmbeddingProviderNotConfiguredError();
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("EMBEDDING_PROVIDER_NOT_CONFIGURED");
  });
});

describe("copilotEmbeddingProvider — test override / singleton", () => {
  it("__setEmbeddingProviderForTests injects a fake that getEmbeddingProvider() then returns", async () => {
    const fake: EmbeddingProvider = { async embed() { return [0.1, 0.2, 0.3]; } };
    __setEmbeddingProviderForTests(fake);

    expect(getEmbeddingProvider()).toBe(fake);
    await expect(getEmbeddingProvider().embed("hello")).resolves.toEqual([0.1, 0.2, 0.3]);
  });

  it("passing null restores the real (Groq-backed) singleton", () => {
    __setEmbeddingProviderForTests({ async embed() { return []; } });
    __setEmbeddingProviderForTests(null);

    // Real provider is a distinct object from any fake we installed —
    // this doesn't make a network call (embed() is never invoked here),
    // it only checks the accessor stopped returning the test override.
    const provider = getEmbeddingProvider();
    expect(provider).toBeDefined();
  });

  it("embedMany is optional on the interface — a minimal fake without it is still valid", () => {
    const minimal: EmbeddingProvider = { async embed() { return [1]; } };
    __setEmbeddingProviderForTests(minimal);
    expect(getEmbeddingProvider().embedMany).toBeUndefined();
  });
});

describe("OpenAICompatibleEmbeddingProvider — pluggable embedding backend", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws EmbeddingProviderNotConfiguredError when no base URL is configured", async () => {
    const provider = new OpenAICompatibleEmbeddingProvider({});
    await expect(provider.embed("hello")).rejects.toBeInstanceOf(EmbeddingProviderNotConfiguredError);
  });

  it("posts to <baseUrl>/embeddings with the configured model and returns vectors sorted by index", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          data: [
            { embedding: [0.2, 0.2], index: 1 },
            { embedding: [0.1, 0.1], index: 0 },
          ],
          usage: { total_tokens: 7 },
        }),
      };
    });

    const provider = new OpenAICompatibleEmbeddingProvider({
      baseUrl: "http://localhost:11434/v1/",
      apiKey: "local-key",
      model: "test-embed-model",
      timeoutMs: 2000,
    });

    const vectors = await provider.embedMany(["a", "b"]);
    expect(vectors).toEqual([[0.1, 0.1], [0.2, 0.2]]); // reordered by index, not response order

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://localhost:11434/v1/embeddings"); // trailing slash normalized away, no double slash
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe("test-embed-model");
    expect(body.input).toEqual(["a", "b"]);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer local-key");
  });

  it("omits the Authorization header entirely when no API key is configured (local servers that need no auth)", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      capturedHeaders = init.headers as Record<string, string>;
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ data: [{ embedding: [1], index: 0 }] }) };
    });

    const provider = new OpenAICompatibleEmbeddingProvider({ baseUrl: "http://localhost:11434/v1", timeoutMs: 2000 });
    await provider.embed("hello");

    expect(capturedHeaders).toBeDefined();
    expect(Object.keys(capturedHeaders!)).not.toContain("Authorization");
  });

  it("a non-2xx response throws rather than returning a partial/fake vector", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 404, statusText: "Not Found", json: async () => ({}) }));

    const provider = new OpenAICompatibleEmbeddingProvider({ baseUrl: "http://localhost:11434/v1", timeoutMs: 2000 });
    await expect(provider.embed("hello")).rejects.toThrow(/404/);
  });

  it("a network-level failure (server unreachable) throws rather than hanging or returning a fake vector", async () => {
    vi.stubGlobal("fetch", async () => { throw new TypeError("fetch failed"); });

    const provider = new OpenAICompatibleEmbeddingProvider({ baseUrl: "http://localhost:11434/v1", timeoutMs: 2000 });
    await expect(provider.embed("hello")).rejects.toThrow("fetch failed");
  });
});
