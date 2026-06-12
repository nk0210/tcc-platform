/**
 * TCC Notification Store
 *
 * Fix: ID generation changed from Date.now().toString() to crypto.randomUUID()
 * to prevent duplicate key errors in notifications/page.tsx when multiple
 * notifications are added within the same millisecond.
 *
 * NotificationType union expanded to include all values used across TCC modules:
 * system, academy, copy_trade, community, report_update, trade, price_alert
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

// ── Types ─────────────────────────────────────────────────────────────────

export type NotificationType =
  | "system"
  | "academy"
  | "copy_trade"
  | "community"
  | "report_update"
  | "trade"
  | "price_alert";

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface TNotification {
  id:        string;
  type:      NotificationType;
  priority:  NotificationPriority;
  title:     string;
  message:   string;
  action?:   { label: string; path: string };
  read:      boolean;
  createdAt: number;
}

// ── Unique ID helper ──────────────────────────────────────────────────────
// Uses crypto.randomUUID when available (all modern browsers + Node ≥ 19).
// Falls back to a timestamp+random composite that is sufficiently unique for
// a localStorage-only prototype and never collides within the same session.

function generateNotificationId(): string {
  if (
    typeof crypto !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (crypto as any).randomUUID === "function"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (crypto as any).randomUUID() as string;
  }
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ── Store interface ───────────────────────────────────────────────────────

interface NotificationStore {
  notifications: TNotification[];

  addNotification: (params: {
    type:     NotificationType;
    priority: NotificationPriority;
    title:    string;
    message:  string;
    action?:  { label: string; path: string };
  }) => void;

  markAsRead:         (id: string) => void;
  markAllAsRead:      ()           => void;
  deleteNotification: (id: string) => void;
  clearAll:           ()           => void;
  unreadCount:        ()           => number;
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: ({ type, priority, title, message, action }) => {
        const notification: TNotification = {
          id:        generateNotificationId(),
          type,
          priority,
          title,
          message,
          action,
          read:      false,
          createdAt: Date.now(),
        };
        set((state) => ({
          // Keep latest 200 notifications max
          notifications: [notification, ...state.notifications].slice(0, 200),
        }));
      },

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

      deleteNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearAll: () => set({ notifications: [] }),

      unreadCount: () =>
        get().notifications.filter((n) => !n.read).length,
    }),
    {
      name:    "notifications",
      storage: createJSONStorage(() => getUserScopedStorage("notifications")),
    }
  )
);