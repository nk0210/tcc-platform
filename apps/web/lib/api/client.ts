/**
 * TCC API Client
 *
 * Security: access tokens in memory (XSS-safe), refresh tokens in localStorage.
 * Auto-refreshes on token expiry with promise deduplication.
 */

const API_BASE: string =
  (typeof process !== "undefined" && process.env?.["NEXT_PUBLIC_API_URL"])
    ? (process.env["NEXT_PUBLIC_API_URL"] as string)
    : "http://localhost:4000/api";

// ── Token state ───────────────────────────────────────────────────────────

let _accessToken: string | null = null;
let _expiresAt:   number | null = null;
const RT_KEY = "tcc:rt";

function getRT(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(RT_KEY); } catch { return null; }
}
function saveRT(t: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(RT_KEY, t); } catch {}
}
function dropRT(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(RT_KEY); } catch {}
}

export function getStoredRefreshToken(): string | null { return getRT(); }

export function setTokens(tokens: { accessToken: string; refreshToken: string; expiresIn: number }): void {
  _accessToken = tokens.accessToken;
  _expiresAt   = Date.now() + tokens.expiresIn * 1000 - 30_000;
  saveRT(tokens.refreshToken);
}

export function clearTokens(): void {
  _accessToken = null;
  _expiresAt   = null;
  dropRT();
}

function isExpired(): boolean {
  return !_accessToken || !_expiresAt || Date.now() >= _expiresAt;
}

// ── Refresh (deduplicated) ────────────────────────────────────────────────

let _refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const rt = getRT();
  if (!rt) return false;
  try {
    const res  = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: rt }) });
    if (!res.ok) { clearTokens(); return false; }
    const data = await res.json() as { success: boolean; data?: { tokens: { accessToken: string; refreshToken: string; expiresIn: number } } };
    if (data.success && data.data?.tokens) { setTokens(data.data.tokens); return true; }
    clearTokens(); return false;
  } catch { clearTokens(); return false; }
}

async function ensureFresh(): Promise<boolean> {
  if (!isExpired()) return true;
  if (_refreshing) return _refreshing;
  _refreshing = doRefresh().finally(() => { _refreshing = null; });
  return _refreshing;
}

// ── Core ──────────────────────────────────────────────────────────────────

export type ApiResult<T> =
  | { success: true;  data: T; message?: string }
  | { success: false; error: string; code?: string; details?: Record<string, string[]> };

export interface RequestOptions extends RequestInit {
  skipAuth?:    boolean;
  skipRefresh?: boolean;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  const { skipAuth = false, skipRefresh = false, ...rest } = opts;

  if (!skipAuth && !skipRefresh) {
    const ok = await ensureFresh();
    if (!ok) return { success: false, error: "Session expired. Please log in again.", code: "UNAUTHORIZED" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string> ?? {}),
  };
  if (!skipAuth && _accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
    if (res.status === 204) return { success: true, data: null as T };
    return await res.json() as ApiResult<T>;
  } catch {
    return { success: false, error: "Network error. Please check your connection.", code: "NETWORK_ERROR" };
  }
}

export const api = {
  get:    <T>(p: string, o?: RequestOptions)               => apiRequest<T>(p, { method: "GET",    ...o }),
  post:   <T>(p: string, b?: unknown, o?: RequestOptions)  => apiRequest<T>(p, { method: "POST",   body: b !== undefined ? JSON.stringify(b) : undefined, ...o }),
  put:    <T>(p: string, b?: unknown, o?: RequestOptions)  => apiRequest<T>(p, { method: "PUT",    body: b !== undefined ? JSON.stringify(b) : undefined, ...o }),
  patch:  <T>(p: string, b?: unknown, o?: RequestOptions)  => apiRequest<T>(p, { method: "PATCH",  body: b !== undefined ? JSON.stringify(b) : undefined, ...o }),
  delete: <T>(p: string, b?: unknown, o?: RequestOptions)  => apiRequest<T>(p, { method: "DELETE", body: b !== undefined ? JSON.stringify(b) : undefined, ...o }),
};