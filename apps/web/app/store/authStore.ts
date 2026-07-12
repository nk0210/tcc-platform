/**
 * TCC Auth Store — Phase Alpha
 *
 * Real JWT authentication via TCC API.
 * Access tokens stored in memory only (XSS-safe).
 * Refresh tokens in localStorage (Phase Alpha) — HttpOnly cookie upgrade later.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { api, setTokens, clearTokens, getStoredRefreshToken } from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

export type UserRole =
  | "NORMAL_USER"
  | "FOLLOWER_TRADER"
  | "VERIFIED_TRADER"
  | "MASTER_TRADER"
  | "MENTOR"
  | "ADMIN"
  | "OWNER";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED" | "DEACTIVATED";

export interface AuthUser {
  id:          string;
  tccId:       string;
  email:       string;
  handle:      string;
  displayName: string;
  avatarUrl:   string | null;
  roles:       UserRole[];
  status?:     UserStatus;
  isVerified?: boolean;
  /** Effective permission keys for this session — computed server-side. */
  permissions: string[];
}

interface AuthStore {
  user:          AuthUser | null;
  isLoading:     boolean;
  isInitialised: boolean;
  error:         string | null;

  register: (params: {
    email:       string;
    password:    string;
    handle:      string;
    displayName: string;
  }) => Promise<{ success: boolean; error?: string }>;

  login: (params: {
    email:    string;
    password: string;
  }) => Promise<{ success: boolean; error?: string }>;

  logout:     () => Promise<void>;
  logoutAll:  () => Promise<void>;
  initialise: () => Promise<void>;
  clearError: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user:          null,
      isLoading:     false,
      isInitialised: false,
      error:         null,

      clearError: () => set({ error: null }),

      initialise: async () => {
        if (get().isInitialised) return;

        const storedRefreshToken = getStoredRefreshToken();
        if (!storedRefreshToken) {
          set({ isInitialised: true });
          return;
        }

        set({ isLoading: true });
        try {
          const refreshRes = await api.post<{ tokens: { accessToken: string; refreshToken: string; expiresIn: number } }>(
            "/auth/refresh",
            { refreshToken: storedRefreshToken },
            { skipAuth: true, skipRefresh: true }
          );

          if (!refreshRes.success) {
            clearTokens();
            set({ user: null, isLoading: false, isInitialised: true });
            return;
          }

          setTokens(refreshRes.data.tokens);

          const meRes = await api.get<AuthUser>("/auth/me");
          if (meRes.success) {
            set({ user: meRes.data, isLoading: false, isInitialised: true });
          } else {
            clearTokens();
            set({ user: null, isLoading: false, isInitialised: true });
          }
        } catch {
          clearTokens();
          set({ user: null, isLoading: false, isInitialised: true });
        }
      },

      register: async ({ email, password, handle, displayName }) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post<{
            user:   AuthUser;
            tokens: { accessToken: string; refreshToken: string; expiresIn: number };
          }>("/auth/register", { email, password, handle, displayName }, { skipAuth: true });

          if (!res.success) {
            set({ isLoading: false, error: res.error });
            return { success: false, error: res.error };
          }

          setTokens(res.data.tokens);
          set({ user: res.data.user, isLoading: false, error: null });
          return { success: true };
        } catch {
          const error = "Registration failed. Please try again.";
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      login: async ({ email, password }) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post<{
            user:   AuthUser;
            tokens: { accessToken: string; refreshToken: string; expiresIn: number };
          }>("/auth/login", { email, password }, { skipAuth: true });

          if (!res.success) {
            set({ isLoading: false, error: res.error });
            return { success: false, error: res.error };
          }

          setTokens(res.data.tokens);
          set({ user: res.data.user, isLoading: false, error: null });
          return { success: true };
        } catch {
          const error = "Login failed. Please try again.";
          set({ isLoading: false, error });
          return { success: false, error };
        }
      },

      logout: async () => {
        const storedRefreshToken = getStoredRefreshToken();
        try {
          if (storedRefreshToken) {
            await api.delete("/auth/logout", { refreshToken: storedRefreshToken });
          }
        } catch {
          // ignore
        } finally {
          clearTokens();
          set({ user: null, error: null });
        }
      },

      logoutAll: async () => {
        try {
          await api.delete("/auth/logout-all");
        } catch {
          // ignore
        } finally {
          clearTokens();
          set({ user: null, error: null });
        }
      },
    }),
    {
      name:    "tcc-auth",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return localStorage;
      }),
      partialize: (state) => ({ user: state.user }),
    }
  )
);