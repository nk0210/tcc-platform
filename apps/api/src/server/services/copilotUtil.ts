/**
 * Shared micro-utilities for the Copilot backend: bounded timeouts and
 * delays. Used by both copilotAiProvider.ts (per-attempt provider timeout,
 * retry backoff delay) and copilotAgentService.ts (tool execution timeout)
 * so there is exactly one implementation of "race a promise against a
 * clock" in the codebase.
 */

/** Thrown when `withTimeout`'s clock wins the race — a distinguishable
 *  type (not just an Error with a particular message) so callers that care
 *  whether a failure was "took too long" vs. something else can check
 *  `instanceof TimeoutError` instead of string-matching a message. */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
