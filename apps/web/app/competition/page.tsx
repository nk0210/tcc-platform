"use client";
import { useState } from "react";
import { useCompetitionStore, Competition } from "@/store/competitionStore";
import { useAuthStore } from "@/store/authStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import React from "react";

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

async function generateAiReport(participant: any): Promise<string> {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 200,
        messages: [
          { role: "system", content: "You are a trading competition analyst. Be concise and specific. Max 3 sentences." },
          { role: "user", content: `Analyze this trader's competition performance:
Handle: ${participant.handle}
Return: ${participant.pnlPct}%
Win Rate: ${participant.winRate}%
Max Drawdown: ${participant.maxDrawdown}%
Avg R:R: ${participant.avgRR}
Trades: ${participant.trades}
Risk Score: ${participant.riskScore}/100
Consistency: ${participant.consistencyScore}/100
Competition Score: ${participant.competitionScore}
Draft Eligible: ${participant.draftEligible}

Give: 1 key strength, 1 area to improve, and whether they deserve draft consideration.` }
        ],
      }),
    });
    const data = await response.json();
    return data.choices[0].message.content;
  } catch {
    return "AI report unavailable. Please try again.";
  }
}

export default function CompetitionPage() {
  const { competitions, activeCompetition, setActiveCompetition, joinCompetition, setAiReport } = useCompetitionStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"leaderboard" | "rules" | "spectate">("leaderboard");
  const [rankBy, setRankBy] = useState<"score" | "pnl">("score");
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null);

  const handleJoin = (competition: Competition) => {
    if (!user) return;
    joinCompetition(competition.id, user.handle || "guest", user.skillLevel || "ROOKIE");
  };

  const handleGenerateReport = async (participant: any) => {
    setGeneratingReport(participant.id);
    const report = await generateAiReport(participant);
    setAiReport(activeCompetition!.id, participant.id, report);
    setGeneratingReport(null);
    setExpandedParticipant(participant.id);
  };

  const isJoined = activeCompetition?.participants.find(p => p.handle === (user?.handle || "guest"));

  const sortedParticipants = activeCompetition
    ? [...activeCompetition.participants].sort((a, b) =>
        rankBy === "score" ? b.competitionScore - a.competitionScore : b.pnlPct - a.pnlPct
      )
    : [];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

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
                  onClick={() => { setActiveCompetition(comp); setActiveTab("leaderboard"); }}
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

              {/* Prize Distribution */}
              <div className="glass border border-white/5 rounded-xl p-4 mt-2">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Prize Distribution</p>
                {[
                  { place: "🥇 1st", pct: "50%" },
                  { place: "🥈 2nd", pct: "25%" },
                  { place: "🥉 3rd", pct: "15%" },
                  { place: "🎯 Best Risk", pct: "5%" },
                  { place: "❤️ Community", pct: "5%" },
                ].map(item => (
                  <div key={item.place} className="flex items-center justify-between mb-2">
                    <span className="text-white/50 text-xs">{item.place}</span>
                    <span className="text-white/70 text-xs font-semibold">{item.pct}</span>
                  </div>
                ))}
              </div>
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
                  <div className="flex flex-col gap-3">

                    {/* Rank toggle */}
                    <div className="flex items-center gap-3">
                      <p className="text-white/40 text-xs">Rank by:</p>
                      <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                        <button onClick={() => setRankBy("score")}
                          className={`px-3 py-1 rounded text-xs font-semibold transition ${rankBy === "score" ? "bg-green-500/20 text-green-400" : "text-white/40"}`}>
                          🎯 Competition Score
                        </button>
                        <button onClick={() => setRankBy("pnl")}
                          className={`px-3 py-1 rounded text-xs font-semibold transition ${rankBy === "pnl" ? "bg-green-500/20 text-green-400" : "text-white/40"}`}>
                          💰 P&L Only
                        </button>
                      </div>
                      {rankBy === "score" && (
                        <p className="text-white/20 text-xs italic">Score = Return + Consistency + Risk - Drawdown penalty</p>
                      )}
                    </div>

                    <div className="glass border border-white/5 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/2">
                            <th className="text-left px-4 py-3 text-white/40">Rank</th>
                            <th className="text-left px-4 py-3 text-white/40">Trader</th>
                            <th className="text-right px-4 py-3 text-white/40">Score</th>
                            <th className="text-right px-4 py-3 text-white/40">Return</th>
                            <th className="text-right px-4 py-3 text-white/40">Win Rate</th>
                            <th className="text-right px-4 py-3 text-white/40">Drawdown</th>
                            <th className="text-right px-4 py-3 text-white/40">Risk</th>
                            <th className="text-right px-4 py-3 text-white/40">Fair Play</th>
                            <th className="text-right px-4 py-3 text-white/40">Draft</th>
                            <th className="text-right px-4 py-3 text-white/40">AI Report</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedParticipants.map((p, i) => {
                            const isMe = p.handle === (user?.handle || "guest");
                            return (
                              <React.Fragment key={p.id}>
                                <tr
                                  className={`border-b border-white/5 transition cursor-pointer ${isMe ? "bg-green-500/5" : "hover:bg-white/2"}`}
                                  onClick={() => setExpandedParticipant(expandedParticipant === p.id ? null : p.id)}>
                                  <td className="px-4 py-3">
                                    <span className="text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
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
                                  <td className="px-4 py-3 text-right">
                                    <span className="text-amber-400 font-bold">{p.competitionScore}</span>
                                  </td>
                                  <td className={`px-4 py-3 text-right font-bold ${p.pnlPct >= 0 ? "text-green-400" : "text-red-400"}`}>
                                    {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%
                                  </td>
                                  <td className={`px-4 py-3 text-right ${p.winRate >= 60 ? "text-green-400" : p.winRate >= 50 ? "text-amber-400" : "text-red-400"}`}>
                                    {p.winRate.toFixed(1)}%
                                  </td>
                                  <td className={`px-4 py-3 text-right ${p.maxDrawdown < 5 ? "text-green-400" : p.maxDrawdown < 10 ? "text-amber-400" : "text-red-400"}`}>
                                    {p.maxDrawdown}%
                                  </td>
                                  <td className="px-4 py-3 text-right text-white/60">{p.riskScore}/100</td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={p.fairPlayScore >= 95 ? "text-green-400" : "text-amber-400"}>
                                      {p.fairPlayScore}/100
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {p.draftEligible
                                      ? <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">⭐ Eligible</span>
                                      : <span className="text-white/20 text-xs">—</span>
                                    }
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleGenerateReport(p); }}
                                      disabled={generatingReport === p.id}
                                      className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded hover:bg-indigo-500/20 transition disabled:opacity-50">
                                      {generatingReport === p.id ? "..." : p.aiReport ? "✓ View" : "🤖 AI"}
                                    </button>
                                  </td>
                                </tr>
                                {expandedParticipant === p.id && p.aiReport && (
                                  <tr key={`${p.id}-report`} className="border-b border-white/5 bg-indigo-500/3">
                                    <td colSpan={10} className="px-6 py-3">
                                      <div className="flex items-start gap-3">
                                        <span className="text-indigo-400 text-sm">🤖</span>
                                        <div>
                                          <p className="text-indigo-400 text-xs font-semibold mb-1">AI Competition Report — {p.handle}</p>
                                          <p className="text-white/60 text-xs leading-relaxed">{p.aiReport}</p>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Draft Notice */}
                    {sortedParticipants.some(p => p.draftEligible) && (
                      <div className="glass border border-amber-500/20 bg-amber-500/5 rounded-xl p-4">
                        <p className="text-amber-400 font-semibold text-sm mb-1">⭐ Draft Eligible Traders</p>
                        <p className="text-white/50 text-xs">The following traders qualify for the Pro Draft based on their competition score, fair play score, and drawdown control:</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {sortedParticipants.filter(p => p.draftEligible).map(p => (
                            <span key={p.id} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full">
                              {p.handle}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Rules */}
                {activeTab === "rules" && (
                  <div className="glass border border-white/5 rounded-xl p-6">
                    <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Competition Rules</p>
                    <div className="flex flex-col gap-3 mb-6">
                      {activeCompetition.rules.map((rule, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="text-green-400 text-sm mt-0.5">✓</span>
                          <p className="text-white/70 text-sm">{rule}</p>
                        </div>
                      ))}
                    </div>

                    <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Scoring Formula</p>
                    <div className="glass border border-white/5 rounded-lg p-4 text-xs text-white/50 font-mono">
                      <p className="text-green-400 mb-2">Competition Score =</p>
                      <p>  0.35 × Return %</p>
                      <p>+ 0.20 × Consistency Score</p>
                      <p>+ 0.20 × Risk Score</p>
                      <p>+ 0.15 × Win Rate</p>
                      <p>+ 0.10 × Avg R:R (capped)</p>
                      <p className="text-red-400">- Max Drawdown × 0.5</p>
                      <p className="text-red-400">- Fair Play Penalty</p>
                    </div>

                    <div className="mt-4 glass border border-white/5 rounded-lg p-4">
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
                    <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">👁 Spectate Mode</p>
                    <p className="text-white/30 text-xs mb-4">Trade details delayed by 5 minutes to prevent unfair copying</p>
                    <div className="flex flex-col gap-3">
                      {sortedParticipants.slice(0, 3).map((p, i) => (
                        <div key={p.id} className="glass border border-white/5 rounded-lg p-4 flex items-center gap-4">
                          <span className="text-2xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-semibold text-sm">{p.handle}</span>
                              <span className="text-white/30 text-xs">{p.skillLevel}</span>
                              {p.draftEligible && <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">⭐ Draft Pick</span>}
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1.5">
                              <div className="bg-green-400 h-1.5 rounded-full transition-all"
                                style={{ width: `${Math.min(p.competitionScore, 100)}%` }} />
                            </div>
                            <div className="flex gap-4 mt-1">
                              <span className="text-white/30 text-xs">Score: <span className="text-amber-400">{p.competitionScore}</span></span>
                              <span className="text-white/30 text-xs">Return: <span className="text-green-400">+{p.pnlPct}%</span></span>
                              <span className="text-white/30 text-xs">Risk: <span className="text-white/60">{p.riskScore}/100</span></span>
                            </div>
                          </div>
                          <button className="bg-white/5 hover:bg-white/10 text-white/50 text-xs px-3 py-1.5 rounded-lg border border-white/10 transition">
                            Watch Live
                          </button>
                        </div>
                      ))}
                      <p className="text-white/20 text-xs text-center mt-2">
                        Live trade streaming — 5 minute delay active
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