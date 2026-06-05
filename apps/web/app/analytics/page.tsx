"use client";
import { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useTradeStore } from "@/store/tradeStore";
import { useJournalStore } from "@/store/journalStore";
import { calculateRiskScore, getRiskColor } from "@/store/riskStore";
import { TCC_SYMBOL_MAP } from "@/lib/markets/symbols";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import {
  calculatePerformanceOverview,
  calculateEquityCurve,
  calculateMonthlyPnl,
  calculateCalendarPnl,
  calculateRiskAnalytics,
  calculateSymbolAnalytics,
  calculateSessionAnalytics,
  calculateStrategyAnalytics,
  calculateBehaviorAnalytics,
  calculateDisciplineScore,
  calculateFundedReadiness,
  generateRuleBasedReview,
  formatDuration,
  safeDate,
  PAPER_INITIAL_BALANCE,
} from "@/lib/analytics/performance";

const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function pnlColor(val: number): string {
  if (val > 0.01) return "text-green-400";
  if (val < -0.01) return "text-red-400";
  return "text-white/40";
}

function pnlBg(val: number): string {
  if (val > 0.01) return "bg-green-500/15 border-green-500/20";
  if (val < -0.01) return "bg-red-500/15 border-red-500/20";
  return "bg-white/3 border-white/5";
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <p className="text-3xl mb-3">📊</p>
        <p className="text-white/25 text-sm">{message}</p>
        {sub && <p className="text-white/15 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "text-white", sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="glass border border-white/5 rounded-xl p-4">
      <p className="text-white/40 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-white/25 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

type TabKey = "overview" | "risk" | "symbols" | "sessions" | "behavior" | "intelligence";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview",     label: "📊 Overview"     },
  { key: "risk",         label: "⚠ Risk"           },
  { key: "symbols",      label: "🪙 Symbols"       },
  { key: "sessions",     label: "🕐 Sessions"      },
  { key: "behavior",     label: "🧠 Behavior"      },
  { key: "intelligence", label: "🎯 Intelligence"  },
];

export default function AnalyticsPage() {
  const { closedTrades, positions, balance, equity, floatingPnl } = useTradeStore();
  const { entries } = useJournalStore();

  const [activeTab,    setActiveTab]    = useState<TabKey>("overview");
  const [calendarMonth,setCalendarMonth]= useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [equityFilter, setEquityFilter] = useState<"all"|"30d"|"7d">("all");

  const riskScore       = useMemo(() => calculateRiskScore(),                                                            [positions.length, floatingPnl, equity]);
  const perf            = useMemo(() => calculatePerformanceOverview(closedTrades as any, balance, equity, floatingPnl, positions as any), [closedTrades, balance, equity, floatingPnl, positions]);
  const fullEquityCurve = useMemo(() => calculateEquityCurve(closedTrades as any),                                      [closedTrades]);

  const equityCurve = useMemo(() => {
    if (equityFilter === "all" || fullEquityCurve.length <= 2) return fullEquityCurve;
    const cutoffMs = Date.now() - (equityFilter === "7d" ? 7 : 30) * 86_400_000;
    const sorted = [...closedTrades].sort((a, b) => (safeDate(a.closedAt)?.getTime() ?? 0) - (safeDate(b.closedAt)?.getTime() ?? 0));
    const recent = fullEquityCurve.slice(1).filter((_, i) => {
      const t = sorted[i];
      return t ? (safeDate(t.closedAt)?.getTime() ?? 0) >= cutoffMs : false;
    });
    return [fullEquityCurve[0], ...recent];
  }, [fullEquityCurve, closedTrades, equityFilter]);

  const monthlyPnl        = useMemo(() => calculateMonthlyPnl(closedTrades as any),                              [closedTrades]);
  const calendarPnl       = useMemo(() => calculateCalendarPnl(closedTrades as any),                             [closedTrades]);
  const riskAnalytics     = useMemo(() => calculateRiskAnalytics(riskScore, closedTrades as any, positions as any),[riskScore, closedTrades, positions]);
  const symbolAnalytics   = useMemo(() => calculateSymbolAnalytics(closedTrades as any, TCC_SYMBOL_MAP as any),  [closedTrades]);
  const sessionAnalytics  = useMemo(() => calculateSessionAnalytics(entries as any),                             [entries]);
  const strategyAnalytics = useMemo(() => calculateStrategyAnalytics(entries as any),                            [entries]);
  const behaviorAnalytics = useMemo(() => calculateBehaviorAnalytics(entries as any),                            [entries]);
  const disciplineScore   = useMemo(() => calculateDisciplineScore(entries as any, closedTrades as any),         [entries, closedTrades]);
  const fundedReadiness   = useMemo(() => calculateFundedReadiness(perf, disciplineScore, riskAnalytics),        [perf, disciplineScore, riskAnalytics]);
  const insights          = useMemo(() => generateRuleBasedReview(perf, symbolAnalytics, sessionAnalytics, behaviorAnalytics), [perf, symbolAnalytics, sessionAnalytics, behaviorAnalytics]);

  const today        = new Date();
  const daysInMonth  = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstWeekday = new Date(calendarYear, calendarMonth, 1).getDay();

  const prevMonth = () => { if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); } else setCalendarMonth(m => m - 1); };
  const nextMonth = () => { if (calendarMonth === 11) { setCalendarMonth(0);  setCalendarYear(y => y + 1); } else setCalendarMonth(m => m + 1); };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Tab bar — full width */}
          <div className="flex border-b border-white/5 bg-black/20 shrink-0 px-6 items-center">
            <div className="flex gap-0.5">
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${activeTab === tab.key ? "text-green-400 border-green-400" : "text-white/40 border-transparent hover:text-white/60"}`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-white/20">{closedTrades.length} closed trade{closedTrades.length !== 1 ? "s" : ""}</span>
              <span className="text-xs text-green-400/40 bg-green-500/5 border border-green-500/10 px-2 py-0.5 rounded-full">Paper Analytics · Local only</span>
            </div>
          </div>

          {/* Scrollable content — full width, no max-w */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* ═══════════════════════════════════════════════════ OVERVIEW */}
            {activeTab === "overview" && (
              <div className="flex flex-col gap-6 w-full">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Performance Overview</h2>
                  <p className="text-white/30 text-xs">
                    Derived from {perf.totalTrades} closed paper trade{perf.totalTrades !== 1 ? "s" : ""}.
                    {perf.openPositions > 0 && ` ${perf.openPositions} position${perf.openPositions > 1 ? "s" : ""} currently open.`}
                  </p>
                </div>

                {closedTrades.length === 0 ? (
                  <EmptyState message="No closed paper trades yet." sub="Close trades from the Dashboard to unlock performance analytics." />
                ) : (
                  <>
                    {/* 12 stat cards — responsive grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                      <StatCard label="Total Trades"   value={perf.totalTrades} />
                      <StatCard label="Win Rate"       value={`${perf.winRate}%`}  color={perf.winRate >= 50 ? "text-green-400" : "text-red-400"} sub={`${perf.wins}W · ${perf.losses}L · ${perf.breakevens}BE`} />
                      <StatCard label="Net P&L"        value={`${perf.netPnl >= 0 ? "+" : ""}$${perf.netPnl}`} color={perf.netPnl >= 0 ? "text-green-400" : "text-red-400"} sub="after simulated commission" />
                      <StatCard label="ROI"            value={`${perf.roiPercent >= 0 ? "+" : ""}${perf.roiPercent}%`} color={perf.roiPercent >= 0 ? "text-green-400" : "text-red-400"} sub={`from $${PAPER_INITIAL_BALANCE.toLocaleString()} start`} />
                      <StatCard label="Profit Factor"  value={perf.profitFactor === 999 ? "∞" : perf.profitFactor} color={perf.profitFactor >= 1.5 ? "text-green-400" : perf.profitFactor >= 1.0 ? "text-amber-400" : "text-red-400"} />
                      <StatCard label="Avg Win"        value={`+$${perf.avgWin}`}  color="text-green-400" sub={`${perf.wins} win${perf.wins !== 1 ? "s" : ""}`} />
                      <StatCard label="Avg Loss"       value={`-$${perf.avgLoss}`} color="text-red-400"   sub={`${perf.losses} loss${perf.losses !== 1 ? "es" : ""}`} />
                      <StatCard label="Avg Duration"   value={formatDuration(perf.avgDurationMs)} />
                      <StatCard label="Best Trade"     value={`+$${perf.bestTrade}`}  color="text-green-400" />
                      <StatCard label="Worst Trade"    value={`$${perf.worstTrade}`}  color="text-red-400"   />
                      <StatCard label="Floating P&L"   value={`${perf.floatingPnl >= 0 ? "+" : ""}$${perf.floatingPnl}`} color={perf.floatingPnl >= 0 ? "text-green-400" : "text-red-400"} sub={`${perf.openPositions} open`} />
                      <StatCard label="Equity"         value={`$${perf.equity.toFixed(2)}`} color={perf.equity >= PAPER_INITIAL_BALANCE ? "text-green-400" : "text-red-400"} sub={`Bal: $${perf.balance.toFixed(2)}`} />
                    </div>

                    {/* Close reason + equity curve side by side on wide screens */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                      <div className="glass border border-white/5 rounded-xl p-5">
                        <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Close Reason Breakdown</p>
                        <div className="flex flex-col gap-4">
                          {[
                            { label: "Manual",        count: perf.manualCloses, color: "text-white/60", icon: "📤" },
                            { label: "Stop Loss Hit",  count: perf.slHits,       color: "text-red-400",   icon: "⛔" },
                            { label: "Take Profit Hit",count: perf.tpHits,       color: "text-green-400", icon: "✅" },
                          ].map(item => (
                            <div key={item.label} className="flex items-center gap-3">
                              <span className="text-2xl">{item.icon}</span>
                              <div>
                                <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
                                <p className="text-white/30 text-xs">{item.label}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Equity curve — takes remaining 2/3 */}
                      <div className="xl:col-span-2 glass border border-white/5 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-white/40 text-xs uppercase tracking-wider">Equity Curve (Paper)</p>
                            <p className={`text-2xl font-bold mt-1 ${perf.roiPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {perf.roiPercent >= 0 ? "+" : ""}{perf.roiPercent}% ROI
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {(["7d","30d","all"] as const).map(f => (
                              <button key={f} onClick={() => setEquityFilter(f)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${equityFilter === f ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10"}`}>
                                {f === "all" ? "ALL" : f}
                              </button>
                            ))}
                          </div>
                        </div>
                        {equityCurve.length > 1 ? (
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={equityCurve}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} interval="preserveStartEnd" />
                              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} domain={["auto","auto"]} />
                              <Tooltip contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} formatter={(val: any) => [`$${Number(val).toFixed(2)}`, "Equity"]} />
                              <Line type="monotone" dataKey="equity" stroke="#00ff88" strokeWidth={2} dot={{ r: 2, fill: "#00ff88" }} activeDot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <EmptyState message="Equity curve appears after 2+ closed trades" />
                        )}
                      </div>
                    </div>

                    {/* Monthly P&L + Calendar side by side */}
                    {monthlyPnl.length > 0 && (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="glass border border-white/5 rounded-xl p-5">
                          <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Monthly P&L (Paper)</p>
                          <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={monthlyPnl}>
                              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                              <Tooltip contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} formatter={(val: any) => [`${Number(val) >= 0 ? "+" : ""}$${Number(val).toFixed(2)}`, "Net P&L"]} />
                              <Bar dataKey="pnl" radius={[4,4,0,0]}>
                                {monthlyPnl.map((m, i) => <Cell key={i} fill={m.pnl >= 0 ? "#00ff88" : "#ff4466"} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Calendar */}
                        <div className="glass border border-white/5 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-white/40 text-xs uppercase tracking-wider">{MONTHS_FULL[calendarMonth]} {calendarYear}</p>
                            <div className="flex gap-1">
                              <button onClick={prevMonth} className="text-white/40 hover:text-white px-2 py-1 rounded text-xs border border-white/10 transition">◀</button>
                              <button onClick={() => { setCalendarMonth(today.getMonth()); setCalendarYear(today.getFullYear()); }} className="text-white/40 hover:text-white px-2 py-1 rounded text-xs border border-white/10 transition">Today</button>
                              <button onClick={nextMonth} className="text-white/40 hover:text-white px-2 py-1 rounded text-xs border border-white/10 transition">▶</button>
                            </div>
                          </div>
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {DAYS_SHORT.map(d => <p key={d} className="text-center text-white/20 text-xs py-1">{d}</p>)}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e-${i}`} />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                              const day = i + 1;
                              const key = `${calendarYear}-${String(calendarMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                              const dayData = calendarPnl[key];
                              const isToday = today.getDate() === day && today.getMonth() === calendarMonth && today.getFullYear() === calendarYear;
                              return (
                                <div key={day} className={`rounded-lg p-1 text-center border cursor-default ${isToday ? "border-green-400/40" : "border-white/5"} ${dayData ? pnlBg(dayData.pnl) : "bg-white/2"}`}
                                  title={dayData ? `${dayData.trades}t · ${dayData.pnl >= 0 ? "+" : ""}$${dayData.pnl.toFixed(2)}` : ""}>
                                  <p className={`text-xs ${isToday ? "text-green-400/70" : "text-white/30"}`}>{day}</p>
                                  {dayData && <p className={`text-xs font-bold leading-tight ${pnlColor(dayData.pnl)}`}>{dayData.pnl >= 0 ? "+" : ""}{dayData.pnl.toFixed(0)}</p>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ RISK */}
            {activeTab === "risk" && (
              <div className="flex flex-col gap-6 w-full">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Risk Analytics</h2>
                  <p className="text-white/30 text-xs">Risk analysis from paper trading state. Not broker-verified.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`glass border rounded-xl p-5 ${riskAnalytics.riskLevel === "EXTREME" ? "border-red-500/30 bg-red-500/5" : riskAnalytics.riskLevel === "HIGH" ? "border-orange-500/30 bg-orange-500/5" : riskAnalytics.riskLevel === "MEDIUM" ? "border-amber-500/30 bg-amber-500/5" : "border-green-500/20 bg-green-500/3"}`}>
                    <p className="text-white/40 text-xs mb-1">Current Risk Level</p>
                    <p className={`text-2xl font-bold ${getRiskColor(riskAnalytics.riskLevel as any)}`}>{riskAnalytics.riskLevel}</p>
                    <p className="text-white/30 text-xs mt-1">Score: {riskAnalytics.riskScore}/100</p>
                  </div>
                  <StatCard label="Max Drawdown" value={`${riskAnalytics.drawdownPercent.toFixed(1)}%`}
                    color={riskAnalytics.drawdownPercent < 5 ? "text-green-400" : riskAnalytics.drawdownPercent < 10 ? "text-amber-400" : "text-red-400"}
                    sub={`$${riskAnalytics.drawdownAmount.toFixed(2)} from peak $${riskAnalytics.peakEquity.toFixed(2)}`} />
                  <StatCard label="Max Consecutive Losses" value={riskAnalytics.maxConsecutiveLosses}
                    color={riskAnalytics.maxConsecutiveLosses >= 4 ? "text-red-400" : riskAnalytics.maxConsecutiveLosses >= 2 ? "text-amber-400" : "text-white"} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="SL Hits"         value={riskAnalytics.slHitCount}        color="text-red-400"   />
                  <StatCard label="TP Hits"          value={riskAnalytics.tpHitCount}        color="text-green-400" />
                  <StatCard label="Manual Closes"    value={riskAnalytics.manualCloseCount}  />
                  <StatCard label="Open Without SL"  value={riskAnalytics.positionsWithoutSL} color={riskAnalytics.positionsWithoutSL > 0 ? "text-red-400" : "text-green-400"} />
                </div>
                {riskAnalytics.maxDrawdownTrade < 0 && (
                  <div className="glass border border-red-500/10 rounded-xl p-5">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Worst Single Paper Trade</p>
                    <p className="text-red-400 text-2xl font-bold">${riskAnalytics.maxDrawdownTrade.toFixed(2)}</p>
                  </div>
                )}
                {riskScore.factors.length > 0 ? (
                  <div className="glass border border-white/5 rounded-xl p-5">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Active Risk Factors</p>
                    <div className="flex flex-col gap-2">
                      {riskScore.factors.map((f, i) => (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${f.severity === "danger" ? "bg-red-500/8" : f.severity === "warning" ? "bg-amber-500/8" : "bg-white/3"}`}>
                          <span className="text-base shrink-0">{f.severity === "danger" ? "🔴" : f.severity === "warning" ? "🟡" : "🟢"}</span>
                          <div className="flex-1">
                            <p className={`text-xs font-semibold ${f.severity === "danger" ? "text-red-400" : f.severity === "warning" ? "text-amber-400" : "text-white/60"}`}>{f.name}</p>
                            <p className="text-white/30 text-xs">{f.description}</p>
                          </div>
                          <span className="text-white/20 text-xs shrink-0">+{f.score} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="glass border border-green-500/10 rounded-xl p-5">
                    <p className="text-green-400 text-sm font-semibold">✓ No active risk factors</p>
                    <p className="text-white/30 text-xs mt-1">{riskScore.recommendation}</p>
                  </div>
                )}
                {closedTrades.length === 0 && positions.length === 0 && (
                  <EmptyState message="No active positions or closed trades." sub="Risk analytics populate once you have paper trading activity." />
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ SYMBOLS */}
            {activeTab === "symbols" && (
              <div className="flex flex-col gap-6 w-full">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Symbol Analytics</h2>
                  <p className="text-white/30 text-xs">Performance by symbol across your closed paper trades.</p>
                </div>
                {symbolAnalytics.length === 0 ? (
                  <EmptyState message="No closed trades yet." sub="Close paper trades to see per-symbol performance." />
                ) : (
                  <>
                    <div className="glass border border-white/5 rounded-xl overflow-hidden w-full">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/2">
                            <th className="text-left px-4 py-3 text-white/40">Symbol</th>
                            <th className="text-right px-4 py-3 text-white/40">Trades</th>
                            <th className="text-right px-4 py-3 text-white/40">Win Rate</th>
                            <th className="text-right px-4 py-3 text-white/40">Net P&L</th>
                            <th className="text-right px-4 py-3 text-white/40">Avg P&L</th>
                            <th className="text-right px-4 py-3 text-white/40">Best</th>
                            <th className="text-right px-4 py-3 text-white/40">Worst</th>
                          </tr>
                        </thead>
                        <tbody>
                          {symbolAnalytics.map(s => (
                            <tr key={s.symbolId} className="border-b border-white/5 hover:bg-white/2 transition">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{s.emoji}</span>
                                  <div><p className="text-white font-semibold">{s.displayName}</p><p className="text-white/30 capitalize">{s.category}</p></div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-white/60">{s.trades}</td>
                              <td className={`px-4 py-3 text-right font-semibold ${s.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>{s.winRate}%</td>
                              <td className={`px-4 py-3 text-right font-bold ${pnlColor(s.netPnl)}`}>{s.netPnl >= 0 ? "+" : ""}${s.netPnl.toFixed(2)}</td>
                              <td className={`px-4 py-3 text-right ${pnlColor(s.avgPnl)}`}>{s.avgPnl >= 0 ? "+" : ""}${s.avgPnl.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-green-400">+${s.bestTrade.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-red-400">${s.worstTrade.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {symbolAnalytics.length > 1 && (
                      <div className="glass border border-white/5 rounded-xl p-5 w-full">
                        <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Net P&L by Symbol</p>
                        <ResponsiveContainer width="100%" height={Math.max(100, symbolAnalytics.length * 32)}>
                          <BarChart data={symbolAnalytics} layout="vertical">
                            <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                            <YAxis type="category" dataKey="displayName" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} width={70} />
                            <Tooltip contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} formatter={(val: any) => [`${Number(val) >= 0 ? "+" : ""}$${Number(val).toFixed(2)}`, "Net P&L"]} />
                            <Bar dataKey="netPnl" radius={[0,4,4,0]}>
                              {symbolAnalytics.map((s, i) => <Cell key={i} fill={s.netPnl >= 0 ? "#00ff88" : "#ff4466"} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ SESSIONS */}
            {activeTab === "sessions" && (
              <div className="flex flex-col gap-6 w-full">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Session & Strategy Analytics</h2>
                  <p className="text-white/30 text-xs">Derived from journal entries. Tag strategies in your journal to unlock strategy analytics.</p>
                </div>
                <div className="glass border border-white/5 rounded-xl p-5">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Session Performance</p>
                  {sessionAnalytics.length === 0 ? (
                    <EmptyState message="No journal data with session tags yet." sub="Close trades — journal entries are auto-created with session detection." />
                  ) : (
                    <>
                      <div className="flex flex-col gap-3 mb-5">
                        {sessionAnalytics.map(s => (
                          <div key={s.session} className="flex items-center gap-4">
                            <span className="text-white/60 text-xs capitalize w-20 shrink-0">{s.session}</span>
                            <div className="flex-1 bg-white/5 rounded-full h-2">
                              <div className={`h-2 rounded-full ${s.winRate >= 50 ? "bg-green-400" : "bg-red-400"}`} style={{ width: `${Math.min(s.winRate, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-semibold w-20 text-right ${pnlColor(s.netPnl)}`}>{s.netPnl >= 0 ? "+" : ""}${s.netPnl.toFixed(2)}</span>
                            <span className="text-white/30 text-xs w-16 text-right">{s.winRate}% WR</span>
                            <span className="text-white/20 text-xs w-8 text-right">{s.trades}t</span>
                          </div>
                        ))}
                      </div>
                      {sessionAnalytics.length > 1 && (
                        <ResponsiveContainer width="100%" height={120}>
                          <BarChart data={sessionAnalytics}>
                            <XAxis dataKey="session" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: "#0a0a0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} formatter={(val: any) => [`${Number(val) >= 0 ? "+" : ""}$${Number(val).toFixed(2)}`, "Net P&L"]} />
                            <Bar dataKey="netPnl" radius={[4,4,0,0]}>
                              {sessionAnalytics.map((s, i) => <Cell key={i} fill={s.netPnl >= 0 ? "#00ff88" : "#ff4466"} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </>
                  )}
                </div>
                <div className="glass border border-white/5 rounded-xl p-5">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Strategy Performance</p>
                  {strategyAnalytics.length === 0 ? (
                    <EmptyState message="No strategy data yet." sub="Tag strategies in your journal entries to unlock this section." />
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/2">
                          <th className="text-left px-4 py-3 text-white/40">Strategy</th>
                          <th className="text-right px-4 py-3 text-white/40">Trades</th>
                          <th className="text-right px-4 py-3 text-white/40">Win Rate</th>
                          <th className="text-right px-4 py-3 text-white/40">Net P&L</th>
                          <th className="text-right px-4 py-3 text-white/40">Avg P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {strategyAnalytics.map(s => (
                          <tr key={s.strategy} className="border-b border-white/5 hover:bg-white/2 transition">
                            <td className="px-4 py-3 text-white font-medium">{s.strategy}</td>
                            <td className="px-4 py-3 text-right text-white/60">{s.trades}</td>
                            <td className={`px-4 py-3 text-right ${s.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>{s.winRate}%</td>
                            <td className={`px-4 py-3 text-right font-bold ${pnlColor(s.netPnl)}`}>{s.netPnl >= 0 ? "+" : ""}${s.netPnl.toFixed(2)}</td>
                            <td className={`px-4 py-3 text-right ${pnlColor(s.avgPnl)}`}>{s.avgPnl >= 0 ? "+" : ""}${s.avgPnl.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ BEHAVIOR */}
            {activeTab === "behavior" && (
              <div className="flex flex-col gap-6 w-full">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Behavior Analytics</h2>
                  <p className="text-white/30 text-xs">Patterns from your journal — emotion, discipline, entry quality.</p>
                </div>
                {behaviorAnalytics.totalClosedEntries === 0 ? (
                  <EmptyState message="No journal data yet." sub="Behavior analytics require closed paper trades with journal entries." />
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard label="Trades Journaled" value={behaviorAnalytics.totalClosedEntries} />
                      <StatCard label="Plan Adherence"
                        value={behaviorAnalytics.withPlanDataCount > 0 ? `${behaviorAnalytics.followedPlanPercent}%` : "No data"}
                        color={behaviorAnalytics.followedPlanPercent >= 70 ? "text-green-400" : behaviorAnalytics.followedPlanPercent >= 50 ? "text-amber-400" : "text-red-400"}
                        sub={behaviorAnalytics.withPlanDataCount > 0 ? `${behaviorAnalytics.didNotFollowPlanCount} deviations` : "Mark plan in journal"} />
                      <StatCard label="Avg Confidence" value={`${behaviorAnalytics.avgConfidence}/10`} color={behaviorAnalytics.avgConfidence >= 7 ? "text-green-400" : "text-amber-400"} />
                      <StatCard label="Avg Stress" value={`${behaviorAnalytics.avgStress}/10`} color={behaviorAnalytics.avgStress <= 4 ? "text-green-400" : behaviorAnalytics.avgStress <= 6 ? "text-amber-400" : "text-red-400"} />
                    </div>
                    <div className="glass border border-white/5 rounded-xl p-5">
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Entry Quality Patterns</p>
                      <div className="flex gap-3 flex-wrap">
                        {[
                          { label: "Impulsive", count: behaviorAnalytics.impulsiveEntries, color: "text-red-400",  bg: "bg-red-500/8" },
                          { label: "Early Entry", count: behaviorAnalytics.earlyEntries,   color: "text-amber-400",bg: "bg-amber-500/8" },
                          { label: "Late Entry",  count: behaviorAnalytics.lateEntries,    color: "text-amber-400",bg: "bg-amber-500/8" },
                          { label: "Missing Notes",count: behaviorAnalytics.missingNotes,  color: "text-white/40", bg: "bg-white/3" },
                          { label: "Missing Lessons",count: behaviorAnalytics.missingLessons,color:"text-white/40",bg: "bg-white/3" },
                        ].map(item => (
                          <div key={item.label} className={`flex-1 min-w-[120px] ${item.bg} border border-white/5 rounded-xl p-4 text-center`}>
                            <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
                            <p className="text-white/30 text-xs mt-1">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {behaviorAnalytics.emotionBreakdown.length > 0 && (
                      <div className="glass border border-white/5 rounded-xl p-5">
                        <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Emotion vs Performance</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/2">
                              <th className="text-left px-4 py-3 text-white/40">Emotion</th>
                              <th className="text-right px-4 py-3 text-white/40">Trades</th>
                              <th className="text-right px-4 py-3 text-white/40">Win Rate</th>
                              <th className="text-right px-4 py-3 text-white/40">Net P&L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {behaviorAnalytics.emotionBreakdown.map(e => (
                              <tr key={e.emotion} className="border-b border-white/5 hover:bg-white/2">
                                <td className="px-4 py-3 text-white capitalize">{e.emotion}</td>
                                <td className="px-4 py-3 text-right text-white/60">{e.trades}</td>
                                <td className={`px-4 py-3 text-right ${e.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>{e.winRate}%</td>
                                <td className={`px-4 py-3 text-right font-bold ${pnlColor(e.netPnl)}`}>{e.netPnl >= 0 ? "+" : ""}${e.netPnl.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ INTELLIGENCE */}
            {activeTab === "intelligence" && (
              <div className="flex flex-col gap-6 w-full">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Performance Intelligence</h2>
                  <p className="text-white/30 text-xs">Rule-based discipline score, funded challenge readiness, and local performance review. Paper trading data only.</p>
                </div>

                {/* Discipline + Funded side by side on wide screens */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {/* Discipline Score */}
                  <div className="glass border border-white/5 rounded-xl p-5">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Discipline Score</p>
                    {!disciplineScore.hasEnoughData ? (
                      <div>
                        <p className="text-white/50 text-sm mb-2">Discipline score unlocks after 5 closed paper trades.</p>
                        <div className="w-full bg-white/5 rounded-full h-2 mb-1">
                          <div className="bg-green-500/40 h-2 rounded-full" style={{ width: `${Math.min((closedTrades.length/5)*100,100)}%` }} />
                        </div>
                        <p className="text-white/20 text-xs">{closedTrades.length}/5 trades</p>
                      </div>
                    ) : (
                      <div className="flex gap-6">
                        <div className="flex flex-col items-center justify-center w-28 shrink-0 gap-2">
                          <div className={`text-5xl font-black ${disciplineScore.total >= 85 ? "text-green-400" : disciplineScore.total >= 70 ? "text-blue-400" : disciplineScore.total >= 55 ? "text-amber-400" : disciplineScore.total >= 40 ? "text-orange-400" : "text-red-400"}`}>{disciplineScore.total}</div>
                          <p className="text-white/30 text-xs">/100</p>
                          <span className={`text-sm font-bold px-3 py-0.5 rounded-full ${disciplineScore.grade === "A" ? "text-green-400 bg-green-500/15" : disciplineScore.grade === "B" ? "text-blue-400 bg-blue-500/15" : disciplineScore.grade === "C" ? "text-amber-400 bg-amber-500/15" : disciplineScore.grade === "D" ? "text-orange-400 bg-orange-500/15" : "text-red-400 bg-red-500/15"}`}>Grade {disciplineScore.grade}</span>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div className={`h-2 rounded-full ${disciplineScore.total >= 70 ? "bg-green-400" : disciplineScore.total >= 50 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${disciplineScore.total}%` }} />
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col gap-2">
                          {disciplineScore.components.map(c => (
                            <div key={c.name}>
                              <div className="flex justify-between mb-0.5">
                                <span className="text-white/60 text-xs">{c.name}</span>
                                <span className="text-white/40 text-xs">{c.score}/{c.maxScore}</span>
                              </div>
                              <div className="w-full bg-white/5 rounded-full h-1.5 mb-0.5">
                                <div className={`h-1.5 rounded-full ${c.score >= c.maxScore*0.7 ? "bg-green-400" : c.score >= c.maxScore*0.4 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${(c.score/c.maxScore)*100}%` }} />
                              </div>
                              <p className="text-white/20 text-xs">{c.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Funded Readiness */}
                  <div className="glass border border-white/5 rounded-xl p-5">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Funded Challenge Readiness</p>
                    <div className={`flex items-center gap-3 mb-4 p-3 rounded-xl border ${fundedReadiness.level === "strong" ? "border-green-500/30 bg-green-500/5" : fundedReadiness.level === "moderate" ? "border-amber-500/30 bg-amber-500/5" : "border-white/10 bg-white/2"}`}>
                      <span className="text-2xl">{fundedReadiness.level === "strong" ? "🟢" : fundedReadiness.level === "moderate" ? "🟡" : fundedReadiness.level === "building" ? "🔵" : "⚪"}</span>
                      <div>
                        <p className={`font-bold text-sm ${fundedReadiness.level === "strong" ? "text-green-400" : fundedReadiness.level === "moderate" ? "text-amber-400" : "text-white/70"}`}>{fundedReadiness.label}</p>
                        <p className="text-white/40 text-xs mt-0.5">{fundedReadiness.description}</p>
                      </div>
                    </div>
                    {fundedReadiness.components.length > 0 && (
                      <div className="flex flex-col gap-2 mb-3">
                        {fundedReadiness.components.map(c => (
                          <div key={c.name} className="flex items-center gap-2">
                            <span className="text-sm shrink-0">{c.status === "pass" ? "✅" : c.status === "warn" ? "⚠️" : c.status === "fail" ? "❌" : "❔"}</span>
                            <span className="text-white/60 text-xs w-40 shrink-0">{c.name}</span>
                            <span className={`text-xs ${c.status === "pass" ? "text-green-400" : c.status === "warn" ? "text-amber-400" : c.status === "fail" ? "text-red-400" : "text-white/30"}`}>{c.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="bg-white/3 border border-white/5 rounded-lg p-3">
                      <p className="text-white/20 text-xs leading-relaxed italic">{fundedReadiness.disclaimer}</p>
                    </div>
                  </div>
                </div>

                {/* Local Performance Review — full width */}
                <div className="glass border border-white/5 rounded-xl p-5 w-full">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wider">Local Performance Review</p>
                      <p className="text-white/20 text-xs mt-0.5">Rule-based insights from your paper trading data. Not AI — not financial advice.</p>
                    </div>
                    <span className="text-xs bg-white/5 text-white/30 border border-white/10 px-2 py-0.5 rounded-full">Rule-based · Local only</span>
                  </div>
                  {insights.length === 0 ? (
                    <EmptyState message="No insights yet." sub="Close more paper trades to generate a meaningful local performance review." />
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                      {insights.map((insight, i) => (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${insight.type === "positive" ? "bg-green-500/5 border-green-500/15" : insight.type === "warning" ? "bg-amber-500/5 border-amber-500/15" : "bg-white/3 border-white/5"}`}>
                          <span className="text-base shrink-0 mt-0.5">{insight.type === "positive" ? "✅" : insight.type === "warning" ? "⚠️" : "💡"}</span>
                          <p className={`text-sm leading-relaxed ${insight.type === "positive" ? "text-green-400/90" : insight.type === "warning" ? "text-amber-400/90" : "text-white/60"}`}>{insight.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}