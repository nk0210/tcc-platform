/**
 * TCC Auth Store — Phase Alpha
 * Real JWT auth via TCC API. Access tokens in memory. Refresh in localStorage.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  api,
  setTokens,
  clearTokens,
  getStoredRefreshToken,
} from "@/lib/api/client";

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

export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PROFESSIONAL";

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
  experienceLevel?: ExperienceLevel;
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

// ── Token response shape ──────────────────────────────────────────────────

interface TokenSet {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
}

interface AuthResponse {
  user:   AuthUser;
  tokens: TokenSet;
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

      // ── Restore session from stored refresh token on app mount ──────────
      initialise: async () => {
        if (get().isInitialised) return;

        const rt = getStoredRefreshToken();
        if (!rt) {
          set({ isInitialised: true });
          return;
        }

        set({ isLoading: true });
        try {
          const refreshRes = await api.post<{ tokens: TokenSet }>(
            "/auth/refresh",
            { refreshToken: rt },
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

      // ── Register ─────────────────────────────────────────────────────────
      register: async ({ email, password, handle, displayName }) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post<AuthResponse>(
            "/auth/register",
            { email, password, handle, displayName },
            { skipAuth: true }
          );

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

      // ── Login ─────────────────────────────────────────────────────────────
      login: async ({ email, password }) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post<AuthResponse>(
            "/auth/login",
            { email, password },
            { skipAuth: true }
          );

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

      // ── Logout ────────────────────────────────────────────────────────────
      logout: async () => {
        const rt = getStoredRefreshToken();
        try {
          if (rt) await api.delete("/auth/logout", { refreshToken: rt });
        } catch {
          // ignore network errors on logout
        } finally {
          clearTokens();
          set({ user: null, error: null });
        }
      },

      // ── Logout all devices ────────────────────────────────────────────────
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
      // Persist ONLY the user object — tokens handled by lib/api/client.ts
      partialize: (state) => ({ user: state.user }),
    }
  )
);