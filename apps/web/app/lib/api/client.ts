/**
 * TCC API Client — thin fetch wrapper for the Express backend.
 *
 * Security model:
 *   - Access tokens: in-memory (XSS-safe)
 *   - Refresh tokens: localStorage (Phase Alpha; httpOnly cookie upgrade in Day 10)
 *   - Token refresh: automatic on expiry, de-duplicated via promise reference
 *
 * Usage:
 *   import { api } from "@/lib/api/client";
 *   const result = await api.get<Trade[]>("/trade");
 *   if (result.success) { ... } else { ... }
 */

const API_BASE: string =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// ── Token state (module-level = in-memory only) ────────────────────────────

let _accessToken: string | null = null;
let _expiresAt:   number | null = null;
const RT_KEY = "tcc:rt";

function getStoredRT(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(RT_KEY); } catch { return null; }
}
function saveRT(token: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(RT_KEY, token); } catch {}
}
function clearRT(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(RT_KEY); } catch {}
}

export function getStoredRefreshToken(): string | null {
  return getStoredRT();
}

export function setTokens(tokens: {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number; // seconds
}): void {
  _accessToken = tokens.accessToken;
  _expiresAt   = Date.now() + tokens.expiresIn * 1000 - 30_000; // 30s buffer
  saveRT(tokens.refreshToken);
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function clearTokens(): void {
  _accessToken = null;
  _expiresAt   = null;
  clearRT();
}

function isTokenExpired(): boolean {
  if (!_accessToken || !_expiresAt) return true;
  return Date.now() >= _expiresAt;
}

// ── Refresh de-duplication ─────────────────────────────────────────────────

let _refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  const rt = getStoredRT();
  if (!rt) return false;

  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) { clearTokens(); return false; }
      const data = await res.json();
      if (data.success && data.data?.tokens) {
        setTokens(data.data.tokens);
        return true;
      }
      clearTokens();
      return false;
    } catch {
      clearTokens();
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────

export interface RequestOptions extends RequestInit {
  skipAuth?:    boolean;
  skipRefresh?: boolean;
}

export type ApiResult<T> =
  | { success: true;  data: T;       message?: string }
  | { success: false; error: string; code?: string; details?: Record<string, string[]> };

export async function apiRequest<T>(
  path:    string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const { skipAuth = false, skipRefresh = false, ...fetchOptions } = options;

  // Auto-refresh if access token is stale
  if (!skipAuth && !skipRefresh && isTokenExpired()) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return {
        success: false,
        error:   "Session expired. Please log in again.",
        code:    "UNAUTHORIZED",
      };
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };

  if (!skipAuth && _accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers });

    // 204 No Content
    if (res.status === 204) {
      return { success: true, data: null as T };
    }

    const json = await res.json();
    return json as ApiResult<T>;
  } catch (err) {
    console.error(`[TCC API] ${path}:`, err);
    return {
      success: false,
      error:   "Network error. Please check your connection.",
      code:    "NETWORK_ERROR",
    };
  }
}

// ── Convenience methods ────────────────────────────────────────────────────

export const api = {
  get<T>(path: string, opts?: RequestOptions) {
    return apiRequest<T>(path, { method: "GET", ...opts });
  },
  post<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return apiRequest<T>(path, {
      method: "POST",
      body:   body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    });
  },
  put<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return apiRequest<T>(path, {
      method: "PUT",
      body:   body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    });
  },
  patch<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return apiRequest<T>(path, {
      method: "PATCH",
      body:   body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    });
  },
  delete<T>(path: string, body?: unknown, opts?: RequestOptions) {
    return apiRequest<T>(path, {
      method: "DELETE",
      body:   body !== undefined ? JSON.stringify(body) : undefined,
      ...opts,
    });
  },
};