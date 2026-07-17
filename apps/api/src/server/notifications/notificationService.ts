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