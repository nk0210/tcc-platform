import db from "../../lib/prisma";
import type { NotificationType, NotificationPriority } from "@tcc/db";

export interface CreateNotificationInput {
  userId:      string;
  type:        NotificationType;
  priority?:   NotificationPriority;
  title:       string;
  message:     string;
  actionLabel?: string;
  actionPath?:  string;
}

export const notificationRepository = {
  create(input: CreateNotificationInput) {
    return db.notification.create({
      data: {
        userId:      input.userId,
        type:        input.type,
        priority:    input.priority ?? "LOW",
        title:       input.title,
        message:     input.message,
        actionLabel: input.actionLabel ?? null,
        actionPath:  input.actionPath  ?? null,
      },
    });
  },

  createMany(inputs: CreateNotificationInput[]) {
    return db.notification.createMany({
      data: inputs.map((i) => ({
        userId:      i.userId,
        type:        i.type,
        priority:    i.priority ?? "LOW",
        title:       i.title,
        message:     i.message,
        actionLabel: i.actionLabel ?? null,
        actionPath:  i.actionPath  ?? null,
      })),
    });
  },

  findForUser(userId: string, params: { page: number; pageSize: number; unreadOnly?: boolean }) {
    const { page, pageSize, unreadOnly } = params;
    const where = { userId, ...(unreadOnly ? { read: false } : {}) };

    return Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.notification.count({ where }),
    ]);
  },

  markRead(id: string, userId: string) {
    return db.notification.updateMany({
      where: { id, userId },
      data:  { read: true },
    });
  },

  markAllRead(userId: string) {
    return db.notification.updateMany({
      where: { userId, read: false },
      data:  { read: true },
    });
  },

  remove(id: string, userId: string) {
    return db.notification.deleteMany({ where: { id, userId } });
  },

  unreadCount(userId: string) {
    return db.notification.count({ where: { userId, read: false } });
  },
};