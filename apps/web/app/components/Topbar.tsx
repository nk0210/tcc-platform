"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useTradeStore } from "@/store/tradeStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";
import { getEffectiveRole, isAdmin } from "@/lib/auth/roles";
import { connect, disconnect } from "@/lib/websocket/client";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

export default function Topbar() {
  const { user, logout, isInitialised } = useAuthStore();

  // Individual selectors — Topbar renders on every page, and a plain
  // useTradeStore() would re-render it on every WS price tick's
  // positions/closedTrades/isSyncing churn too, not just these 6 fields.
  const balance     = useTradeStore((s) => s.balance);
  const equity      = useTradeStore((s) => s.equity);
  const freeMargin  = useTradeStore((s) => s.freeMargin);
  const marginLevel = useTradeStore((s) => s.marginLevel);
  const floatingPnl = useTradeStore((s) => s.floatingPnl);
  const leverage    = useTradeStore((s) => s.leverage);
  const setLeverage = useTradeStore((s) => s.setLeverage);

  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useSystemNotifications();

  // Restore the session from the stored refresh token (access tokens are
  // in-memory only, so a hard reload needs this to re-authenticate) before
  // deciding whether to redirect to /login.
  useEffect(() => {
    useAuthStore.getState().initialise().then(() => {
      if (!useAuthStore.getState().user) {
        router.push("/login");
      }
    });
  }, [router]);

  // WebSocket connection follows auth state: connect once logged in,
  // disconnect on logout. `connect`/`disconnect` operate on a module-level
  // singleton, not per-component state — every page mounts its own Topbar
  // (there's no shared layout), so an unmount cleanup here would tear the
  // one shared connection down on every single client-side navigation, race
  // the next page's connect(), and spam "WebSocket is closed before the
  // connection is established". Logout is already covered below: when
  // `user` goes from a real id to null, this effect re-runs and takes the
  // `else` branch — no separate cleanup-driven disconnect is needed.
  //
  // Gated on `isInitialised`, not just `user`: authStore's persisted `user`
  // rehydrates from localStorage synchronously on mount, but the in-memory
  // access token (lib/api/client.ts) is never persisted — on a hard reload
  // it's null until the effect above's initialise() finishes its refresh
  // round-trip. Connecting on `user` alone raced that: the socket opened
  // and sent AUTHENTICATE with no token before it existed, so the server's
  // authTimeout always fired once ("Authentication timeout") before the
  // client's own 5s reconnect happened to land after the token was ready.
  // `isInitialised` only ever flips true once initialise() has already
  // settled the token one way or the other (see authStore.ts), so waiting
  // for it removes the race instead of just tolerating the resulting error.
  useEffect(() => {
    if (!isInitialised) return;
    if (user) {
      connect();
    } else {
      disconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isInitialised]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Safe defaults while API data is loading
  const safeBalance = balance ?? 0;
  const safeEquity = equity ?? 0;
  const safeFreeMargin = freeMargin ?? 0;
  const safeMarginLevel = marginLevel ?? 0;
  const safeFloatingPnl = floatingPnl ?? 0;

  const isAdminUser =
    mounted && isAdmin(getEffectiveRole(user?.roles));

  const marginColor =
    safeMarginLevel <= 0
      ? "text-fg-dim"
      : safeMarginLevel < 150
      ? "text-danger"
      : safeMarginLevel < 200
      ? "text-warning"
      : "text-success";

  const pnlColor =
    safeFloatingPnl >= 0
      ? "text-success"
      : "text-danger";


  const stats: { label: string; value: string; tone: "neutral" | "success" | "danger" }[] = [
    {
      label: "Balance",
      value: `$${safeBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      tone: "neutral",
    },
    {
      label: "Equity",
      value: `$${safeEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      tone: safeEquity >= safeBalance ? "success" : "danger",
    },
    {
      label: "Free Margin",
      value: `$${safeFreeMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      tone: safeFreeMargin < 500 ? "danger" : "neutral",
    },
    {
      label: "Floating P&L",
      value: `${safeFloatingPnl >= 0 ? "+" : ""}$${safeFloatingPnl.toFixed(2)}`,
      tone: safeFloatingPnl >= 0 ? "success" : "danger",
    },
  ];
  const toneClass = { neutral: "text-fg", success: "text-success", danger: "text-danger" } as const;

  return (
    <div className="glass flex items-center justify-between px-5 py-2.5 z-10 shrink-0">

      {/* Brand */}
      <div
        className="flex items-center gap-2.5 cursor-pointer shrink-0 group"
        onClick={() => router.push("/")}
      >
        <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center group-hover:bg-accent/25 transition">
          <span className="text-sm font-black text-accent-hover tracking-tight">TC</span>
        </div>
        <div className="hidden sm:block leading-tight">
          <p className="text-sm font-bold text-fg tracking-wide">TCC</p>
          <p className="text-[10px] text-fg-dim tracking-widest uppercase -mt-0.5">Command Center</p>
        </div>
      </div>

      {/* Account stat cluster */}
      <div className="hidden md:flex items-center divide-x divide-border">
        {stats.map((item) => (
          <div key={item.label} className="flex flex-col items-center px-4 first:pl-0 last:pr-0">
            <span className="text-[10px] text-fg-dim uppercase tracking-wide">{item.label}</span>
            <span className={`text-sm font-semibold tabular-nums ${toneClass[item.tone]}`}>{item.value}</span>
          </div>
        ))}

        <div className="flex flex-col items-center px-4">
          <span className="text-[10px] text-fg-dim uppercase tracking-wide">Margin</span>
          <span className={`text-sm font-semibold tabular-nums ${marginColor}`}>
            {safeMarginLevel > 0 ? `${safeMarginLevel.toFixed(0)}%` : "—"}
          </span>
        </div>

        <div className="flex flex-col items-center pl-4">
          <span className="text-[10px] text-fg-dim uppercase tracking-wide">Leverage</span>
          <select
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="bg-transparent text-fg text-xs font-semibold cursor-pointer focus:outline-none"
          >
            {[1, 2, 5, 10, 20, 50, 100].map((l) => (
              <option key={l} value={l} className="bg-elevated text-fg">1:{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">

        <span className="badge badge-success hidden sm:inline-flex">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Paper
        </span>

        {mounted && isAdminUser && (
          <button
            onClick={() => router.push("/owner")}
            className="btn btn-secondary !text-warning !border-warning/30 hover:!bg-warning/10 px-3 py-1.5 text-xs"
          >
            ⚙ Owner
          </button>
        )}

        <ThemeToggle />

        <button
          className="btn btn-ghost relative w-8 h-8 !p-0 rounded-lg"
          onClick={() => router.push("/notifications")}
          aria-label="Notifications"
        >
          <span className="text-base leading-none">🔔</span>
          {mounted && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-danger rounded-full flex items-center justify-center text-fg text-[10px] font-bold px-1 ring-2 ring-surface">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <div className="w-px h-6 bg-border mx-0.5" />

        <div
          className="flex items-center gap-2 cursor-pointer rounded-lg pl-1 pr-2 py-1 hover:bg-elevated transition"
          onClick={() => router.push("/profile")}
        >
          <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent-hover text-xs font-bold shrink-0">
            {user?.handle?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="hidden lg:flex flex-col leading-tight">
            <span className="text-xs font-semibold text-fg">{user?.handle || "Guest"}</span>
            {user?.experienceLevel && (
              <span className="text-[10px] text-fg-dim capitalize">{user.experienceLevel.toLowerCase()}</span>
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="btn btn-ghost !text-fg-dim hover:!text-danger text-xs px-2 py-1.5"
        >
          Logout
        </button>

      </div>

    </div>
  );
}