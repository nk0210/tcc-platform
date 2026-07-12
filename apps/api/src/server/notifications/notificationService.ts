/**
 * TCC Notification Service — backend architecture only.
 *
 * Per Phase Alpha spec: "Do NOT build final UI notification features
 * yet." This service provides the reusable functions UI/routes will
 * eventually call:
 *
 *   createNotification()
 *   markAsRead()
 *   markAllAsRead()
 *   deleteNotification()
 */
import {
  notificationRepository,
  type CreateNotificationInput,
} from "../repositories/notificationRepository";

export async function createNotification(input: CreateNotificationInput) {
  return notificationRepository.create(input);
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
  return { items, total };
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