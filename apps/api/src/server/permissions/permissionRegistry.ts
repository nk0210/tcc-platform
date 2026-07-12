/**
 * TCC Permission Registry — canonical list of valid permission keys.
 *
 * This is a TYPE-SAFETY mirror of the permission keys seeded into the
 * database by packages/db/prisma/seed/seed.ts. The seed script is the
 * source of truth for WHICH permissions exist and what they grant;
 * this file exists so route code gets compile-time checking and
 * autocomplete when calling requirePermission("...").
 *
 * IMPORTANT: If you add a permission here, you MUST also add it to
 * the PERMISSION_SEED array in packages/db/prisma/seed/seed.ts and
 * re-run the seed (`pnpm --filter @tcc/db seed`).
 */

export const PERMISSION_KEYS = [
  // user management
  "user.suspend",
  "user.ban",
  "user.reinstate",
  "user.verify",
  "user.changeRole",
  "user.viewAuditLog",

  // community moderation
  "community.post.delete",
  "community.post.hide",
  "community.comment.delete",
  "community.report.review",
  "community.report.resolve",

  // marketplace moderation
  "marketplace.strategy.remove",
  "marketplace.strategy.feature",
  "marketplace.review.remove",

  // copy trading
  "copy_trading.application.review",
  "copy_trading.application.approve",
  "copy_trading.application.reject",
  "copy_trading.master.suspend",
  "copy_trading.master.remove",

  // academy
  "academy.course.create",
  "academy.course.edit",
  "academy.course.remove",

  // competition (future)
  "competition.create",
  "competition.manage",
  "competition.disqualify",

  // admin / platform
  "admin.notification.broadcast",
  "admin.settings.view",
  "admin.settings.edit",
  "admin.dashboard.access",
  "system.audit.export",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isValidPermissionKey(key: string): key is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(key);
}