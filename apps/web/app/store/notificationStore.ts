import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

export type NotificationType =
  | "price_alert"
  | "risk_warning"
  | "copy_trade"
  | "competition"
  | "journal_prompt"
  | "news"
  | "academy"
  | "community"
  | "system"
  | "report_update";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  timestamp: number;
  action?: { label: string; path: string };
  priority: "low" | "medium" | "high" | "critical";
}

export const typeIcons: Record<NotificationType, string> = {
  price_alert: "💰",
  risk_warning: "⚠",
  copy_trade: "📡",
  competition: "🏆",
  journal_prompt: "📓",
  news: "📰",
  academy: "🎓",
  community: "👥",
  system: "✅",
  report_update: "🚨",
};

export const priorityColors: Record<string, string> = {
  critical: "border-l-red-500 bg-red-500/3",
  high: "border-l-amber-500 bg-amber-500/3",
  medium: "border-l-blue-500 bg-blue-500/3",
  low: "border-l-white/10",
};

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  deleteNotification: (id: string) => void;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      markRead: (id) => {
        const updated = get().notifications.map(n => n.id === id ? { ...n, read: true } : n);
        set({ notifications: updated, unreadCount: updated.filter(n => !n.read).length });
      },

      markAllRead: () => set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      })),

      deleteNotification: (id) => {
        const updated = get().notifications.filter(n => n.id !== id);
        set({ notifications: updated, unreadCount: updated.filter(n => !n.read).length });
      },

      addNotification: (notification) => {
        const newN: Notification = {
          ...notification,
          id: Date.now().toString(),
          timestamp: Date.now(),
          read: false,
        };
        const updated = [newN, ...get().notifications];
        set({ notifications: updated, unreadCount: updated.filter(n => !n.read).length });
      },

      clearAll: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: "notifications",
      storage: createJSONStorage(() => getUserScopedStorage("notifications")),
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 100), // keep last 100
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.unreadCount = state.notifications.filter(n => !n.read).length;
        }
      },
    }
  )
);