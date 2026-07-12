import db from "../../lib/prisma";
import type { Prisma } from "@tcc/db";

export interface AuditLogInput {
  actorId:      string;
  actorHandle:  string;
  actorRole:    string;
  actionType:   string;
  targetType:   string;
  targetId:     string;
  targetUserId?: string;
  description:  string;
  reason?:      string;
  metadata?:    Prisma.InputJsonValue;
}

export const auditRepository = {
  create(input: AuditLogInput) {
    return db.adminActionLog.create({ data: input });
  },

  async list(params: { page: number; pageSize: number; actionType?: string; targetUserId?: string }) {
    const { page, pageSize, actionType, targetUserId } = params;
    const where = {
      ...(actionType    ? { actionType }    : {}),
      ...(targetUserId  ? { targetUserId }  : {}),
    };

    const [items, total] = await Promise.all([
      db.adminActionLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.adminActionLog.count({ where }),
    ]);

    return { items, total };
  },
};