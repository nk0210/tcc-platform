/**
 * In-memory permission cache backed by the database.
 *
 * Roles are plain strings throughout. The cache is a Map<string, Set<string>>
 * where key = role name string, value = set of permission key strings.
 * No Prisma enums imported here.
 */
import db from "../../lib/prisma";

let cache: Map<string, Set<string>> | null = null;
let loading: Promise<void> | null = null;

export async function refreshPermissionCache(): Promise<void> {
  const roles = await db.role.findMany({
    include: { permissions: { include: { permission: true } } },
  });

  const next = new Map<string, Set<string>>();
  for (const role of roles) {
    next.set(
      role.name as string,
      new Set(role.permissions.map((rp) => rp.permission.key))
    );
  }
  cache = next;
}

async function ensureCache(): Promise<void> {
  if (cache) return;
  if (loading) { await loading; return; }
  loading = refreshPermissionCache().finally(() => { loading = null; });
  await loading;
}

/**
 * Returns true if ANY of the user's roles grants the given permission key.
 */
export async function hasPermission(roles: string[], key: string): Promise<boolean> {
  await ensureCache();
  if (!cache) return false;
  return roles.some((r) => cache!.get(r)?.has(key) ?? false);
}

/**
 * Returns the union of all permission keys across the user's roles.
 */
export async function getEffectivePermissions(roles: string[]): Promise<string[]> {
  await ensureCache();
  if (!cache) return [];
  const union = new Set<string>();
  for (const role of roles) {
    const set = cache.get(role);
    if (set) for (const key of set) union.add(key);
  }
  return Array.from(union);
}

export async function warmPermissionCache(): Promise<void> {
  await refreshPermissionCache();
  console.log(`✅  Permission cache warmed (${cache?.size ?? 0} roles)`);
}