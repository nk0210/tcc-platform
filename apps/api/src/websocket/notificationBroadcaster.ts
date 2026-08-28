/**
 * Notification Broadcaster
 * Bridge between the notification service and the WebSocket layer.
 * Imports FROM connectionManager but is NOT imported BY it — no circular
 * dependency between this module and connectionManager.ts.
 */
import { send } from "./connectionManager";

export function broadcastNotificationToUser(
  userId: string,
  notification: {
    id:           string;
    type:         string;
    priority:     string;
    title:        string;
    message:      string;
    actionLabel?: string | null;
    actionPath?:  string | null;
    createdAt:    Date;
  }
): void {
  // Fire-and-forget — send() already no-ops if the user isn't connected.
  send(userId, {
    type: "NOTIFICATION",
    payload: {
      id:          notification.id,
      type:        notification.type,
      priority:    notification.priority,
      title:       notification.title,
      message:     notification.message,
      actionLabel: notification.actionLabel ?? null,
      actionPath:  notification.actionPath  ?? null,
      createdAt:   notification.createdAt.toISOString(),
    },
  });
}
