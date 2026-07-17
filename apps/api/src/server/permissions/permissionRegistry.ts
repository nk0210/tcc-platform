/**
 * Canonical list of permission keys.
 * Must stay in sync with packages/db/prisma/seed/seed.ts.
 * All keys are plain strings — never Prisma enums.
 */

export const PERMISSION_KEYS = [
  "user.suspend",
  "user.ban",
  "user.reinstate",
  "user.verify",
  "user.changeRole",
  "user.viewAuditLog",
  "community.post.delete",
  "community.post.hide",
  "community.comment.delete",
  "community.report.review",
  "community.report.resolve",
  "marketplace.strategy.remove",
  "marketplace.strategy.feature",
  "marketplace.review.remove",
  "copy_trading.application.review",
  "copy_trading.application.approve",
  "copy_trading.application.reject",
  "copy_trading.master.suspend",
  "copy_trading.master.remove",
  "academy.course.create",
  "academy.course.edit",
  "academy.course.remove",
  "competition.create",
  "competition.manage",
  "competition.disqualify",
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