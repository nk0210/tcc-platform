/**
 * TCC Permission Service — DB-backed, in-memory cached RBAC engine.
 *
 * Source of truth: Role / Permission / RolePermission tables.
 * Cache: a Map<UserRole, Set<PermissionKey>> built once at boot and
 * refreshed on demand. This avoids a DB round-trip on every permission
 * check while keeping the DB as the single source of truth for grants.
 */
import db from "../../lib/prisma";
import type { UserRole } from "@tcc/db";
import type { PermissionKey } from "./permissionRegistry";

let cache: Map<UserRole, Set<string>> | null = null;
let isLoading: Promise<void> | null = null;

/**
 * Load (or reload) the Role → Permission grant map from the database
 * into memory. Called once at API boot, and can be called again after
 * any Role/Permission/RolePermission mutation (none exist yet via UI —
 * future admin settings screen will call this).
 */
export async function refreshPermissionCache(): Promise<void> {
  const roles = await db.role.findMany({
    include: { permissions: { include: { permission: true } } },
  });

  const next = new Map<UserRole, Set<string>>();
  for (const role of roles) {
    const keys = new Set(role.permissions.map((rp) => rp.permission.key));
    next.set(role.name, keys);
  }

  cache = next;
}

async function ensureCacheLoaded(): Promise<void> {
  if (cache) return;
  if (isLoading) { await isLoading; return; }
  isLoading = refreshPermissionCache().finally(() => { isLoading = null; });
  await isLoading;
}

/**
 * Returns true if ANY of the user's roles grants the given permission.
 */
export async function hasPermission(
  roles: UserRole[],
  key: PermissionKey | string
): Promise<boolean> {
  await ensureCacheLoaded();
  if (!cache) return false;
  return roles.some((role) => cache!.get(role)?.has(key) ?? false);
}

/**
 * Returns the union of all permission keys granted across the user's
 * roles. Used to populate the `permissions` field returned by
 * /auth/login, /auth/register, and /auth/me.
 */
export async function getEffectivePermissions(roles: UserRole[]): Promise<string[]> {
  await ensureCacheLoaded();
  if (!cache) return [];
  const union = new Set<string>();
  for (const role of roles) {
    const set = cache.get(role);
    if (set) for (const key of set) union.add(key);
  }
  return Array.from(union);
}

/** Used at API boot to warm the cache before accepting traffic. */
export async function warmPermissionCache(): Promise<void> {
  await refreshPermissionCache();
  console.log(`✅  Permission cache loaded (${cache?.size ?? 0} roles)`);
}