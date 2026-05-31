/**
 * TCC Role-Based Access Control
 * Phase 1: Local prototype — roles checked from authStore + localStorage dev override
 * Phase 2: Backend JWT claims (requires real auth server)
 *
 * To test owner access locally:
 * Open browser console → localStorage.setItem('tcc:dev:role', 'owner') → refresh
 */

export type UserRole =
  | "user"
  | "owner"
  | "admin"
  | "moderator"
  | "risk_reviewer"
  | "support_agent";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  support_agent: 1,
  risk_reviewer: 2,
  moderator: 3,
  admin: 4,
  owner: 5,
};

export function hasRole(userRole: UserRole | undefined | null, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  return (ROLE_HIERARCHY[userRole] ?? 0) >= ROLE_HIERARCHY[requiredRole];
}

export function isOwner(role?: UserRole | string | null): boolean {
  return role === "owner";
}

export function isAdmin(role?: UserRole | string | null): boolean {
  return hasRole(role as UserRole, "admin");
}

export function canModerate(role?: UserRole | string | null): boolean {
  return hasRole(role as UserRole, "moderator");
}

export function canReviewRisk(role?: UserRole | string | null): boolean {
  return hasRole(role as UserRole, "risk_reviewer");
}

export function canSupportUsers(role?: UserRole | string | null): boolean {
  return hasRole(role as UserRole, "support_agent");
}

export function getDevRole(): UserRole | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const devRole = localStorage.getItem("tcc:dev:role");
    if (devRole && Object.keys(ROLE_HIERARCHY).includes(devRole)) {
      return devRole as UserRole;
    }
  } catch {}
  return undefined;
}

export function getEffectiveRole(storeRole?: string | null): UserRole | undefined {
  const devRole = getDevRole();
  if (devRole) return devRole;
  if (storeRole && Object.keys(ROLE_HIERARCHY).includes(storeRole)) return storeRole as UserRole;
  return "user";
}