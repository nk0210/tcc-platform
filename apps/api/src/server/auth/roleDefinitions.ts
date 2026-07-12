/**
 * TCC Role Definitions — display/priority metadata ONLY.
 *
 * This file does NOT define permission grants. Grants live in the
 * database (Role/Permission/RolePermission tables, seeded by
 * packages/db/prisma/seed/seed.ts) and are read at runtime by
 * permissionService.ts. This avoids having two sources of truth
 * for "what can this role do."
 *
 * This file exists purely for:
 *   - Human-readable labels (admin UI, logs)
 *   - Role priority ordering (which role "wins" for display purposes
 *     when a user has multiple roles)
 */
import type { UserRole } from "@tcc/db";

export const ROLE_LABELS: Record<UserRole, string> = {
  NORMAL_USER:     "Trader",
  FOLLOWER_TRADER: "Follower",
  VERIFIED_TRADER: "Verified Trader",
  MASTER_TRADER:   "Master Trader",
  MENTOR:          "Mentor",
  ADMIN:           "Admin",
  OWNER:           "Owner",
};

/**
 * Priority order — highest authority first.
 * Used by getEffectiveRole() to pick a single "display role" out of
 * a user's role array.
 */
export const ROLE_PRIORITY: UserRole[] = [
  "OWNER",
  "ADMIN",
  "MENTOR",
  "MASTER_TRADER",
  "VERIFIED_TRADER",
  "FOLLOWER_TRADER",
  "NORMAL_USER",
];

export function getHighestPriorityRole(roles: UserRole[]): UserRole {
  for (const candidate of ROLE_PRIORITY) {
    if (roles.includes(candidate)) return candidate;
  }
  return "NORMAL_USER";
}

export const ADMIN_ROLES: UserRole[] = ["ADMIN", "OWNER"];

export function isAdminRole(roles: UserRole[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

export function isOwnerRole(roles: UserRole[]): boolean {
  return roles.includes("OWNER");
}