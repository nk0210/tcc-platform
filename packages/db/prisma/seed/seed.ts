/**
 * TCC Database Seed — Phase Alpha RBAC Foundation
 *
 * Seeds:
 *   - Role rows (mirror UserRole enum)
 *   - Permission rows (canonical capability list)
 *   - RolePermission grants
 *   - Baseline SystemSetting rows
 *
 * Idempotent — safe to run multiple times (upsert-based).
 * Run via: pnpm --filter @tcc/db seed
 */
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

// ── Canonical permission registry ──────────────────────────────────────────
// IMPORTANT: keep this list in sync with
// apps/api/src/server/permissions/permissionRegistry.ts

interface PermissionSeed {
  key:         string;
  label:       string;
  description: string;
  category:    string;
}

const PERMISSION_SEED: PermissionSeed[] = [
  // user management
  { key: "user.suspend",        label: "Suspend User",          description: "Temporarily suspend a user account",        category: "user" },
  { key: "user.ban",            label: "Ban User",              description: "Permanently ban a user account",            category: "user" },
  { key: "user.reinstate",      label: "Reinstate User",        description: "Lift a suspension or ban on a user",        category: "user" },
  { key: "user.verify",         label: "Verify Trader",         description: "Mark a user as a verified trader",          category: "user" },
  { key: "user.changeRole",     label: "Change User Roles",     description: "Add or remove roles on a user account",     category: "user" },
  { key: "user.viewAuditLog",   label: "View Audit Log",        description: "View the platform-wide admin action log",   category: "user" },

  // community moderation
  { key: "community.post.delete",     label: "Delete Post",          description: "Permanently delete a community post",          category: "community" },
  { key: "community.post.hide",       label: "Hide Post",            description: "Hide a community post from public feeds",      category: "community" },
  { key: "community.comment.delete",  label: "Delete Comment",       description: "Permanently delete a community comment",       category: "community" },
  { key: "community.report.review",   label: "Review Reports",       description: "Mark a community report as under review",     category: "community" },
  { key: "community.report.resolve",  label: "Resolve Reports",      description: "Resolve or dismiss a community report",        category: "community" },

  // marketplace moderation
  { key: "marketplace.strategy.remove",  label: "Remove Strategy",      description: "Remove a strategy listing",          category: "marketplace" },
  { key: "marketplace.strategy.feature", label: "Feature Strategy",     description: "Feature a strategy on the marketplace", category: "marketplace" },
  { key: "marketplace.review.remove",    label: "Remove Strategy Review", description: "Remove a strategy review",          category: "marketplace" },

  // copy trading
  { key: "copy_trading.application.review",  label: "Review Master Applications", description: "Mark a master trader application under review", category: "copy_trading" },
  { key: "copy_trading.application.approve", label: "Approve Master Trader",      description: "Approve a master trader application",             category: "copy_trading" },
  { key: "copy_trading.application.reject",  label: "Reject Master Trader",       description: "Reject a master trader application",              category: "copy_trading" },
  { key: "copy_trading.master.suspend",      label: "Suspend Master Trader",      description: "Suspend an approved master trader",               category: "copy_trading" },
  { key: "copy_trading.master.remove",       label: "Remove Master Trader",       description: "Permanently remove a master trader",               category: "copy_trading" },

  // academy
  { key: "academy.course.create", label: "Create Course",  description: "Create a new academy course",  category: "academy" },
  { key: "academy.course.edit",   label: "Edit Course",    description: "Edit an existing academy course", category: "academy" },
  { key: "academy.course.remove", label: "Remove Course",  description: "Remove an academy course",      category: "academy" },

  // competition (future)
  { key: "competition.create",      label: "Create Competition",   description: "Create a new trading competition", category: "competition" },
  { key: "competition.manage",      label: "Manage Competition",   description: "Manage an active competition",     category: "competition" },
  { key: "competition.disqualify",  label: "Disqualify Competitor", description: "Disqualify a competitor",         category: "competition" },

  // admin / platform
  { key: "admin.notification.broadcast", label: "Send Admin Notification", description: "Send a notification to one or more users", category: "admin" },
  { key: "admin.settings.view",          label: "View System Settings",    description: "View platform system settings",            category: "admin" },
  { key: "admin.settings.edit",          label: "Edit System Settings",    description: "Edit platform system settings",            category: "admin" },
  { key: "admin.dashboard.access",       label: "Access Owner Dashboard",  description: "Access the /owner admin dashboard",        category: "admin" },
  { key: "system.audit.export",          label: "Export Audit Logs",       description: "Export the full audit log",                category: "admin" },
];

// ── Role → permission grants ────────────────────────────────────────────────

const ALL_KEYS = PERMISSION_SEED.map((p) => p.key);
const OWNER_ONLY_KEYS = ["admin.settings.edit", "system.audit.export"];

const ROLE_PERMISSION_SEED: Record<UserRole, string[]> = {
  OWNER:           ALL_KEYS,
  ADMIN:           ALL_KEYS.filter((k) => !OWNER_ONLY_KEYS.includes(k)),
  MENTOR:          ["academy.course.create", "academy.course.edit"],
  MASTER_TRADER:   [],
  VERIFIED_TRADER: [],
  FOLLOWER_TRADER: [],
  NORMAL_USER:     [],
};

const ROLE_LABELS: Record<UserRole, { label: string; description: string }> = {
  NORMAL_USER:     { label: "Trader",          description: "Default role for every registered user" },
  FOLLOWER_TRADER: { label: "Follower",         description: "A user actively following one or more master traders" },
  VERIFIED_TRADER: { label: "Verified Trader",  description: "A trader with a verified profile/performance foundation" },
  MASTER_TRADER:   { label: "Master Trader",    description: "An approved master trader on the copy trading marketplace" },
  MENTOR:          { label: "Mentor",           description: "A trusted educator with academy content permissions" },
  ADMIN:           { label: "Admin",            description: "Platform administrator with broad moderation powers" },
  OWNER:           { label: "Owner",            description: "Platform owner with unrestricted access" },
};

async function main() {
  console.log("🌱  Seeding TCC RBAC foundation...");

  // ── 1. Upsert roles ────────────────────────────────────────────────────
  const roleRows: Record<string, { id: string }> = {};
  for (const name of Object.keys(ROLE_LABELS) as UserRole[]) {
    const meta = ROLE_LABELS[name];
    const row = await prisma.role.upsert({
      where:  { name },
      create: { name, label: meta.label, description: meta.description, isSystem: true },
      update: { label: meta.label, description: meta.description },
    });
    roleRows[name] = { id: row.id };
    console.log(`   ✓ Role: ${name}`);
  }

  // ── 2. Upsert permissions ──────────────────────────────────────────────
  const permissionRows: Record<string, { id: string }> = {};
  for (const perm of PERMISSION_SEED) {
    const row = await prisma.permission.upsert({
      where:  { key: perm.key },
      create: { key: perm.key, label: perm.label, description: perm.description, category: perm.category },
      update: { label: perm.label, description: perm.description, category: perm.category },
    });
    permissionRows[perm.key] = { id: row.id };
  }
  console.log(`   ✓ ${PERMISSION_SEED.length} permissions upserted`);

  // ── 3. Upsert role → permission grants ─────────────────────────────────
  let grantCount = 0;
  for (const roleName of Object.keys(ROLE_PERMISSION_SEED) as UserRole[]) {
    const roleId = roleRows[roleName]!.id;
    const keys   = ROLE_PERMISSION_SEED[roleName];

    for (const key of keys) {
      const permissionId = permissionRows[key]?.id;
      if (!permissionId) {
        console.warn(`   ⚠ Permission key "${key}" not found — skipping grant for ${roleName}`);
        continue;
      }
      await prisma.rolePermission.upsert({
        where:  { roleId_permissionId: { roleId, permissionId } },
        create: { roleId, permissionId },
        update: {},
      });
      grantCount++;
    }
  }
  console.log(`   ✓ ${grantCount} role→permission grants applied`);

  // ── 4. Baseline system settings ────────────────────────────────────────
  const settings: { key: string; value: unknown; description: string }[] = [
    { key: "platform.maintenanceMode",              value: false, description: "When true, the platform shows a maintenance banner" },
    { key: "platform.registrationOpen",             value: true,  description: "Whether new user registration is open" },
    { key: "platform.paperTradingInitialBalance",   value: 10000, description: "Starting paper trading balance for new accounts" },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where:  { key: setting.key },
      create: { key: setting.key, value: setting.value as any, description: setting.description },
      update: {},
    });
  }
  console.log(`   ✓ ${settings.length} system settings seeded`);

  console.log("✅  Seed complete.");
}

main()
  .catch((err) => {
    console.error("❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });