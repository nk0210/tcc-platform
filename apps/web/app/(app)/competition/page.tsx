"use client";
import React, { useState } from "react";
import { useCompetitionStore, Competition } from "@/store/competitionStore";
import { useAuthStore } from "@/store/authStore";
import ReportButton from "@/components/ReportButton";

const divisionColors: Record<string, string> = {
  ROOKIE: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  SEMI_PRO: "text-warning border-warning/30 bg-warning-soft",
  PRO: "text-success border-success/30 bg-success-soft",
};

const statusColors: Record<string, string> = {
  LIVE: "text-success bg-success-soft border-success/30",
  UPCOMING: "text-warning bg-warning-soft border-warning/30",
  ENDED: "text-fg-dim bg-elevated border-border",
};

function daysLeft(endDate: Date): string {
  const diff = new Date(endDate).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return "Ended";
  if (days === 0) return "Last day!";
  return `${days} days left`;
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
    joinCompetition(competition.id, user.handle || "guest", user.experienceLevel || "ROOKIE");
  };

  const handleGenerateReport = async (participant: any) => {
    setGeneratingReport(participant.id);
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
            { role: "system", content: "You are a trading competition analyst. Be concise. Max 3 sentences." },
            { role: "user", content: `Analyze: Handle: ${participant.handle}, Return: ${participant.pnlPct}%, WinRate: ${participant.winRate}%, MaxDD: ${participant.maxDrawdown}%, RiskScore: ${participant.riskScore}/100, CompScore: ${participant.competitionScore}. Give 1 strength, 1 improvement, draft consideration.` },
          ],
        }),
      });
      const data = await response.json();
      const report = data.choices?.[0]?.message?.content || "AI report unavailable.";
      if (activeCompetition) setAiReport(activeCompetition.id, participant.id, report);
    } catch {
      if (activeCompetition) setAiReport(activeCompetition.id, participant.id, "AI report unavailable. Please try again.");
    }
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
        <div className="flex-1 overflow-y-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-fg">🏆 Trading Competitions</h1>
              <p className="text-fg-dim text-sm mt-1">Compete, rank up, get drafted. Trading is a sport.</p>
            </div>
          </div>

          <div className="flex gap-6">

            {/* Left — List */}
            <div className="w-72 shrink-0 flex flex-col gap-3">
              {competitions.map((comp) => (
                <div key={comp.id}
                  onClick={() => { setActiveCompetition(comp); setActiveTab("leaderboard"); }}
                  className={`glass border rounded-xl p-4 cursor-pointer transition hover:border-border-strong ${activeCompetition?.id === comp.id ? "border-success/30 bg-success-soft" : "border-border"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[comp.status]}`}>
                      {comp.status === "LIVE" ? "🔴 LIVE" : comp.status === "UPCOMING" ? "⏳ UPCOMING" : "✓ ENDED"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${divisionColors[comp.division]}`}>{comp.division}</span>
                  </div>
                  <p className="text-fg font-semibold text-sm mb-1">{comp.name}</p>
                  <p className="text-fg-dim text-xs mb-2">{comp.asset} · {comp.participants.length} traders</p>
                  <div className="flex items-center justify-between">
                    <span className="text-success text-sm font-bold">{comp.prizePool}</span>
                    <span className="text-fg-dim text-xs">{daysLeft(comp.endDate)}</span>
                  </div>
                </div>
              ))}

              <div className="glass border border-border rounded-xl p-4 mt-2">
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Prize Distribution</p>
                {[
                  { place: "🥇 1st", pct: "50%" }, { place: "🥈 2nd", pct: "25%" },
                  { place: "🥉 3rd", pct: "15%" }, { place: "🎯 Best Risk", pct: "5%" },
                  { place: "❤️ Community", pct: "5%" },
                ].map(item => (
                  <div key={item.place} className="flex items-center justify-between mb-2">
                    <span className="text-fg-muted text-xs">{item.place}</span>
                    <span className="text-fg-muted text-xs font-semibold">{item.pct}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Active Competition */}
            {activeCompetition && (
              <div className="flex-1 flex flex-col gap-4">

                <div className="glass border border-border rounded-xl p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[activeCompetition.status]}`}>
                          {activeCompetition.status === "LIVE" ? "🔴 LIVE" : activeCompetition.status === "UPCOMING" ? "⏳ UPCOMING" : "✓ ENDED"}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${divisionColors[activeCompetition.division]}`}>{activeCompetition.division}</span>
                        <span className="text-fg-dim text-xs">{daysLeft(activeCompetition.endDate)}</span>
                      </div>
                      <h2 className="text-2xl font-bold text-fg mb-1">{activeCompetition.name}</h2>
                      <p className="text-fg-muted text-sm">{activeCompetition.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-fg-dim text-xs mb-1">Prize Pool</p>
                      <p className="text-3xl font-bold text-success">{activeCompetition.prizePool}</p>
                      <p className="text-fg-dim text-xs mt-1">{activeCompetition.participants.length} participants</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    {!isJoined && activeCompetition.status !== "ENDED" ? (
                      <button onClick={() => handleJoin(activeCompetition)}
                        className="bg-success-soft hover:bg-success/22 text-success border border-success/30 px-6 py-2 rounded-lg text-sm font-semibold transition">
                        🏁 Join Competition
                      </button>
                    ) : isJoined ? (
                      <span className="bg-success-soft text-success border border-success/30 px-4 py-2 rounded-lg text-sm font-semibold">✓ Joined</span>
                    ) : null}
                    <button onClick={() => setActiveTab("spectate")}
                      className="bg-elevated hover:bg-elevated text-fg-muted border border-border px-4 py-2 rounded-lg text-sm transition">
                      👁 Spectate
                    </button>
                    <ReportButton
                      reportedItemType="competition"
                      reportedItemId={activeCompetition.id}
                      reportedItemTitle={activeCompetition.name}
                      sourceFeature="Competition Page"
                    />
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-elevated rounded-lg p-1">
                  {(["leaderboard", "rules", "spectate"] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-2 rounded-md text-xs font-semibold capitalize transition ${activeTab === tab ? "bg-success-soft text-success" : "text-fg-dim"}`}>
                      {tab === "leaderboard" ? "🏆 Leaderboard" : tab === "rules" ? "📋 Rules" : "👁 Spectate"}
                    </button>
                  ))}
                </div>

                {/* Leaderboard */}
                {activeTab === "leaderboard" && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <p className="text-fg-dim text-xs">Rank by:</p>
                      <div className="flex gap-1 bg-elevated rounded-lg p-1">
                        <button onClick={() => setRankBy("score")}
                          className={`px-3 py-1 rounded text-xs font-semibold transition ${rankBy === "score" ? "bg-success-soft text-success" : "text-fg-dim"}`}>
                          🎯 Competition Score
                        </button>
                        <button onClick={() => setRankBy("pnl")}
                          className={`px-3 py-1 rounded text-xs font-semibold transition ${rankBy === "pnl" ? "bg-success-soft text-success" : "text-fg-dim"}`}>
                          💰 P&L Only
                        </button>
                      </div>
                    </div>

                    <div className="glass border border-border rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-elevated">
                            <th className="text-left px-4 py-3 text-fg-dim">Rank</th>
                            <th className="text-left px-4 py-3 text-fg-dim">Trader</th>
                            <th className="text-right px-4 py-3 text-fg-dim">Score</th>
                            <th className="text-right px-4 py-3 text-fg-dim">Return</th>
                            <th className="text-right px-4 py-3 text-fg-dim">Win Rate</th>
                            <th className="text-right px-4 py-3 text-fg-dim">Drawdown</th>
                            <th className="text-right px-4 py-3 text-fg-dim">Risk</th>
                            <th className="text-right px-4 py-3 text-fg-dim">Fair Play</th>
                            <th className="text-right px-4 py-3 text-fg-dim">Draft</th>
                            <th className="text-right px-4 py-3 text-fg-dim">AI</th>
                            <th className="text-right px-4 py-3 text-fg-dim">Report</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* ── FIXED: React.Fragment with unique key ── */}
                          {sortedParticipants.map((p, index) => {
                            const isMe = p.handle === (user?.handle || "guest");
                            return (
                              <React.Fragment key={`participant-${p.id ?? "unknown"}-${index}`}>
                                <tr
                                  className={`border-b border-border transition cursor-pointer ${isMe ? "bg-success-soft" : "hover:bg-elevated"}`}
                                  onClick={() => setExpandedParticipant(expandedParticipant === p.id ? null : p.id)}>
                                  <td className="px-4 py-3">
                                    <span className="text-lg">{index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isMe ? "bg-success-soft text-success" : "bg-elevated text-fg-muted"}`}>
                                        {p.handle[0].toUpperCase()}
                                      </div>
                                      <span className={`font-semibold ${isMe ? "text-success" : "text-fg"}`}>
                                        {p.handle} {isMe && "(You)"}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right"><span className="text-warning font-bold">{p.competitionScore}</span></td>
                                  <td className={`px-4 py-3 text-right font-bold ${p.pnlPct >= 0 ? "text-success" : "text-danger"}`}>
                                    {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(1)}%
                                  </td>
                                  <td className={`px-4 py-3 text-right ${p.winRate >= 60 ? "text-success" : p.winRate >= 50 ? "text-warning" : "text-danger"}`}>
                                    {p.winRate.toFixed(1)}%
                                  </td>
                                  <td className={`px-4 py-3 text-right ${p.maxDrawdown < 5 ? "text-success" : p.maxDrawdown < 10 ? "text-warning" : "text-danger"}`}>
                                    {p.maxDrawdown}%
                                  </td>
                                  <td className="px-4 py-3 text-right text-fg-muted">{p.riskScore}/100</td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={p.fairPlayScore >= 95 ? "text-success" : "text-warning"}>{p.fairPlayScore}/100</span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {p.draftEligible
                                      ? <span className="text-xs bg-warning-soft text-warning border border-warning/30 px-2 py-0.5 rounded-full">⭐ Eligible</span>
                                      : <span className="text-fg-dim text-xs">—</span>}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleGenerateReport(p); }}
                                      disabled={generatingReport === p.id}
                                      className="text-xs bg-accent/10 text-accent-hover border border-accent/30 px-2 py-0.5 rounded hover:bg-accent/22 transition disabled:opacity-50">
                                      {generatingReport === p.id ? "..." : p.aiReport ? "✓ View" : "🤖 AI"}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                    {!isMe && (
                                      <ReportButton
                                        reportedItemType="competition"
                                        reportedItemId={p.id}
                                        reportedItemTitle={`${p.handle} in ${activeCompetition.name}`}
                                        reportedUserId={p.handle}
                                        sourceFeature="Competition Leaderboard"
                                        compact
                                      />
                                    )}
                                  </td>
                                </tr>
                                {expandedParticipant === p.id && p.aiReport && (
                                  <tr className="border-b border-border bg-accent/3">
                                    <td colSpan={11} className="px-6 py-3">
                                      <div className="flex items-start gap-3">
                                        <span className="text-accent-hover text-sm">🤖</span>
                                        <div>
                                          <p className="text-accent-hover text-xs font-semibold mb-1">AI Competition Report — {p.handle}</p>
                                          <p className="text-fg-muted text-xs leading-relaxed">{p.aiReport}</p>
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

                    {sortedParticipants.some(p => p.draftEligible) && (
                      <div className="glass border border-warning/30 bg-warning-soft rounded-xl p-4">
                        <p className="text-warning font-semibold text-sm mb-1">⭐ Draft Eligible Traders</p>
                        <p className="text-fg-muted text-xs">These traders qualify for the Pro Draft based on score, fair play, and drawdown control:</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {sortedParticipants.filter(p => p.draftEligible).map(p => (
                            <span key={p.id} className="text-xs bg-warning-soft text-warning border border-warning/30 px-3 py-1 rounded-full">
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
                  <div className="glass border border-border rounded-xl p-6">
                    <p className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-4">Competition Rules</p>
                    <div className="flex flex-col gap-3 mb-6">
                      {activeCompetition.rules.map((rule, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="text-success text-sm mt-0.5">✓</span>
                          <p className="text-fg-muted text-sm">{rule}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">Scoring Formula</p>
                    <div className="glass border border-border rounded-lg p-4 text-xs text-fg-muted font-mono">
                      <p className="text-success mb-2">Competition Score =</p>
                      <p>  0.35 × Return %</p>
                      <p>+ 0.20 × Consistency Score</p>
                      <p>+ 0.20 × Risk Score</p>
                      <p>+ 0.15 × Win Rate</p>
                      <p>+ 0.10 × Avg R:R (capped)</p>
                      <p className="text-danger">- Max Drawdown × 0.5</p>
                      <p className="text-danger">- Fair Play Penalty</p>
                    </div>
                    <div className="mt-4 glass border border-border rounded-lg p-4">
                      <p className="text-fg-dim text-xs mb-2">Timeline</p>
                      <div className="flex items-center gap-4 text-xs">
                        <div><p className="text-fg-dim">Start</p><p className="text-fg">{new Date(activeCompetition.startDate).toLocaleDateString()}</p></div>
                        <div className="flex-1 h-px bg-elevated" />
                        <div className="text-center"><p className="text-success font-bold">{daysLeft(activeCompetition.endDate)}</p></div>
                        <div className="flex-1 h-px bg-elevated" />
                        <div className="text-right"><p className="text-fg-dim">End</p><p className="text-fg">{new Date(activeCompetition.endDate).toLocaleDateString()}</p></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Spectate */}
                {activeTab === "spectate" && (
                  <div className="glass border border-border rounded-xl p-6">
                    <p className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-2">👁 Spectate Mode</p>
                    <p className="text-fg-dim text-xs mb-4">Trade details delayed by 5 minutes to prevent unfair copying</p>
                    <div className="flex flex-col gap-3">
                      {sortedParticipants.slice(0, 3).map((p, i) => (
                        <div key={p.id} className="glass border border-border rounded-lg p-4 flex items-center gap-4">
                          <span className="text-2xl">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-fg font-semibold text-sm">{p.handle}</span>
                              <span className="text-fg-dim text-xs">{p.skillLevel}</span>
                              {p.draftEligible && <span className="text-xs text-warning bg-warning-soft px-1.5 py-0.5 rounded-full border border-warning/30">⭐ Draft Pick</span>}
                            </div>
                            <div className="w-full bg-elevated rounded-full h-1.5">
                              <div className="bg-success h-1.5 rounded-full" style={{ width: `${Math.min(p.competitionScore, 100)}%` }} />
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${p.pnlPct >= 0 ? "text-success" : "text-danger"}`}>
                              {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct}%
                            </p>
                            <p className="text-fg-dim text-xs">{p.trades} trades</p>
                          </div>
                          <button className="bg-elevated hover:bg-elevated text-fg-muted text-xs px-3 py-1.5 rounded-lg border border-border transition">
                            Watch Live
                          </button>
                        </div>
                      ))}
                      <p className="text-fg-dim text-xs text-center mt-2">Live trade streaming — 5 minute delay active</p>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
  );
}