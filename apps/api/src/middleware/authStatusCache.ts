/**
 * Short-TTL cache for the account-status check `authenticate()` runs on
 * every request (isActive / isSuspended / status).
 *
 * That check exists so a banned/suspended user's still-valid JWT stops
 * working right away instead of only at token expiry — but it was paying a
 * full `db.user.findUnique()` round-trip on literally every authenticated
 * request in the API, including ones that fire several in parallel (a
 * single page load can trigger 3-5 store inits at once). Caching the result
 * for a few seconds cuts that to one DB hit per user per window, and
 * `invalidate()` is called directly from the suspend/ban/reinstate actions
 * so the common case (an admin action taking effect) is immediate — the TTL
 * only matters as a fallback, not as the primary correctness mechanism.
 */

export interface CachedAuthStatus {
  isActive:    boolean;
  isSuspended: boolean;
  status:      string;
}

const TTL_MS = 15_000;

const cache = new Map<string, { value: CachedAuthStatus; expiresAt: number }>();

export function getCachedAuthStatus(userId: string): CachedAuthStatus | undefined {
  const entry = cache.get(userId);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(userId);
    return undefined;
  }
  return entry.value;
}

export function setCachedAuthStatus(userId: string, value: CachedAuthStatus): void {
  cache.set(userId, { value, expiresAt: Date.now() + TTL_MS });
}

/** Call after any action that changes a user's active/suspended/status fields. */
export function invalidateAuthStatus(userId: string): void {
  cache.delete(userId);
}
