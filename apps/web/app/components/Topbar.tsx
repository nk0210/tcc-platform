"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useTradeStore } from "@/store/tradeStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";
import { getEffectiveRole, isAdmin } from "@/lib/auth/roles";
import { connect, disconnect } from "@/lib/websocket/client";
import { useRouter } from "next/navigation";

export default function Topbar() {
  const { user, logout } = useAuthStore();

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
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
      ? "text-white/40"
      : safeMarginLevel < 150
      ? "text-red-400"
      : safeMarginLevel < 200
      ? "text-amber-400"
      : "text-green-400";

  const pnlColor =
    safeFloatingPnl >= 0
      ? "text-green-400"
      : "text-red-400";


  return (
    <div className="glass flex items-center justify-between px-6 py-3 border-b border-white/5 z-10 shrink-0">

      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => router.push("/")}
      >
        <span className="text-xl font-bold neon-green tracking-widest">
          TCC
        </span>

        <span className="text-xs text-white/30 tracking-widest uppercase">
          Trader's Command Center
        </span>
      </div>


      <div className="flex items-center gap-5">

        {[
          {
            label: "Balance",
            value: `$${safeBalance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            color: "text-white",
          },

          {
            label: "Equity",
            value: `$${safeEquity.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            color:
              safeEquity >= safeBalance
                ? "text-green-400"
                : "text-red-400",
          },

          {
            label: "Free Margin",
            value: `$${safeFreeMargin.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            color:
              safeFreeMargin < 500
                ? "text-red-400"
                : "text-white",
          },

          {
            label: "Margin Level",
            value:
              safeMarginLevel > 0
                ? `${safeMarginLevel.toFixed(0)}%`
                : "—",
            color: marginColor,
          },

          {
            label: "Floating P&L",
            value:
              `${safeFloatingPnl >= 0 ? "+" : ""}$${safeFloatingPnl.toFixed(2)}`,
            color: pnlColor,
          },

        ].map((item) => (

          <div key={item.label} className="flex flex-col items-center">

            <span className="text-xs text-white/40">
              {item.label}
            </span>

            <span className={`text-sm font-semibold ${item.color}`}>
              {item.value}
            </span>

          </div>

        ))}


        <div className="flex flex-col items-center">

          <span className="text-xs text-white/40">
            Leverage
          </span>

          <select
            value={leverage}
            onChange={(e) =>
              setLeverage(Number(e.target.value))
            }
            className="bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white text-xs cursor-pointer"
          >

            {[1, 2, 5, 10, 20, 50, 100].map((l) => (

              <option
                key={l}
                value={l}
                className="bg-[#0a0a0f]"
              >
                1:{l}
              </option>

            ))}

          </select>

        </div>


        <div className="flex flex-col items-center">

          <span className="text-xs text-white/40">
            Mode
          </span>

          <span className="text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
            Paper
          </span>

        </div>

      </div>


      <div className="flex items-center gap-3">

        {mounted && isAdminUser && (

          <button
            onClick={() => router.push("/owner")}
            className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition"
          >
            🔧 Owner
          </button>

        )}


        <div
          className="relative cursor-pointer"
          onClick={() => router.push("/notifications")}
        >

          <span className="text-white/50 text-lg hover:text-white transition">
            🔔
          </span>

          {mounted && unreadCount > 0 && (

            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>

          )}

        </div>


        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => router.push("/profile")}
        >

          <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-sm font-bold">
            {user?.handle?.[0]?.toUpperCase() || "?"}
          </div>


          <span className="text-sm text-white/70">
            {user?.handle || "Guest"}
          </span>


          <span className="text-xs bg-white/5 text-white/30 px-2 py-0.5 rounded-full">
            {user?.experienceLevel || ""}
          </span>


          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
            className="text-xs text-red-400/50 hover:text-red-400 transition ml-2"
          >
            Logout
          </button>

        </div>

      </div>

    </div>
  );
}