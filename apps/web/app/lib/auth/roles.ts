/**
 * TCC Frontend Role & Permission Helpers — centralized.
 *
 * Per Phase Alpha spec: "Do NOT scatter role checks throughout the
 * application." Every role/permission decision in the frontend should
 * go through this file.
 *
 * IMPORTANT BUG FIX (discovered while building this):
 * Several Beta-era call sites (owner/layout.tsx, copy-trading/page.tsx)
 * called getEffectiveRole(user?.role) and isAdmin(...) against a
 * SINGULAR `user.role` property. The Phase Alpha authStore (Day 1)
 * only exposes `user.roles` (a PLURAL array) — `user.role` does not
 * exist on AuthUser. This made admin gating silently broken since
 * Day 1. This file now operates on the array, and the two call sites
 * have been patched to pass `user.roles`.
 *
 * Permissions are NOT hardcoded here. They come from the server
 * (`user.permissions`, populated by /auth/login, /auth/register, and
 * /auth/me — see authStore.ts). The DB (Role/Permission/RolePermission
 * tables) remains the single source of truth for grants.
 */
import type { AuthUser, UserRole } from "@/store/authStore";

// ── Dev override (QA convenience — Beta-era localStorage convention) ───────
// Usage in browser console: localStorage.setItem('tcc:dev:role', 'OWNER')
// Only active outside production builds.

const DEV_ROLE_KEY = "tcc:dev:role";

function getDevRoleOverride(): UserRole | null {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(DEV_ROLE_KEY);
    if (!stored) return null;
    const upper = stored.toUpperCase() as UserRole;
    if (ROLE_PRIORITY.includes(upper)) return upper;
    return null;
  } catch {
    return null;
  }
}

// ── Role priority (highest authority first) ────────────────────────────────

export const ROLE_PRIORITY: UserRole[] = [
  "OWNER",
  "ADMIN",
  "MENTOR",
  "MASTER_TRADER",
  "VERIFIED_TRADER",
  "FOLLOWER_TRADER",
  "NORMAL_USER",
];

export const ROLE_LABELS: Record<UserRole, string> = {
  NORMAL_USER:     "Trader",
  FOLLOWER_TRADER: "Follower",
  VERIFIED_TRADER: "Verified Trader",
  MASTER_TRADER:   "Master Trader",
  MENTOR:          "Mentor",
  ADMIN:           "Admin",
  OWNER:           "Owner",
};

const ADMIN_ROLES: UserRole[] = ["ADMIN", "OWNER"];

// ── Core helpers ─────────────────────────────────────────────────────────

/**
 * Returns the single highest-priority role out of a user's role array,
 * for display purposes (e.g. badge text). Applies the dev override if
 * one is set (development only).
 *
 * Accepts undefined/empty arrays gracefully — returns NORMAL_USER.
 */
export function getEffectiveRole(roles: UserRole[] | undefined | null): UserRole {
  const override = getDevRoleOverride();
  if (override) return override;

  if (!roles || roles.length === 0) return "NORMAL_USER";
  for (const candidate of ROLE_PRIORITY) {
    if (roles.includes(candidate)) return candidate;
  }
  return "NORMAL_USER";
}

/** True if the role array contains the given role (no dev override). */
export function hasRole(roles: UserRole[] | undefined | null, role: UserRole): boolean {
  return !!roles?.includes(role);
}

/**
 * True if the user has ADMIN or OWNER, accounting for the dev override.
 * Accepts either a role array or a single already-resolved role.
 */
export function isAdmin(roleOrRoles: UserRole | UserRole[] | undefined | null): boolean {
  const override = getDevRoleOverride();
  if (override) return ADMIN_ROLES.includes(override);

  if (!roleOrRoles) return false;
  if (Array.isArray(roleOrRoles)) return roleOrRoles.some((r) => ADMIN_ROLES.includes(r));
  return ADMIN_ROLES.includes(roleOrRoles);
}

/** True if the user has OWNER specifically, accounting for the dev override. */
export function isOwner(roleOrRoles: UserRole | UserRole[] | undefined | null): boolean {
  const override = getDevRoleOverride();
  if (override) return override === "OWNER";

  if (!roleOrRoles) return false;
  if (Array.isArray(roleOrRoles)) return roleOrRoles.includes("OWNER");
  return roleOrRoles === "OWNER";
}

/**
 * True if the user's session-derived permissions include the given key.
 * Permissions come from the server (user.permissions) — never hardcoded.
 */
export function hasPermission(user: AuthUser | null | undefined, key: string): boolean {
  if (!user) return false;
  // Dev override grants everything for convenience during local QA
  if (getDevRoleOverride()) return true;
  return user.permissions?.includes(key) ?? false;
}

export function hasAnyPermission(user: AuthUser | null | undefined, keys: string[]): boolean {
  if (!user) return false;
  if (getDevRoleOverride()) return true;
  return keys.some((k) => user.permissions?.includes(k));
}