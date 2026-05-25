"use client";
import { useEffect, useState } from "react";
import { useAnalyticsStore, calculateAnalytics } from "@/store/analyticsStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from "recharts";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function AnalyticsPage() {
  const { data, refresh } = useAnalyticsStore();
  const [timeFilter, setTimeFilter] = useState<"3M"|"1Y"|"ALL">("ALL");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => { refresh(); }, []);

  if (!data) return null;

  // Calendar data
  const { entries } = require("@/store/journalStore").useJournalStore.getState();
  const calendarData: Record<string, number> = {};
  entries.filter((e: any) => e.pnl !== undefined).forEach((e: any) => {
    const d = new Date(e.timestamp);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      const key = d.getDate().toString();
      calendarData[key] = (calendarData[key] || 0) + (e.pnl || 0);
    }
  });

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  // Filtered equity curve
  const now = new Date();
  const filteredCurve = data.equityCurve.filter(p => {
    if (timeFilter === "ALL" || p.time === "Start") return true;
    const d = new Date(p.time);
    if (timeFilter === "3M") return (now.getTime() - d.getTime()) <= 90 * 24 * 60 * 60 * 1000;
    if (timeFilter === "1Y") return (now.getTime() - d.getTime()) <= 365 * 24 * 60 * 60 * 1000;
    return true;
  });

  const roiPct = data.equityCurve.length > 1
    ? (((data.equityCurve[data.equityCurve.length - 1].equity - data.equityCurve[0].equity) / data.equityCurve[0].equity) * 100).toFixed(2)
    : "0.00";

  const closedEntries = entries.filter((e: any) => e.pnl !== undefined);
  const profitableBuys = closedEntries.filter((e: any) => e.direction === "BUY" && (e.pnl || 0) > 0).length;
  const totalBuys = closedEntries.filter((e: any) => e.direction === "BUY").length;
  const profitableSells = closedEntries.filter((e: any) => e.direction === "SELL" && (e.pnl || 0) > 0).length;
  const totalSells = closedEntries.filter((e: any) => e.direction === "SELL").length;

  // Daily performance
  const dayMap: Record<string, number> = {};
  closedEntries.forEach((e: any) => {
    const key = new Date(e.timestamp).toDateString();
    dayMap[key] = (dayMap[key] || 0) + (e.pnl || 0);
  });
  const dailyResults = Object.values(dayMap);
  const profitableDays = dailyResults.filter(p => p > 0).length;
  const losingDays = dailyResults.filter(p => p <= 0).length;

  // Monthly ROI
  const monthlyMap: Record<string, number> = {};
  closedEntries.forEach((e: any) => {
    const d = new Date(e.timestamp);
    const key = `${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
    monthlyMap[key] = (monthlyMap[key] || 0) + (e.pnl || 0);
  });
  const monthlyData = Object.entries(monthlyMap).map(([month, pnl]) => ({ month, pnl }));

  const donutData = [
    { name: "Wins", value: data.totalTrades > 0 ? Math.round(data.winRate) : 50, fill: "#00ff88" },
    { name: "Losses", value: data.totalTrades > 0 ? Math.round(data.lossRate) : 50, fill: "#ff4466" },
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
                {[
                  { label: "Total Trades", value: data.totalTrades, color: "text-white" },
                  { label: "Win Rate", value: `${data.winRate.toFixed(1)}%`, color: data.winRate >= 50 ? "text-green-400" : "text-red-400" },
                  { label: "Profit Factor", value: data.profitFactor === 999 ? "∞" : data.profitFactor.toFixed(2), color: data.profitFactor >= 1.5 ? "text-green-400" : data.profitFactor >= 1 ? "text-amber-400" : "text-red-400" },
                  { label: "Avg R:R", value: data.avgRR.toFixed(2), color: data.avgRR >= 1.5 ? "text-green-400" : "text-amber-400" },
                  { label: "Total P&L", value: `${data.totalPnl >= 0 ? "+" : ""}$${data.totalPnl.toFixed(2)}`, color: data.totalPnl >= 0 ? "text-green-400" : "text-red-400" },
                  { label: "Max Drawdown", value: `${data.maxDrawdown}%`, color: data.maxDrawdown < 5 ? "text-green-400" : data.maxDrawdown < 10 ? "text-amber-400" : "text-red-400" },
                ].map((card) => (
                  <div key={card.label} className="glass border border-white/5 rounded-xl p-3">
                    <p className="text-white/40 text-xs mb-1">{card.label}</p>
                    <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                  </div>
                ))}
              </div>

              {/* ROI + Equity Curve */}
              <div className="glass border border-white/5 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white/40 text-xs">ROI</p>
                    <p className={`text-2xl font-bold ${parseFloat(roiPct) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {parseFloat(roiPct) >= 0 ? "+" : ""}{roiPct}%
                    </p>
                    <p className="text-white/30 text-xs">${data.totalPnl.toFixed(2)} USD</p>
                  </div>
                  <div className="flex gap-2">
                    {(["3M","1Y","ALL"] as const).map(f => (
                      <button key={f} onClick={() => setTimeFilter(f)}
                        className={`px-3 py-1 rounded text-xs font-semibold border transition ${timeFilter === f ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10"}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={filteredCurve}>
                    <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                      labelStyle={{ color: "rgba(255,255,255,0.6)" }} itemStyle={{ color: "#00ff88" }} />
                    <Line type="monotone" dataKey="equity" stroke="#00ff88" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-6 mb-6">

                {/* Trade Summary */}
                <div className="glass border border-white/5 rounded-xl p-5">
                  <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Trade Summary</p>
                  <p className="text-white/40 text-xs mb-3">Total trades: {data.totalTrades}</p>

                  <p className="text-white/40 text-xs mb-1">Buys: {profitableBuys} profitable / {totalBuys - profitableBuys} losing</p>
                  <div className="w-full bg-white/5 rounded-full h-2 mb-3 flex overflow-hidden">
                    <div className="bg-green-400 h-2" style={{ width: totalBuys > 0 ? `${(profitableBuys/totalBuys)*100}%` : "50%" }} />
                    <div className="bg-red-400 h-2 flex-1" />
                  </div>

                  <p className="text-white/40 text-xs mb-1">Sells: {profitableSells} profitable / {totalSells - profitableSells} losing</p>
                  <div className="w-full bg-white/5 rounded-full h-2 mb-4 flex overflow-hidden">
                    <div className="bg-green-400 h-2" style={{ width: totalSells > 0 ? `${(profitableSells/totalSells)*100}%` : "50%" }} />
                    <div className="bg-red-400 h-2 flex-1" />
                  </div>

                  <div className="flex gap-4 text-xs">
                    <div><p className="text-white/40">Avg Win</p><p className="text-green-400 font-bold">${data.avgWin.toFixed(2)}</p></div>
                    <div><p className="text-white/40">Avg Loss</p><p className="text-red-400 font-bold">-${data.avgLoss.toFixed(2)}</p></div>
                    <div><p className="text-white/40">Best</p><p className="text-green-400 font-bold">${data.bestTrade.toFixed(2)}</p></div>
                    <div><p className="text-white/40">Worst</p><p className="text-red-400 font-bold">${data.worstTrade.toFixed(2)}</p></div>
                  </div>
                </div>

                {/* Daily Performance */}
                <div className="glass border border-white/5 rounded-xl p-5">
                  <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Daily Performance</p>
                  <p className="text-white/40 text-xs mb-3">Total days: {dailyResults.length}</p>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-400">{profitableDays}</p>
                      <p className="text-white/40 text-xs">Profitable</p>
                    </div>
                    <div className="flex-1 flex justify-center">
                      <PieChart width={80} height={80}>
                        <Pie data={donutData} cx={35} cy={35} innerRadius={25} outerRadius={38} dataKey="value" strokeWidth={0}>
                          {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                      </PieChart>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-400">{losingDays}</p>
                      <p className="text-white/40 text-xs">Losing</p>
                    </div>
                  </div>
                  {data.sessionBreakdown.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-white/40 text-xs">By Session:</p>
                      {data.sessionBreakdown.map(s => (
                        <div key={s.session} className="flex items-center gap-2">
                          <span className="text-white/50 text-xs w-16 capitalize">{s.session}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${s.winRate >= 50 ? "bg-green-400" : "bg-red-400"}`} style={{ width: `${s.winRate}%` }} />
                          </div>
                          <span className={`text-xs w-12 text-right ${s.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>${s.pnl.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Trade Performance */}
                <div className="glass border border-white/5 rounded-xl p-5">
                  <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Trade Performance</p>
                  {data.strategyBreakdown.length > 0 && (
                    <div className="flex flex-col gap-2 mb-4">
                      <p className="text-white/40 text-xs mb-1">By Strategy:</p>
                      {data.strategyBreakdown.map(s => (
                        <div key={s.strategy} className="flex items-center gap-2">
                          <span className="text-white/50 text-xs w-20 uppercase">{s.strategy}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${s.winRate >= 50 ? "bg-green-400" : "bg-red-400"}`} style={{ width: `${s.winRate}%` }} />
                          </div>
                          <span className={`text-xs w-12 text-right ${s.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>${s.pnl.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {data.emotionBreakdown.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-white/40 text-xs mb-1">By Emotion:</p>
                      {data.emotionBreakdown.map(e => (
                        <div key={e.emotion} className="flex items-center gap-2">
                          <span className="text-white/50 text-xs w-20 capitalize">{e.emotion}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${e.winRate >= 50 ? "bg-green-400" : "bg-red-400"}`} style={{ width: `${e.winRate}%` }} />
                          </div>
                          <span className={`text-xs w-12 text-right ${e.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>${e.pnl.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly ROI */}
              {monthlyData.length > 0 && (
                <div className="glass border border-white/5 rounded-xl p-5 mb-6">
                  <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Monthly ROI</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={monthlyData}>
                      <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                        labelStyle={{ color: "rgba(255,255,255,0.6)" }} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {monthlyData.map((entry, i) => <Cell key={i} fill={entry.pnl >= 0 ? "#00ff88" : "#ff4466"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Calendar */}
              <div className="glass border border-white/5 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                    {MONTHS[currentMonth]} {currentYear}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y-1); } else setCurrentMonth(m => m-1); }}
                      className="text-white/40 hover:text-white px-2 py-1 rounded text-xs border border-white/10">◀</button>
                    <button onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y+1); } else setCurrentMonth(m => m+1); }}
                      className="text-white/40 hover:text-white px-2 py-1 rounded text-xs border border-white/10">▶</button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map(d => <p key={d} className="text-center text-white/30 text-xs py-1">{d}</p>)}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const pnl = calendarData[day.toString()];
                    const hasData = pnl !== undefined;
                    const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
                    return (
                      <div key={day} className={`rounded-lg p-1 text-center border transition ${
                        isToday ? "border-green-400/50" : "border-white/5"
                      } ${
                        hasData && pnl > 0 ? "bg-green-500/15" :
                        hasData && pnl < 0 ? "bg-red-500/15" :
                        "bg-white/2"
                      }`}>
                        <p className="text-white/50 text-xs">{day}</p>
                        {hasData && (
                          <p className={`text-xs font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}