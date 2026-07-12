/**
 * TCC User Repository — data-access layer for User.
 *
 * Repositories own all direct Prisma calls for a given model. Services
 * (server/services/*) call repositories and add business rules, audit
 * logging, and notification side-effects on top. Routes call services,
 * never repositories directly, and never call Prisma directly.
 *
 * This file establishes the pattern; not every model has a repository
 * yet (trades/journal still query Prisma directly in their routes from
 * Day 1 — migrating those is a future Alpha day, not a regression).
 */
import db from "../../lib/prisma";
import type { UserRole, UserStatus } from "@tcc/db";

export const userRepository = {
  findById(id: string) {
    return db.user.findUnique({ where: { id } });
  },

  findByHandle(handle: string) {
    return db.user.findUnique({ where: { handle } });
  },

  findByEmail(email: string) {
    return db.user.findUnique({ where: { email } });
  },

  async list(params: { page: number; pageSize: number; search?: string }) {
    const { page, pageSize, search } = params;
    const where = search
      ? {
          OR: [
            { handle:      { contains: search, mode: "insensitive" as const } },
            { email:       { contains: search, mode: "insensitive" as const } },
            { displayName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, tccId: true, email: true, handle: true, displayName: true,
          roles: true, status: true, isVerified: true, isActive: true,
          isSuspended: true, createdAt: true, lastLoginAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.user.count({ where }),
    ]);

    return { items, total };
  },

  updateStatus(id: string, status: UserStatus, flags: { isActive?: boolean; isSuspended?: boolean }) {
    return db.user.update({
      where: { id },
      data:  { status, ...flags },
    });
  },

  updateRoles(id: string, roles: UserRole[]) {
    return db.user.update({ where: { id }, data: { roles } });
  },

  setVerified(id: string, isVerified: boolean) {
    return db.user.update({ where: { id }, data: { isVerified } });
  },

  touchLastLogin(id: string) {
    return db.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },
};