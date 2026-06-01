"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useTradeStore } from "@/store/tradeStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";
import { getEffectiveRole, isAdmin } from "@/lib/auth/roles";
import { useRouter } from "next/navigation";

export default function Topbar() {
  const { user, logout } = useAuthStore();
  const {
    balance, equity, freeMargin, marginLevel,
    floatingPnl, leverage, setLeverage,
  } = useTradeStore();
  const { unreadCount } = useNotificationStore();
  const router = useRouter();

  // Hydration guard — prevents SSR mismatch from localStorage-dependent UI
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useSystemNotifications();

  useEffect(() => {
    const authState = useAuthStore.getState();
    if (!authState.token && !authState.user) router.push("/login");
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isAdminUser = mounted && isAdmin(getEffectiveRole(user?.role));

  const marginColor =
    marginLevel <= 0 ? "text-white/40"
    : marginLevel < 150 ? "text-red-400"
    : marginLevel < 200 ? "text-amber-400"
    : "text-green-400";

  const pnlColor = floatingPnl >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="glass flex items-center justify-between px-6 py-3 border-b border-white/5 z-10 shrink-0">

      <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/")}>
        <span className="text-xl font-bold neon-green tracking-widest">TCC</span>
        <span className="text-xs text-white/30 tracking-widest uppercase">Trader's Command Center</span>
      </div>

      <div className="flex items-center gap-5">
        {[
          { label: "Balance", value: `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "text-white" },
          { label: "Equity", value: `$${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: equity >= balance ? "text-green-400" : "text-red-400" },
          { label: "Free Margin", value: `$${freeMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: freeMargin < 500 ? "text-red-400" : "text-white" },
          { label: "Margin Level", value: marginLevel > 0 ? `${marginLevel.toFixed(0)}%` : "—", color: marginColor },
          { label: "Floating P&L", value: `${floatingPnl >= 0 ? "+" : ""}$${floatingPnl.toFixed(2)}`, color: pnlColor },
        ].map(item => (
          <div key={item.label} className="flex flex-col items-center">
            <span className="text-xs text-white/40">{item.label}</span>
            <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
          </div>
        ))}

        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Leverage</span>
          <select value={leverage} onChange={(e) => setLeverage(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white text-xs cursor-pointer">
            {[1, 2, 5, 10, 20, 50, 100].map(l => (
              <option key={l} value={l} className="bg-[#0a0a0f]">1:{l}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Mode</span>
          <span className="text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
            Paper
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Owner button — only rendered client-side */}
        {mounted && isAdminUser && (
          <button onClick={() => router.push("/owner")}
            className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition">
            🔧 Owner
          </button>
        )}

        <div className="relative cursor-pointer" onClick={() => router.push("/notifications")}>
          <span className="text-white/50 text-lg hover:text-white transition">🔔</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/profile")}>
          <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-sm font-bold">
            {user?.handle?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-sm text-white/70">{user?.handle || "Guest"}</span>
          <span className="text-xs bg-white/5 text-white/30 px-2 py-0.5 rounded-full">{user?.skillLevel || ""}</span>
          <button onClick={(e) => { e.stopPropagation(); handleLogout(); }}
            className="text-xs text-red-400/50 hover:text-red-400 transition ml-2">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}