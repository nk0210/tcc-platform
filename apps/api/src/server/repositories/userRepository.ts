import db from "../../lib/prisma";
import { type UserRole, type UserStatus } from "@prisma/client";

export const userRepository = {
  findById(id: string) {
    return db.user.findUnique({ where: { id } });
  },

  findByEmail(email: string) {
    return db.user.findUnique({ where: { email } });
  },

  findByHandle(handle: string) {
    return db.user.findUnique({ where: { handle } });
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
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      db.user.count({ where }),
    ]);

    return { items, total };
  },

  updateStatus(id: string, status: UserStatus, flags: { isActive?: boolean; isSuspended?: boolean }) {
    return db.user.update({ where: { id }, data: { status, ...flags } });
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