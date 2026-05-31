import { create } from "zustand";

export type NotificationType =
  | "price_alert"
  | "risk_warning"
  | "copy_trade"
  | "competition"
  | "journal_prompt"
  | "news"
  | "academy"
  | "community"
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  timestamp: Date;
  action?: { label: string; path: string };
  priority: "low" | "medium" | "high" | "critical";
}

const mockNotifications: Notification[] = [
  {
    id: "n1", type: "risk_warning", priority: "critical",
    title: "⚠ Risk Score: EXTREME",
    message: "Your risk score hit 82/100. You have 5 open positions and CPI releases in 18 minutes. Consider closing some trades.",
    read: false, timestamp: new Date(Date.now() - 600000),
    action: { label: "View Risk", path: "/" },
  },
  {
    id: "n2", type: "copy_trade", priority: "high",
    title: "📡 Copy Trade Executed",
    message: "goldsniper_fx opened BUY XAUUSD 0.5 lots. Your copy: 0.05 lots at $2,334.50.",
    read: false, timestamp: new Date(Date.now() - 1800000),
    action: { label: "View Trade", path: "/copy-trading" },
  },
  {
    id: "n3", type: "competition", priority: "medium",
    title: "🏆 Leaderboard Update",
    message: "You moved from #8 to #6 in TCC May Sprint 2026! goldsniper_fx still leads at +34.5%.",
    read: false, timestamp: new Date(Date.now() - 3600000),
    action: { label: "View Leaderboard", path: "/competition" },
  },
  {
    id: "n4", type: "news", priority: "high",
    title: "📰 High-Impact News Alert",
    message: "US CPI data releases in 30 minutes. You have 2 USD-exposed positions open. Consider managing risk.",
    read: false, timestamp: new Date(Date.now() - 7200000),
    action: { label: "View Calendar", path: "/news" },
  },
  {
    id: "n5", type: "journal_prompt", priority: "low",
    title: "📓 Journal Reminder",
    message: "You placed 3 trades today but only journaled 1. Log your emotions while they're fresh.",
    read: true, timestamp: new Date(Date.now() - 10800000),
    action: { label: "Open Journal", path: "/journal" },
  },
  {
    id: "n6", type: "academy", priority: "low",
    title: "🎓 New Course Available",
    message: "risk_master_99 published 'Advanced Drawdown Recovery Strategies'. Recommended based on your trading patterns.",
    read: true, timestamp: new Date(Date.now() - 21600000),
    action: { label: "View Course", path: "/academy" },
  },
  {
    id: "n7", type: "community", priority: "low",
    title: "👥 goldsniper_fx liked your post",
    message: "Your BTCUSDT breakout analysis got 12 likes and 3 comments from the community.",
    read: true, timestamp: new Date(Date.now() - 43200000),
    action: { label: "View Post", path: "/community" },
  },
  {
    id: "n8", type: "price_alert", priority: "medium",
    title: "💰 Price Alert — XAUUSD",
    message: "XAUUSD reached your alert level of $2,350. Current price: $2,352.80",
    read: true, timestamp: new Date(Date.now() - 86400000),
    action: { label: "Open Chart", path: "/" },
  },
  {
    id: "n9", type: "copy_trade", priority: "medium",
    title: "📡 Copy Trade Closed — P&L: +$13.57",
    message: "goldsniper_fx closed BUY XAUUSD. Your copy trade result: +$13.57 (+1.36%)",
    read: true, timestamp: new Date(Date.now() - 86400000 * 2),
    action: { label: "View History", path: "/copy-trading" },
  },
  {
    id: "n10", type: "system", priority: "low",
    title: "✅ TCC System Update",
    message: "New features added: Strategy Marketplace, Playbook builder, and Economic Calendar. Check them out!",
    read: true, timestamp: new Date(Date.now() - 86400000 * 3),
  },
];

const typeIcons: Record<NotificationType, string> = {
  price_alert: "💰",
  risk_warning: "⚠",
  copy_trade: "📡",
  competition: "🏆",
  journal_prompt: "📓",
  news: "📰",
  academy: "🎓",
  community: "👥",
  system: "✅",
};

const priorityColors: Record<string, string> = {
  critical: "border-l-red-500 bg-red-500/3",
  high: "border-l-amber-500 bg-amber-500/3",
  medium: "border-l-blue-500 bg-blue-500/3",
  low: "border-l-white/10",
};

export { typeIcons, priorityColors };

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  deleteNotification: (id: string) => void;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: mockNotifications,
  unreadCount: mockNotifications.filter(n => !n.read).length,

  markRead: (id) => set((state) => {
    const updated = state.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    return { notifications: updated, unreadCount: updated.filter(n => !n.read).length };
  }),

  markAllRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  deleteNotification: (id) => set((state) => {
    const updated = state.notifications.filter(n => n.id !== id);
    return { notifications: updated, unreadCount: updated.filter(n => !n.read).length };
  }),

  addNotification: (notification) => set((state) => {
    const newN: Notification = { ...notification, id: Date.now().toString(), timestamp: new Date(), read: false };
    const updated = [newN, ...state.notifications];
    return { notifications: updated, unreadCount: updated.filter(n => !n.read).length };
  }),
}));