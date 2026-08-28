import {
  notificationRepository,
  type CreateNotificationInput,
} from "../repositories/notificationRepository";
import { broadcastNotificationToUser } from "../../websocket/notificationBroadcaster";

export async function createNotification(input: CreateNotificationInput) {
  const created = await notificationRepository.create(input);
  broadcastNotificationToUser(input.userId, created);
  return created;
}

export async function createBroadcastNotification(
  userIds: string[],
  payload: Omit<CreateNotificationInput, "userId">
) {
  return notificationRepository.createMany(
    userIds.map((userId) => ({ ...payload, userId }))
  );
}

export async function listNotifications(
  userId: string,
  params: { page: number; pageSize: number; unreadOnly?: boolean }
) {
  const [items, total] = await notificationRepository.findForUser(userId, params);
  const totalPages = Math.ceil(total / params.pageSize);
  return {
    items,
    total,
    page:       params.page,
    pageSize:   params.pageSize,
    totalPages,
    hasNext:    params.page < totalPages,
    hasPrev:    params.page > 1,
  };
}

export async function markAsRead(id: string, userId: string) {
  return notificationRepository.markRead(id, userId);
}

export async function markAllAsRead(userId: string) {
  return notificationRepository.markAllRead(userId);
}

export async function deleteNotification(id: string, userId: string) {
  return notificationRepository.remove(id, userId);
}

export async function getUnreadCount(userId: string) {
  return notificationRepository.unreadCount(userId);
}
