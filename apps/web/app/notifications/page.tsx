"use client";
import { useState } from "react";
import { useNotificationStore, typeIcons, priorityColors, NotificationType } from "@/store/notificationStore";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification } = useNotificationStore();
  const [filter, setFilter] = useState<"all" | "unread" | NotificationType>("all");
  const router = useRouter();

  const filtered = notifications.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter !== "all") return n.type === filter;
    return true;
  });

  const handleClick = (n: any) => {
    markRead(n.id);
    if (n.action?.path) router.push(n.action.path);
  };

  const filters: { key: string; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: `Unread (${unreadCount})` },
    { key: "risk_warning", label: "⚠ Risk" },
    { key: "copy_trade", label: "📡 Copy" },
    { key: "competition", label: "🏆 Competition" },
    { key: "news", label: "📰 News" },
    { key: "journal_prompt", label: "📓 Journal" },
    { key: "community", label: "👥 Community" },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">🔔 Notifications</h1>
              <p className="text-white/40 text-sm mt-1">{unreadCount} unread · {notifications.length} total</p>
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                className="bg-white/5 text-white/40 border border-white/10 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-white/10 transition">
                Mark all read
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {filters.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key as any)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${filter === f.key ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <p className="text-4xl mb-3">🔔</p>
                <p className="text-white/40">No notifications</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(n => (
                <div key={n.id}
                  className={`glass border border-l-4 rounded-xl p-4 transition cursor-pointer group ${priorityColors[n.priority]} ${!n.read ? "border-white/10" : "border-white/5 opacity-70"}`}
                  onClick={() => handleClick(n)}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${!n.read ? "bg-white/10" : "bg-white/5"}`}>
                      {typeIcons[n.type]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`text-sm font-semibold ${!n.read ? "text-white" : "text-white/60"}`}>{n.title}</p>
                          <p className={`text-xs mt-0.5 leading-relaxed ${!n.read ? "text-white/60" : "text-white/30"}`}>{n.message}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!n.read && <div className="w-2 h-2 bg-green-400 rounded-full" />}
                          <p className="text-white/20 text-xs">{timeAgo(n.timestamp)}</p>
                          <button onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                            className="text-white/20 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition">✕</button>
                        </div>
                      </div>
                      {n.action && (
                        <div className="mt-2">
                          <span className="text-xs text-green-400 hover:text-green-300 transition">{n.action.label} →</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}