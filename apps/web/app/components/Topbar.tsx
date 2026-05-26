"use client";
import { useAuthStore } from "@/store/authStore";
import { useTradeStore } from "@/store/tradeStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Topbar() {
  const { user, logout } = useAuthStore();
  const { balance, equity, freeMargin, marginLevel, totalNetPnl, leverage, setLeverage } = useTradeStore();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("tcc_token");
    if (!token) router.push("/login");
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const marginColor = marginLevel > 200 ? "text-green-400" : marginLevel > 100 ? "text-amber-400" : "text-red-400";

  return (
    <div className="glass flex items-center justify-between px-6 py-3 border-b border-white/5 z-10">

      <div className="flex items-center gap-3">
        <span className="text-xl font-bold neon-green tracking-widest">TCC</span>
        <span className="text-xs text-white/30 tracking-widest uppercase">Trader's Command Center</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Balance</span>
          <span className="text-sm font-semibold text-white">${balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Equity</span>
          <span className={`text-sm font-semibold ${equity >= balance ? "text-green-400" : "text-red-400"}`}>
            ${equity.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Free Margin</span>
          <span className="text-sm font-semibold text-white">${freeMargin.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Margin Level</span>
          <span className={`text-sm font-semibold ${marginColor}`}>
            {marginLevel > 0 ? `${marginLevel}%` : "—"}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Floating P&L</span>
          <span className={`text-sm font-semibold ${totalNetPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalNetPnl >= 0 ? "+" : ""}${totalNetPnl.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Leverage</span>
          <select
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded px-1 py-0.5 text-white text-xs cursor-pointer">
            {[1, 2, 5, 10, 20, 50, 100].map(l => (
              <option key={l} value={l} className="bg-[#0a0a0f]">1:{l}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Mode</span>
          <span className="text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Paper</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <span className="text-white/50 text-lg cursor-pointer hover:text-white transition">🔔</span>
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full"></span>
        </div>
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/profile")}>
          <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-sm font-bold">
            {user?.handle?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-sm text-white/70">{user?.handle || "Guest"}</span>
          <span className="text-xs bg-white/5 text-white/30 px-2 py-0.5 rounded-full">{user?.skillLevel || ""}</span>
          <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="text-xs text-red-400/50 hover:text-red-400 transition ml-2">Logout</button>
        </div>
      </div>

    </div>
  );
}