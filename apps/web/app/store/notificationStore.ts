/**
 * TCC Notification Store — Phase Alpha
 * API-backed. Real-time updates are pushed in via addNotification(), called by
 * the WebSocket client on a NOTIFICATION message (see lib/websocket/client.ts).
 *
 * NotificationType / NotificationPriority stay as the original lowercase unions
 * for backward compatibility with existing components — the mapper below
 * lowercases the uppercase enum values the API returns.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

export type NotificationType =
  | "system"
  | "academy"
  | "copy_trade"
  | "community"
  | "marketplace"
  | "competition"
  | "admin"
  | "report_update"
  | "trade"
  | "price_alert"
  | "journal_prompt"
  | "risk_warning";

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface TNotification {
  id:          string;
  userId:      string;
  type:        NotificationType;
  priority:    NotificationPriority;
  title:       string;
  message:     string;
  actionLabel: string | null;
  actionPath:  string | null;
  read:        boolean;
  createdAt:   string;
}

export interface AddNotificationInput {
  id?:          string;
  userId?:      string;
  type:         NotificationType;
  priority:     NotificationPriority;
  title:        string;
  message:      string;
  actionLabel?: string | null;
  actionPath?:  string | null;
  read?:        boolean;
  createdAt?:   string;
}

interface PaginatedResult<T> {
  items:      T[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

const PAGE_SIZE = 20;

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNotification(n: any): TNotification {
  return {
    id:          n.id,
    userId:      n.userId ?? "",
    type:        String(n.type).toLowerCase() as NotificationType,
    priority:    String(n.priority).toLowerCase() as NotificationPriority,
    title:       n.title,
    message:     n.message,
    actionLabel: n.actionLabel ?? null,
    actionPath:  n.actionPath  ?? null,
    read:        n.read ?? false,
    createdAt:   typeof n.createdAt === "string" ? n.createdAt : new Date(n.createdAt ?? Date.now()).toISOString(),
  };
}

// ── Store ─────────────────────────────────────────────────────────────────

interface NotificationStore {
  notifications: TNotification[];
  unreadCount:   number;
  page:          number;
  hasMore:       boolean;
  isLoading:     boolean;
  isInitialized: boolean;
  error:         string | null;

  init:     () => Promise<void>;
  reset:    () => void;
  loadMore: () => Promise<void>;

  markAsRead:         (id: string) => Promise<void>;
  markAllAsRead:       () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  /** Best-effort client-side "clear all" — deletes every currently-loaded notification. */
  clearAll:           () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;

  /** Prepend a notification (called by the WebSocket client on a NOTIFICATION message). */
  addNotification: (notification: AddNotificationInput) => void;
}

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  notifications: [],
  unreadCount:   0,
  page:          1,
  hasMore:       false,
  isLoading:     false,
  isInitialized: false,
  error:         null,

  // ── Init ──────────────────────────────────────────────────────────────

  init: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      const [listRes, countRes] = await Promise.all([
        api.get<PaginatedResult<TNotification>>(`/notifications?pageSize=${PAGE_SIZE}&page=1`),
        api.get<{ count: number }>("/notifications/unread-count"),
      ]);

      if (!listRes.success) {
        set({ isLoading: false, error: listRes.error, isInitialized: true });
        return;
      }

      set({
        notifications: (listRes.data.items ?? []).map(mapNotification),
        unreadCount:   countRes.success ? countRes.data.count : 0,
        page:          1,
        hasMore:       listRes.data.hasNext ?? false,
        isLoading:     false,
        isInitialized: true,
        error:         null,
      });
    } catch (err) {
      console.error("[notificationStore.init]", err);
      set({ isLoading: false, error: "Failed to load notifications", isInitialized: true });
    }
  },

  reset: () =>
    set({
      notifications: [], unreadCount: 0, page: 1, hasMore: false,
      isLoading: false, isInitialized: false, error: null,
    }),

  loadMore: async () => {
    const { page, hasMore, isLoading } = get();
    if (!hasMore || isLoading) return;

    const next = page + 1;
    set({ isLoading: true });

    try {
      const res = await api.get<PaginatedResult<TNotification>>(`/notifications?pageSize=${PAGE_SIZE}&page=${next}`);
      if (!res.success) { set({ isLoading: false }); return; }

      set((s) => ({
        notifications: [...s.notifications, ...(res.data.items ?? []).map(mapNotification)],
        page:          next,
        hasMore:       res.data.hasNext ?? false,
        isLoading:     false,
      }));
    } catch (err) {
      console.error("[notificationStore.loadMore]", err);
      set({ isLoading: false });
    }
  },

  // ── Mark as read ──────────────────────────────────────────────────────

  markAsRead: async (id) => {
    const target = get().notifications.find((n) => n.id === id);
    if (!target || target.read) return;

    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadCount:   Math.max(0, s.unreadCount - 1),
    }));

    try {
      const res = await api.post<null>(`/notifications/${id}/read`);
      if (!res.success) {
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: false } : n)),
          unreadCount:   s.unreadCount + 1,
          error:         res.error,
        }));
      }
    } catch (err) {
      console.error("[notificationStore.markAsRead]", err);
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: false } : n)),
        unreadCount:   s.unreadCount + 1,
        error:         "Failed to mark notification as read",
      }));
    }
  },

  markAllAsRead: async () => {
    const prevNotifications = get().notifications;
    const prevUnread        = get().unreadCount;
    set({ notifications: prevNotifications.map((n) => ({ ...n, read: true })), unreadCount: 0 });

    try {
      const res = await api.post<null>("/notifications/read-all");
      if (!res.success) set({ notifications: prevNotifications, unreadCount: prevUnread, error: res.error });
    } catch (err) {
      console.error("[notificationStore.markAllAsRead]", err);
      set({ notifications: prevNotifications, unreadCount: prevUnread, error: "Failed to mark all as read" });
    }
  },

  // ── Delete ────────────────────────────────────────────────────────────

  deleteNotification: async (id) => {
    const prev = get().notifications;
    const wasUnread = prev.find((n) => n.id === id)?.read === false;
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
      unreadCount:   wasUnread ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
    }));

    try {
      const res = await api.delete<null>(`/notifications/${id}`);
      if (!res.success) set({ notifications: prev, error: res.error });
    } catch (err) {
      console.error("[notificationStore.deleteNotification]", err);
      set({ notifications: prev, error: "Failed to delete notification" });
    }
  },

  clearAll: async () => {
    const prev = get().notifications;
    set({ notifications: [], unreadCount: 0 });

    try {
      await Promise.all(prev.map((n) => api.delete<null>(`/notifications/${n.id}`)));
    } catch (err) {
      console.error("[notificationStore.clearAll]", err);
    }
  },

  // ── Unread count ──────────────────────────────────────────────────────

  refreshUnreadCount: async () => {
    try {
      const res = await api.get<{ count: number }>("/notifications/unread-count");
      if (res.success) set({ unreadCount: res.data.count });
    } catch (err) {
      console.error("[notificationStore.refreshUnreadCount]", err);
    }
  },

  // ── Real-time push (WebSocket) ────────────────────────────────────────

  addNotification: (notification) => {
    const mapped: TNotification = {
      id:          notification.id ?? generateId(),
      userId:      notification.userId ?? "",
      type:        notification.type,
      priority:    notification.priority,
      title:       notification.title,
      message:     notification.message,
      actionLabel: notification.actionLabel ?? null,
      actionPath:  notification.actionPath  ?? null,
      read:        notification.read ?? false,
      createdAt:   notification.createdAt ?? new Date().toISOString(),
    };

    set((s) => ({
      notifications: [mapped, ...s.notifications].slice(0, 200),
      unreadCount:   mapped.read ? s.unreadCount : s.unreadCount + 1,
    }));
  },
}));

// ── Auto-init / reset (single-arg subscribe) ──────────────────────────────

if (typeof window !== "undefined") {
  import("@/store/authStore").then(({ useAuthStore }) => {
    // This store is only imported (and this block only runs) when its page
    // is first visited — often well after login. subscribe() alone only
    // fires on *future* changes, so if the user is already logged in by now
    // it would silently never call init(), leaving isInitialized false
    // forever. Seed prevUserId from the current state and fire once
    // up front to cover that already-happened transition.
    let prevUserId: string | undefined = useAuthStore.getState().user?.id;
    if (prevUserId) useNotificationStore.getState().init();

    useAuthStore.subscribe((state) => {
      const userId = state.user?.id;
      if (userId !== prevUserId) {
        prevUserId = userId;
        if (userId) {
          useNotificationStore.getState().init();
        } else {
          useNotificationStore.getState().reset();
        }
      }
    });
  });
}
