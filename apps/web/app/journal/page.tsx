"use client";
import { useJournalStore, Emotion, EntryQuality, Strategy, MarketStructure } from "@/store/journalStore";
import { analyzeTrade, autoTag } from "@/lib/analyzeTrade";
import { useState } from "react";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

const emotions: { value: Emotion; emoji: string; label: string }[] = [
  { value: "confident", emoji: "💪", label: "Confident" },
  { value: "fearful", emoji: "😨", label: "Fearful" },
  { value: "greedy", emoji: "🤑", label: "Greedy" },
  { value: "hesitant", emoji: "😰", label: "Hesitant" },
  { value: "neutral", emoji: "😐", label: "Neutral" },
  { value: "frustrated", emoji: "😤", label: "Frustrated" },
];

const strategies: { value: Strategy; label: string }[] = [
  { value: "smc", label: "SMC" },
  { value: "ema_pullback", label: "EMA Pullback" },
  { value: "breakout", label: "Breakout" },
  { value: "reversal", label: "Reversal" },
  { value: "scalp", label: "Scalp" },
  { value: "news", label: "News Trade" },
  { value: "fibonacci", label: "Fibonacci" },
  { value: "support_resistance", label: "S/R" },
  { value: "other", label: "Other" },
];

const entryQualities: { value: EntryQuality; label: string }[] = [
  { value: "good", label: "✅ Good" },
  { value: "early", label: "⚡ Early" },
  { value: "late", label: "🐢 Late" },
  { value: "impulsive", label: "🔥 Impulsive" },
  { value: "missed", label: "❌ Missed" },
];

const marketStructures: { value: MarketStructure; label: string }[] = [
  { value: "bullish", label: "📈 Bullish" },
  { value: "bearish", label: "📉 Bearish" },
  { value: "ranging", label: "↔ Ranging" },
  { value: "choppy", label: "〰 Choppy" },
];

const sessionColors: Record<string, string> = {
  london: "text-blue-400",
  newyork: "text-amber-400",
  asian: "text-purple-400",
  sydney: "text-cyan-400",
  unknown: "text-white/40",
};

export default function JournalPage() {
  const { entries, updateAiAnalysis, updateEntry } = useJournalStore();
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAnalyze = async (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    setAnalyzingId(id);
    const tags = autoTag({
      emotion: entry.emotion,
      lots: entry.lots,
      pnl: entry.pnl,
      notes: entry.notes,
      strategy: entry.strategy,
      entryQuality: entry.entryQuality,
      followedPlan: entry.followedPlan,
      session: entry.session,
    });
    updateEntry(id, { tags });
    const analysis = await analyzeTrade({
      symbol: entry.symbol,
      direction: entry.direction,
      entryPrice: entry.entryPrice,
      exitPrice: entry.exitPrice,
      lots: entry.lots,
      pnl: entry.pnl,
      emotion: entry.emotion,
      confidenceLevel: entry.confidenceLevel,
      stressLevel: entry.stressLevel,
      entryQuality: entry.entryQuality,
      followedPlan: entry.followedPlan,
      strategy: entry.strategy,
      marketStructure: entry.marketStructure,
      session: entry.session,
      timeframe: entry.timeframe,
      notes: entry.notes,
      whatWentRight: entry.whatWentRight,
      whatWentWrong: entry.whatWentWrong,
      lessonLearned: entry.lessonLearned,
      tags,
    });
    updateAiAnalysis(id, analysis);
    setAnalyzingId(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Trade Journal</h1>
              <p className="text-white/40 text-sm mt-1">{entries.length} entries — every trade, automatically logged</p>
            </div>
            <div className="flex gap-4 text-xs text-white/40">
              <span>🏙 <span className="text-blue-400">London</span></span>
              <span>🗽 <span className="text-amber-400">New York</span></span>
              <span>🌏 <span className="text-purple-400">Asian</span></span>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-5xl mb-4">📓</div>
                <p className="text-white/40">No trades yet</p>
                <p className="text-white/20 text-sm mt-1">Place a trade and it appears here automatically</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {entries.map((entry) => (
                <div key={entry.id} className="glass border border-white/5 rounded-xl overflow-hidden">

                  {/* Header row — always visible */}
                  <div className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-white/2"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                    <span className={`text-sm font-bold ${entry.direction === "BUY" ? "text-green-400" : "text-red-400"}`}>
                      {entry.direction}
                    </span>
                    <span className="text-white font-semibold">{entry.symbol}</span>
                    <span className="text-white/40 text-xs">@ ${entry.entryPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                    <span className="text-white/40 text-xs">{entry.lots} lots</span>
                    <span className={`text-xs font-semibold uppercase ${sessionColors[entry.session]}`}>{entry.session}</span>
                    <span className="text-white/30 text-xs">{entry.timeframe}</span>
                    {entry.pnl !== undefined && (
                      <span className={`text-sm font-bold ${entry.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {entry.pnl >= 0 ? "+" : ""}${entry.pnl.toFixed(2)}
                      </span>
                    )}
                    <div className="flex gap-1 ml-2">
                      {entry.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-white/5 text-white/40 px-1.5 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                    {entry.aiAnalysis && (
                      <span className="ml-auto text-xs text-indigo-400">✓ Analyzed</span>
                    )}
                    <span className="text-white/20 text-xs ml-auto">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="text-white/30 text-xs">{expandedId === entry.id ? "▲" : "▼"}</span>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === entry.id && (
                    <div className="border-t border-white/5 p-5 grid grid-cols-3 gap-6">

                      {/* Column 1 — Setup */}
                      <div className="flex flex-col gap-4">
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Setup & Strategy</p>

                        <div>
                          <p className="text-white/40 text-xs mb-1">Strategy Used</p>
                          <select value={entry.strategy}
                            onChange={(e) => updateEntry(entry.id, { strategy: e.target.value as Strategy })}
                            className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-xs w-full">
                            {strategies.map(s => (
                              <option key={s.value} value={s.value} className="bg-[#0a0a0f]">{s.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <p className="text-white/40 text-xs mb-1">Market Structure</p>
                          <select value={entry.marketStructure}
                            onChange={(e) => updateEntry(entry.id, { marketStructure: e.target.value as MarketStructure })}
                            className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-xs w-full">
                            {marketStructures.map(s => (
                              <option key={s.value} value={s.value} className="bg-[#0a0a0f]">{s.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <p className="text-white/40 text-xs mb-1">Entry Quality</p>
                          <select value={entry.entryQuality}
                            onChange={(e) => updateEntry(entry.id, { entryQuality: e.target.value as EntryQuality })}
                            className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-xs w-full">
                            {entryQualities.map(q => (
                              <option key={q.value} value={q.value} className="bg-[#0a0a0f]">{q.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <p className="text-white/40 text-xs mb-1">Followed Plan?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateEntry(entry.id, { followedPlan: true })}
                              className={`flex-1 py-1 rounded text-xs font-semibold border transition ${entry.followedPlan === true ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10"}`}>
                              ✅ Yes
                            </button>
                            <button
                              onClick={() => updateEntry(entry.id, { followedPlan: false })}
                              className={`flex-1 py-1 rounded text-xs font-semibold border transition ${entry.followedPlan === false ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-white/5 text-white/40 border-white/10"}`}>
                              ❌ No
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Column 2 — Psychology */}
                      <div className="flex flex-col gap-4">
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Psychology</p>

                        <div>
                          <p className="text-white/40 text-xs mb-1">Emotion</p>
                          <select value={entry.emotion}
                            onChange={(e) => updateEntry(entry.id, { emotion: e.target.value as Emotion })}
                            className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-xs w-full">
                            {emotions.map(em => (
                              <option key={em.value} value={em.value} className="bg-[#0a0a0f]">{em.emoji} {em.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <p className="text-white/40 text-xs mb-1">Confidence: {entry.confidenceLevel}/10</p>
                          <input type="range" min="1" max="10" value={entry.confidenceLevel}
                            onChange={(e) => updateEntry(entry.id, { confidenceLevel: parseInt(e.target.value) })}
                            className="w-full accent-green-400" />
                        </div>

                        <div>
                          <p className="text-white/40 text-xs mb-1">Stress: {entry.stressLevel}/10</p>
                          <input type="range" min="1" max="10" value={entry.stressLevel}
                            onChange={(e) => updateEntry(entry.id, { stressLevel: parseInt(e.target.value) })}
                            className="w-full accent-red-400" />
                        </div>

                        <div>
                          <p className="text-white/40 text-xs mb-1">Notes</p>
                          <textarea value={entry.notes}
                            onChange={(e) => updateEntry(entry.id, { notes: e.target.value })}
                            placeholder="What happened?"
                            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs resize-none h-16 w-full" />
                        </div>
                      </div>

                      {/* Column 3 — Review & AI */}
                      <div className="flex flex-col gap-4">
                        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Review & AI</p>

                        <div>
                          <p className="text-white/40 text-xs mb-1">What went right?</p>
                          <textarea value={entry.whatWentRight}
                            onChange={(e) => updateEntry(entry.id, { whatWentRight: e.target.value })}
                            placeholder="Reinforce your strengths..."
                            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs resize-none h-12 w-full" />
                        </div>

                        <div>
                          <p className="text-white/40 text-xs mb-1">What went wrong?</p>
                          <textarea value={entry.whatWentWrong}
                            onChange={(e) => updateEntry(entry.id, { whatWentWrong: e.target.value })}
                            placeholder="Identify mistakes..."
                            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs resize-none h-12 w-full" />
                        </div>

                        <div>
                          <p className="text-white/40 text-xs mb-1">Lesson learned</p>
                          <textarea value={entry.lessonLearned}
                            onChange={(e) => updateEntry(entry.id, { lessonLearned: e.target.value })}
                            placeholder="What will you do differently?"
                            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs resize-none h-12 w-full" />
                        </div>

                        <button onClick={() => handleAnalyze(entry.id)}
                          disabled={analyzingId === entry.id}
                          className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 py-1.5 rounded text-xs font-semibold transition disabled:opacity-50">
                          {analyzingId === entry.id ? "Analyzing..." : "🤖 Get AI Analysis"}
                        </button>

                        {entry.aiAnalysis && (
                          <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3">
                            <p className="text-white/70 text-xs leading-relaxed">{entry.aiAnalysis}</p>
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}