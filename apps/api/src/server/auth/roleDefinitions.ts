/**
 * Role metadata — display labels and priority order ONLY.
 * No permission grants defined here. Grants live in the database.
 * No Prisma imports — roles are plain strings.
 */

export type TccRole =
  | "NORMAL_USER"
  | "FOLLOWER_TRADER"
  | "VERIFIED_TRADER"
  | "MASTER_TRADER"
  | "MENTOR"
  | "ADMIN"
  | "OWNER";

export const ROLE_LABELS: Record<TccRole, string> = {
  NORMAL_USER:     "Trader",
  FOLLOWER_TRADER: "Follower",
  VERIFIED_TRADER: "Verified Trader",
  MASTER_TRADER:   "Master Trader",
  MENTOR:          "Mentor",
  ADMIN:           "Admin",
  OWNER:           "Owner",
};

/** Highest priority first — used to pick a single display role */
export const ROLE_PRIORITY: TccRole[] = [
  "OWNER",
  "ADMIN",
  "MENTOR",
  "MASTER_TRADER",
  "VERIFIED_TRADER",
  "FOLLOWER_TRADER",
  "NORMAL_USER",
];

const ADMIN_ROLES: TccRole[] = ["ADMIN", "OWNER"];

export function getHighestRole(roles: string[]): TccRole {
  for (const candidate of ROLE_PRIORITY) {
    if (roles.includes(candidate)) return candidate;
  }
  return "NORMAL_USER";
}

export function isAdminRole(roles: string[]): boolean {
  return roles.some((r) => (ADMIN_ROLES as string[]).includes(r));
}