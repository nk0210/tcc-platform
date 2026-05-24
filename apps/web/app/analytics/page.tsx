"use client";
import { useEffect } from "react";
import { useAnalyticsStore } from "@/store/analyticsStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

export default function AnalyticsPage() {
  const { data, refresh } = useAnalyticsStore();

  useEffect(() => {
    refresh();
  }, []);

  if (!data) return null;

  const statCards = [
    { label: "Total Trades", value: data.totalTrades, color: "text-white" },
    { label: "Win Rate", value: `${data.winRate.toFixed(1)}%`, color: data.winRate >= 50 ? "text-green-400" : "text-red-400" },
    { label: "Profit Factor", value: data.profitFactor === 999 ? "∞" : data.profitFactor.toFixed(2), color: data.profitFactor >= 1.5 ? "text-green-400" : data.profitFactor >= 1 ? "text-amber-400" : "text-red-400" },
    { label: "Avg R:R", value: data.avgRR.toFixed(2), color: data.avgRR >= 1.5 ? "text-green-400" : "text-amber-400" },
    { label: "Total P&L", value: `${data.totalPnl >= 0 ? "+" : ""}$${data.totalPnl.toFixed(2)}`, color: data.totalPnl >= 0 ? "text-green-400" : "text-red-400" },
    { label: "Gross Profit", value: `$${data.grossProfit.toFixed(2)}`, color: "text-green-400" },
    { label: "Gross Loss", value: `-$${data.grossLoss.toFixed(2)}`, color: "text-red-400" },
    { label: "Avg Win", value: `$${data.avgWin.toFixed(2)}`, color: "text-green-400" },
    { label: "Avg Loss", value: `-$${data.avgLoss.toFixed(2)}`, color: "text-red-400" },
    { label: "Best Trade", value: `$${data.bestTrade.toFixed(2)}`, color: "text-green-400" },
    { label: "Worst Trade", value: `$${data.worstTrade.toFixed(2)}`, color: "text-red-400" },
    { label: "Max Drawdown", value: `${data.maxDrawdown}%`, color: data.maxDrawdown < 5 ? "text-green-400" : data.maxDrawdown < 10 ? "text-amber-400" : "text-red-400" },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Analytics</h1>
              <p className="text-white/40 text-sm mt-1">Performance breakdown across all your trades</p>
            </div>
            {data.currentStreak > 0 && (
              <div className={`glass border px-4 py-2 rounded-lg ${data.streakType === "win" ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                <p className="text-xs text-white/40">Current Streak</p>
                <p className={`text-lg font-bold ${data.streakType === "win" ? "text-green-400" : "text-red-400"}`}>
                  {data.currentStreak} {data.streakType === "win" ? "🔥 Wins" : "❄️ Losses"}
                </p>
              </div>
            )}
          </div>

          {data.totalTrades === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-5xl mb-4">📈</div>
                <p className="text-white/40">No closed trades yet</p>
                <p className="text-white/20 text-sm mt-1">Close some trades to see your analytics</p>
              </div>
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-6 gap-3 mb-6">
                {statCards.map((card) => (
                  <div key={card.label} className="glass border border-white/5 rounded-xl p-3">
                    <p className="text-white/40 text-xs mb-1">{card.label}</p>
                    <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Equity Curve */}
              <div className="glass border border-white/5 rounded-xl p-5 mb-6">
                <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Equity Curve</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.equityCurve}>
                    <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                      labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                      itemStyle={{ color: "#00ff88" }} />
                    <Line type="monotone" dataKey="equity" stroke="#00ff88" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">

                {/* Session Breakdown */}
                {data.sessionBreakdown.length > 0 && (
                  <div className="glass border border-white/5 rounded-xl p-5">
                    <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Session Performance</p>
                    <div className="flex flex-col gap-3">
                      {data.sessionBreakdown.map((s) => (
                        <div key={s.session} className="flex items-center gap-3">
                          <span className="text-white/60 text-xs w-20 capitalize">{s.session}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-2">
                            <div className={`h-2 rounded-full ${s.winRate >= 50 ? "bg-green-400" : "bg-red-400"}`}
                              style={{ width: `${s.winRate}%` }} />
                          </div>
                          <span className={`text-xs font-semibold w-12 text-right ${s.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
                            {s.winRate.toFixed(0)}%
                          </span>
                          <span className={`text-xs font-bold w-16 text-right ${s.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {s.pnl >= 0 ? "+" : ""}${s.pnl.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Emotion Breakdown */}
                {data.emotionBreakdown.length > 0 && (
                  <div className="glass border border-white/5 rounded-xl p-5">
                    <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Emotion vs Performance</p>
                    <div className="flex flex-col gap-3">
                      {data.emotionBreakdown.map((e) => (
                        <div key={e.emotion} className="flex items-center gap-3">
                          <span className="text-white/60 text-xs w-20 capitalize">{e.emotion}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-2">
                            <div className={`h-2 rounded-full ${e.winRate >= 50 ? "bg-green-400" : "bg-red-400"}`}
                              style={{ width: `${e.winRate}%` }} />
                          </div>
                          <span className={`text-xs font-semibold w-12 text-right ${e.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
                            {e.winRate.toFixed(0)}%
                          </span>
                          <span className={`text-xs font-bold w-16 text-right ${e.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {e.pnl >= 0 ? "+" : ""}${e.pnl.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">

                {/* Strategy Breakdown */}
                {data.strategyBreakdown.length > 0 && (
                  <div className="glass border border-white/5 rounded-xl p-5">
                    <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Strategy Performance</p>
                    <div className="flex flex-col gap-3">
                      {data.strategyBreakdown.map((s) => (
                        <div key={s.strategy} className="flex items-center gap-3">
                          <span className="text-white/60 text-xs w-24 uppercase">{s.strategy}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-2">
                            <div className={`h-2 rounded-full ${s.winRate >= 50 ? "bg-green-400" : "bg-red-400"}`}
                              style={{ width: `${s.winRate}%` }} />
                          </div>
                          <span className={`text-xs font-semibold w-12 text-right ${s.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
                            {s.winRate.toFixed(0)}%
                          </span>
                          <span className={`text-xs font-bold w-16 text-right ${s.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {s.pnl >= 0 ? "+" : ""}${s.pnl.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day Breakdown */}
                {data.dayBreakdown.length > 0 && (
                  <div className="glass border border-white/5 rounded-xl p-5">
                    <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Day of Week Performance</p>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={data.dayBreakdown}>
                        <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                          labelStyle={{ color: "rgba(255,255,255,0.6)" }} />
                        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                          {data.dayBreakdown.map((entry, index) => (
                            <Cell key={index} fill={entry.pnl >= 0 ? "#00ff88" : "#ff4466"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}