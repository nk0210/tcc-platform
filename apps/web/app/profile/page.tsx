"use client";
import { useAuthStore } from "@/store/authStore";
import { useAnalyticsStore, calculateAnalytics } from "@/store/analyticsStore";
import { useJournalStore } from "@/store/journalStore";
import { useCommunityStore } from "@/store/communityStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import { useEffect } from "react";

const skillColors: Record<string, string> = {
  ROOKIE: "from-white/20 to-white/5",
  LEARNER: "from-blue-500/30 to-blue-500/5",
  ANALYST: "from-purple-500/30 to-purple-500/5",
  TRADER: "from-amber-500/30 to-amber-500/5",
  PRO: "from-green-500/30 to-green-500/5",
  MENTOR: "from-orange-500/30 to-orange-500/5",
};

const badges = [
  { id: "first_trade", label: "First Trade", emoji: "🎯", description: "Placed your first trade" },
  { id: "london_session", label: "London Trader", emoji: "🏙", description: "Traded during London session" },
  { id: "risk_master", label: "Risk Master", emoji: "🛡", description: "Maintained low risk score" },
  { id: "journal_streak", label: "Journal Streak", emoji: "📓", description: "Journaled 5 trades in a row" },
  { id: "community", label: "Community Member", emoji: "👥", description: "Made your first post" },
];

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { data, refresh } = useAnalyticsStore();
  const { entries } = useJournalStore();
  const { posts } = useCommunityStore();

  useEffect(() => { refresh(); }, []);

  const analytics = data || calculateAnalytics();
  const userPosts = posts.filter(p => p.handle === user?.handle);
  const sessions = entries.reduce((acc: Record<string, number>, e) => {
    acc[e.session] = (acc[e.session] || 0) + 1;
    return acc;
  }, {});
  const bestSession = Object.entries(sessions).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const earnedBadges = badges.filter((b, i) => i < Math.min(entries.length + 1, badges.length));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

          <div className="max-w-4xl mx-auto">

            {/* Trader Card */}
            <div className={`glass border border-white/10 rounded-2xl p-8 mb-6 bg-gradient-to-br ${skillColors[user?.skillLevel || "ROOKIE"]} relative overflow-hidden`}>

              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-green-400/5 -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-green-400/3 translate-y-1/2 -translate-x-1/2" />

              <div className="relative flex items-start gap-8">

                {/* Avatar */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-24 h-24 rounded-2xl bg-green-500/20 border-2 border-green-500/30 flex items-center justify-center text-green-400 text-4xl font-bold">
                    {user?.handle?.[0]?.toUpperCase() || "?"}
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r ${skillColors[user?.skillLevel || "ROOKIE"]} border border-white/10`}>
                    {user?.skillLevel || "ROOKIE"}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-3xl font-bold text-white">@{user?.handle || "guest"}</h1>
                    <span className="text-green-400 text-sm">✓ TCC Verified</span>
                  </div>
                  <p className="text-white/40 text-sm mb-4">Paper Trader · {bestSession !== "—" ? `${bestSession} session specialist` : "Building trading skills"}</p>

                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "Win Rate", value: `${analytics.winRate.toFixed(1)}%`, color: analytics.winRate >= 50 ? "text-green-400" : "text-red-400" },
                      { label: "Profit Factor", value: analytics.profitFactor === 999 ? "∞" : analytics.profitFactor.toFixed(2), color: "text-white" },
                      { label: "Avg R:R", value: analytics.avgRR.toFixed(2), color: "text-amber-400" },
                      { label: "Total Trades", value: analytics.totalTrades, color: "text-white" },
                    ].map(stat => (
                      <div key={stat.label} className="glass border border-white/5 rounded-xl p-3">
                        <p className="text-white/40 text-xs mb-1">{stat.label}</p>
                        <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* TCC Logo watermark */}
                <div className="text-right">
                  <p className="text-green-400/30 text-4xl font-bold tracking-widest">TCC</p>
                  <p className="text-white/20 text-xs">Trader's Command Center</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">

              {/* Stats */}
              <div className="glass border border-white/5 rounded-xl p-5">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">Performance</p>
                <div className="flex flex-col gap-3">
                  {[
                    { label: "Total P&L", value: `${analytics.totalPnl >= 0 ? "+" : ""}$${analytics.totalPnl.toFixed(2)}`, color: analytics.totalPnl >= 0 ? "text-green-400" : "text-red-400" },
                    { label: "Best Trade", value: `$${analytics.bestTrade.toFixed(2)}`, color: "text-green-400" },
                    { label: "Worst Trade", value: `$${analytics.worstTrade.toFixed(2)}`, color: "text-red-400" },
                    { label: "Max Drawdown", value: `${analytics.maxDrawdown}%`, color: analytics.maxDrawdown < 5 ? "text-green-400" : "text-amber-400" },
                    { label: "Best Session", value: bestSession, color: "text-blue-400" },
                    { label: "Total Journal Entries", value: entries.length, color: "text-white" },
                    { label: "Community Posts", value: userPosts.length, color: "text-white" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40 text-xs">{item.label}</span>
                      <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Badges */}
              <div className="glass border border-white/5 rounded-xl p-5">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">Badges</p>
                <div className="flex flex-col gap-3">
                  {badges.map((badge, i) => {
                    const earned = i < earnedBadges.length;
                    return (
                      <div key={badge.id} className={`flex items-center gap-3 p-2 rounded-lg transition ${earned ? "bg-white/5" : "opacity-30"}`}>
                        <span className="text-2xl">{badge.emoji}</span>
                        <div>
                          <p className={`text-xs font-semibold ${earned ? "text-white" : "text-white/40"}`}>{badge.label}</p>
                          <p className="text-white/30 text-xs">{badge.description}</p>
                        </div>
                        {earned && <span className="ml-auto text-green-400 text-xs">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Skill Tree */}
              <div className="glass border border-white/5 rounded-xl p-5">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">Skill Progression</p>
                <div className="flex flex-col gap-2">
                  {[
                    { level: "ROOKIE", desc: "Getting started", unlocks: "Basic trading" },
                    { level: "LEARNER", desc: "Learning strategies", unlocks: "Strategy lessons" },
                    { level: "ANALYST", desc: "Reading the market", unlocks: "Backtesting tools" },
                    { level: "TRADER", desc: "Consistent execution", unlocks: "Competitions" },
                    { level: "PRO", desc: "Elite performance", unlocks: "Strategy marketplace" },
                    { level: "MENTOR", desc: "Teaching others", unlocks: "Publish courses" },
                  ].map((item, i) => {
                    const levels = ["ROOKIE", "LEARNER", "ANALYST", "TRADER", "PRO", "MENTOR"];
                    const currentIdx = levels.indexOf(user?.skillLevel || "ROOKIE");
                    const isActive = item.level === user?.skillLevel;
                    const isPast = i < currentIdx;
                    return (
                      <div key={item.level} className={`flex items-center gap-3 p-2 rounded-lg border transition ${isActive ? "border-green-500/30 bg-green-500/5" : isPast ? "border-white/5 bg-white/2" : "border-transparent opacity-40"}`}>
                        <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400" : isPast ? "bg-white/40" : "bg-white/10"}`} />
                        <div className="flex-1">
                          <p className={`text-xs font-bold ${isActive ? "text-green-400" : "text-white/60"}`}>{item.level}</p>
                          <p className="text-white/30 text-xs">{item.desc}</p>
                        </div>
                        {isActive && <span className="text-green-400 text-xs">← You</span>}
                        {isPast && <span className="text-white/20 text-xs">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}