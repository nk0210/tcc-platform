"use client";
import { useState } from "react";
import { useCompetitionStore, Competition } from "@/store/competitionStore";
import { useAuthStore } from "@/store/authStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

const divisionColors: Record<string, string> = {
  ROOKIE: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  SEMI_PRO: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  PRO: "text-green-400 border-green-500/30 bg-green-500/10",
};

const statusColors: Record<string, string> = {
  LIVE: "text-green-400 bg-green-500/10 border-green-500/30",
  UPCOMING: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  ENDED: "text-white/30 bg-white/5 border-white/10",
};

function daysLeft(endDate: Date): string {
  const diff = new Date(endDate).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return "Ended";
  if (days === 0) return "Last day!";
  return `${days} days left`;
}

export default function CompetitionPage() {
  const { competitions, activeCompetition, setActiveCompetition, joinCompetition } = useCompetitionStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"leaderboard" | "rules" | "spectate">("leaderboard");
  const [joined, setJoined] = useState(false);

  const handleJoin = (competition: Competition) => {
    if (!user) return;
    joinCompetition(competition.id, user.handle || "guest", user.skillLevel || "ROOKIE");
    setJoined(true);
  };

  const isJoined = activeCompetition?.participants.find(p => p.handle === (user?.handle || "guest"));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">🏆 Trading Competitions</h1>
              <p className="text-white/40 text-sm mt-1">Compete, rank up, get drafted. Trading is a sport.</p>
            </div>
          </div>

          <div className="flex gap-6">

            {/* Left — Competition List */}
            <div className="w-72 shrink-0 flex flex-col gap-3">
              {competitions.map((comp) => (
                <div key={comp.id}
                  onClick={() => setActiveCompetition(comp)}
                  className={`glass border rounded-xl p-4 cursor-pointer transition hover:border-white/20 ${activeCompetition?.id === comp.id ? "border-green-500/30 bg-green-500/5" : "border-white/5"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[comp.status]}`}>
                      {comp.status === "LIVE" ? "🔴 LIVE" : comp.status === "UPCOMING" ? "⏳ UPCOMING" : "✓ ENDED"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${divisionColors[comp.division]}`}>
                      {comp.division}
                    </span>
                  </div>
                  <p className="text-white font-semibold text-sm mb-1">{comp.name}</p>
                  <p className="text-white/40 text-xs mb-2">{comp.asset} · {comp.participants.length} traders</p>
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 text-sm font-bold">{comp.prizePool}</span>
                    <span className="text-white/30 text-xs">{daysLeft(comp.endDate)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Right — Active Competition */}
            {activeCompetition && (
              <div className="flex-1 flex flex-col gap-4">

                {/* Competition Header */}
                <div className="glass border border-white/5 rounded-xl p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[activeCompetition.status]}`}>
                          {activeCompetition.status === "LIVE" ? "🔴 LIVE" : activeCompetition.status === "UPCOMING" ? "⏳ UPCOMING" : "✓ ENDED"}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${divisionColors[activeCompetition.division]}`}>
                          {activeCompetition.division}
                        </span>
                        <span className="text-white/30 text-xs">{daysLeft(activeCompetition.endDate)}</span>
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-1">{activeCompetition.name}</h2>
                      <p className="text-white/50 text-sm">{activeCompetition.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-xs mb-1">Prize Pool</p>
                      <p className="text-3xl font-bold text-green-400">{activeCompetition.prizePool}</p>
                      <p className="text-white/30 text-xs mt-1">{activeCompetition.participants.length} participants</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    {!isJoined && activeCompetition.status !== "ENDED" ? (
                      <button onClick={() => handleJoin(activeCompetition)}
                        className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-6 py-2 rounded-lg text-sm font-semibold transition">
                        🏁 Join Competition
                      </button>
                    ) : isJoined ? (
                      <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-4 py-2 rounded-lg text-sm font-semibold">
                        ✓ Joined
                      </span>
                    ) : null}
                    <button onClick={() => setActiveTab("spectate")}
                      className="bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 px-4 py-2 rounded-lg text-sm transition">
                      👁 Spectate
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                  {(["leaderboard", "rules", "spectate"] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 rounded-md text-xs font-semibold capitalize transition ${activeTab === tab ? "bg-green-500/20 text-green-400" : "text-white/40"}`}>
                      {tab === "leaderboard" ? "🏆 Leaderboard" : tab === "rules" ? "📋 Rules" : "👁 Spectate"}
                    </button>
                  ))}
                </div>

                {/* Leaderboard */}
                {activeTab === "leaderboard" && (
                  <div className="glass border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/2">
                          <th className="text-left px-4 py-3 text-white/40">Rank</th>
                          <th className="text-left px-4 py-3 text-white/40">Trader</th>
                          <th className="text-left px-4 py-3 text-white/40">Level</th>
                          <th className="text-right px-4 py-3 text-white/40">Balance</th>
                          <th className="text-right px-4 py-3 text-white/40">P&L</th>
                          <th className="text-right px-4 py-3 text-white/40">Return</th>
                          <th className="text-right px-4 py-3 text-white/40">Trades</th>
                          <th className="text-right px-4 py-3 text-white/40">Win Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCompetition.participants.map((p, i) => {
                          const isMe = p.handle === (user?.handle || "guest");
                          return (
                            <tr key={p.id} className={`border-b border-white/5 transition ${isMe ? "bg-green-500/5 border-green-500/10" : "hover:bg-white/2"}`}>
                              <td className="px-4 py-3">
                                <span className="text-lg">{p.badge || `#${p.rank}`}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isMe ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60"}`}>
                                    {p.handle[0].toUpperCase()}
                                  </div>
                                  <span className={`font-semibold ${isMe ? "text-green-400" : "text-white"}`}>
                                    {p.handle} {isMe && "(You)"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-white/40">{p.skillLevel}</td>
                              <td className="px-4 py-3 text-right text-white">${p.currentBalance.toLocaleString()}</td>
                              <td className={`px-4 py-3 text-right font-bold ${p.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {p.pnl >= 0 ? "+" : ""}${p.pnl.toLocaleString()}
                              </td>
                              <td className={`px-4 py-3 text-right font-bold ${p.pnlPct >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3 text-right text-white/60">{p.trades}</td>
                              <td className={`px-4 py-3 text-right font-semibold ${p.winRate >= 60 ? "text-green-400" : p.winRate >= 50 ? "text-amber-400" : "text-red-400"}`}>
                                {p.winRate.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Rules */}
                {activeTab === "rules" && (
                  <div className="glass border border-white/5 rounded-xl p-6">
                    <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Competition Rules</p>
                    <div className="flex flex-col gap-3">
                      {activeCompetition.rules.map((rule, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="text-green-400 text-sm mt-0.5">✓</span>
                          <p className="text-white/70 text-sm">{rule}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 glass border border-white/5 rounded-lg p-4">
                      <p className="text-white/40 text-xs mb-2">Timeline</p>
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <p className="text-white/30">Start</p>
                          <p className="text-white">{new Date(activeCompetition.startDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex-1 h-px bg-white/10" />
                        <div className="text-center">
                          <p className="text-green-400 font-bold">{daysLeft(activeCompetition.endDate)}</p>
                        </div>
                        <div className="flex-1 h-px bg-white/10" />
                        <div className="text-right">
                          <p className="text-white/30">End</p>
                          <p className="text-white">{new Date(activeCompetition.endDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Spectate */}
                {activeTab === "spectate" && (
                  <div className="glass border border-white/5 rounded-xl p-6">
                    <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">👁 Spectate Mode</p>
                    <div className="flex flex-col gap-3">
                      {activeCompetition.participants.slice(0, 3).map((p) => (
                        <div key={p.id} className="glass border border-white/5 rounded-lg p-4 flex items-center gap-4">
                          <span className="text-2xl">{p.badge || `#${p.rank}`}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-semibold text-sm">{p.handle}</span>
                              <span className="text-white/30 text-xs">{p.skillLevel}</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1.5">
                              <div className="bg-green-400 h-1.5 rounded-full"
                                style={{ width: `${Math.min(p.pnlPct * 2, 100)}%` }} />
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${p.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%
                            </p>
                            <p className="text-white/30 text-xs">{p.trades} trades</p>
                          </div>
                          <button className="bg-white/5 hover:bg-white/10 text-white/50 text-xs px-3 py-1.5 rounded-lg border border-white/10 transition">
                            Watch Live
                          </button>
                        </div>
                      ))}
                      <p className="text-white/20 text-xs text-center mt-2">
                        Live trade streaming available during active competitions
                      </p>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}