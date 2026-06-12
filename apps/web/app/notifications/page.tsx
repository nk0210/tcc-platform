"use client";
/**
 * TCC Notifications Page
 *
 * Fix: Notifications are deduplicated before rendering to prevent
 * "two children with the same key" React errors caused by old localStorage
 * data that had Date.now() ID collisions.
 */
import { useState, useMemo } from "react";
import {
  useNotificationStore,
  type TNotification,
  type NotificationType,
} from "@/store/notificationStore";
import { useRouter } from "next/navigation";
import Topbar  from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

// ── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const TYPE_ICON: Record<NotificationType, string> = {
  system:        "⚙",
  academy:       "🎓",
  copy_trade:    "📡",
  community:     "👥",
  report_update: "🚨",
  trade:         "📊",
  price_alert:   "🔔",
};

const TYPE_LABEL: Record<NotificationType, string> = {
  system:        "System",
  academy:       "Academy",
  copy_trade:    "Copy Trading",
  community:     "Community",
  report_update: "Reports",
  trade:         "Trade",
  price_alert:   "Price Alert",
};

const PRIORITY_DOT: Record<string, string> = {
  low:      "bg-white/20",
  medium:   "bg-blue-400",
  high:     "bg-amber-400",
  critical: "bg-red-500 animate-pulse",
};

type TabFilter = "all" | NotificationType | "unread";

const TABS: { key: TabFilter; label: string }[] = [
  { key: "all",           label: "All"            },
  { key: "unread",        label: "Unread"         },
  { key: "system",        label: "System"         },
  { key: "academy",       label: "Academy"        },
  { key: "copy_trade",    label: "Copy Trading"   },
  { key: "community",     label: "Community"      },
  { key: "report_update", label: "Reports"        },
  { key: "trade",         label: "Trading"        },
];

// ── Notification card ──────────────────────────────────────────────────────

function NotificationCard({
  notification,
  onRead,
  onDelete,
  onAction,
}: {
  notification:  TNotification;
  onRead:        (id: string) => void;
  onDelete:      (id: string) => void;
  onAction:      (path: string) => void;
}) {
  const { id, type, priority, title, message, action, read, createdAt } = notification;

  return (
    <div
      className={`glass border rounded-xl p-4 transition ${
        read ? "border-white/5 bg-transparent" : "border-white/10 bg-white/2"
      }`}>
      <div className="flex items-start gap-3">
        {/* Priority dot */}
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[priority] ?? "bg-white/20"}`} />
        </div>

        {/* Icon */}
        <span className="text-xl shrink-0 leading-none mt-0.5">
          {TYPE_ICON[type] ?? "🔔"}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-0.5">
            <p className={`text-sm font-semibold truncate ${read ? "text-white/60" : "text-white"}`}>
              {title}
            </p>
            <span className="text-white/20 text-xs shrink-0 mt-0.5">
              {timeAgo(createdAt)}
            </span>
          </div>

          <p className={`text-xs leading-relaxed mb-2 ${read ? "text-white/30" : "text-white/60"}`}>
            {message}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-white/20 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
              {TYPE_LABEL[type] ?? type}
            </span>

            {action && (
              <button
                onClick={() => onAction(action.path)}
                className="text-xs text-green-400/80 hover:text-green-400 bg-green-500/5 border border-green-500/20 px-2 py-0.5 rounded-full transition">
                {action.label} →
              </button>
            )}

            {!read && (
              <button
                onClick={() => onRead(id)}
                className="text-xs text-white/30 hover:text-white/60 transition">
                Mark read
              </button>
            )}

            <button
              onClick={() => onDelete(id)}
              className="text-xs text-white/20 hover:text-red-400 transition ml-auto">
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    unreadCount,
  } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter notifications by tab + search
  const filtered = useMemo(() => {
    let list = [...notifications];

    if (activeTab === "unread") {
      list = list.filter((n) => !n.read);
    } else if (activeTab !== "all") {
      list = list.filter((n) => n.type === activeTab);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q)
      );
    }

    return list;
  }, [notifications, activeTab, searchQuery]);

  // ── DEDUPLICATE before rendering ──────────────────────────────────────
  // Removes notifications with duplicate IDs caused by old Date.now() collisions
  // stored in localStorage. New notifications use crypto.randomUUID() and won't
  // produce duplicates, but old data needs to be cleaned at render time.
  const uniqueFiltered = useMemo<TNotification[]>(
    () =>
      filtered.filter(
        (notification, index, arr) =>
          arr.findIndex((item) => item.id === notification.id) === index
      ),
    [filtered]
  );

  const totalUnread = unreadCount();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto py-6 px-4">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  🔔 Notifications
                  {totalUnread > 0 && (
                    <span className="ml-2 text-sm font-semibold text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                      {totalUnread} unread
                    </span>
                  )}
                </h1>
                <p className="text-white/30 text-xs mt-0.5">
                  {notifications.length} total · User-scoped · Local only
                </p>
              </div>

              <div className="flex items-center gap-2">
                {totalUnread > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-white/50 hover:text-white bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg transition">
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm("Clear all notifications?")) clearAll();
                    }}
                    className="text-xs text-red-400/60 hover:text-red-400 bg-red-500/5 border border-red-500/10 px-3 py-1.5 rounded-lg transition">
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Search */}
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-white/25 placeholder-white/20 mb-4"
            />

            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-5 overflow-x-auto">
              {TABS.map((tab) => {
                const count =
                  tab.key === "all"
                    ? notifications.length
                    : tab.key === "unread"
                    ? totalUnread
                    : notifications.filter((n) => n.type === tab.key).length;

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                      activeTab === tab.key
                        ? "bg-green-500/20 text-green-400"
                        : "text-white/40 hover:text-white/60"
                    }`}>
                    {tab.label}
                    {count > 0 && (
                      <span className="ml-1 text-white/30">({count})</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Notification list */}
            {uniqueFiltered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <p className="text-4xl">🔔</p>
                <p className="text-white/30 text-sm">
                  {searchQuery
                    ? "No notifications match your search."
                    : activeTab === "unread"
                    ? "No unread notifications."
                    : "No notifications yet."}
                </p>
                <p className="text-white/15 text-xs text-center max-w-xs leading-relaxed">
                  Notifications appear here when you trade, enroll in Academy courses,
                  interact with Community, or use Copy Trading.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {uniqueFiltered.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onRead={markAsRead}
                    onDelete={deleteNotification}
                    onAction={(path) => {
                      markAsRead(notification.id);
                      router.push(path);
                    }}
                  />
                ))}
              </div>
            )}

            {/* Footer note */}
            {notifications.length > 0 && (
              <p className="text-white/10 text-xs text-center mt-6 leading-relaxed">
                Notifications are stored locally per user. Maximum 200 stored.
                Phase Alpha will add real-time push notifications.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}