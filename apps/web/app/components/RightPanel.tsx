"use client";
import { useJournalStore, Emotion } from "@/store/journalStore";
import { analyzeTrade, autoTag } from "@/lib/analyzeTrade";
import { useRiskStore, calculateRiskScore } from "@/store/riskStore";
import { useEffect, useState } from "react";

const emotions: { value: Emotion; emoji: string; label: string }[] = [
  { value: "confident", emoji: "💪", label: "Confident" },
  { value: "fearful", emoji: "😨", label: "Fearful" },
  { value: "greedy", emoji: "🤑", label: "Greedy" },
  { value: "hesitant", emoji: "😰", label: "Hesitant" },
  { value: "neutral", emoji: "😐", label: "Neutral" },
  { value: "frustrated", emoji: "😤", label: "Frustrated" },
];

const levelColors: Record<string, string> = {
  LOW: "text-green-400",
  MODERATE: "text-amber-400",
  HIGH: "text-orange-400",
  EXTREME: "text-red-400",
};

const levelBg: Record<string, string> = {
  LOW: "from-green-400",
  MODERATE: "from-green-400 via-amber-400",
  HIGH: "from-green-400 via-amber-400 to-orange-400",
  EXTREME: "from-green-400 via-amber-400 to-red-500",
};

export default function RightPanel() {
  const { entries, updateAiAnalysis, updateEntry } = useJournalStore();
  const { riskScore, refresh } = useRiskStore();
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const latestEntry = entries[0] || null;

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [entries]);

  const handleAnalyze = async () => {
    if (!latestEntry) return;
    setAnalyzingId(latestEntry.id);
    const tags = autoTag({
      emotion: latestEntry.emotion,
      lots: latestEntry.lots,
      pnl: latestEntry.pnl,
      notes: latestEntry.notes,
      strategy: latestEntry.strategy,
      entryQuality: latestEntry.entryQuality,
      followedPlan: latestEntry.followedPlan,
      session: latestEntry.session,
    });
    updateEntry(latestEntry.id, { tags });
    const analysis = await analyzeTrade({
      symbol: latestEntry.symbol,
      direction: latestEntry.direction,
      entryPrice: latestEntry.entryPrice,
      lots: latestEntry.lots,
      pnl: latestEntry.pnl,
      emotion: latestEntry.emotion,
      confidenceLevel: latestEntry.confidenceLevel,
      stressLevel: latestEntry.stressLevel,
      entryQuality: latestEntry.entryQuality,
      followedPlan: latestEntry.followedPlan,
      strategy: latestEntry.strategy,
      marketStructure: latestEntry.marketStructure,
      session: latestEntry.session,
      timeframe: latestEntry.timeframe,
      notes: latestEntry.notes,
      whatWentRight: latestEntry.whatWentRight,
      whatWentWrong: latestEntry.whatWentWrong,
      lessonLearned: latestEntry.lessonLearned,
      tags,
    });
    updateAiAnalysis(latestEntry.id, analysis);
    setAnalyzingId(null);
  };

  return (
    <div className="glass flex flex-col w-72 border-l border-white/5 overflow-y-auto">

      {/* Risk Score */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Risk Score</span>
          <span className={`text-xs font-bold ${levelColors[riskScore.level]}`}>{riskScore.level}</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2 mb-2">
          <div className={`bg-gradient-to-r ${levelBg[riskScore.level]} h-2 rounded-full transition-all duration-500`}
            style={{width: `${riskScore.total}%`}}></div>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-white/30 text-xs">0</span>
          <span className={`text-sm font-bold ${levelColors[riskScore.level]}`}>{riskScore.total}/100</span>
          <span className="text-white/30 text-xs">100</span>
        </div>

        {riskScore.factors.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {riskScore.factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`text-xs mt-0.5 ${f.severity === "high" ? "text-red-400" : f.severity === "medium" ? "text-amber-400" : "text-green-400"}`}>
                  {f.severity === "high" ? "⚠" : f.severity === "medium" ? "•" : "✓"}
                </span>
                <p className="text-white/50 text-xs">{f.reason}</p>
              </div>
            ))}
          </div>
        )}

        <p className={`text-xs mt-3 italic ${levelColors[riskScore.level]}`}>
          "{riskScore.recommendation}"
        </p>
      </div>

      {/* Sentiment */}
      <div className="p-4 border-b border-white/5">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Sentiment</span>
        <div className="mt-3 flex flex-col gap-2">
          {[
            { asset: "XAUUSD", bias: "Bullish", pct: 68, color: "green" },
            { asset: "EURUSD", bias: "Bearish", pct: 42, color: "red" },
            { asset: "GBPUSD", bias: "Neutral", pct: 51, color: "amber" },
          ].map((item) => (
            <div key={item.asset} className="flex items-center gap-2">
              <span className="text-white/60 text-xs w-16">{item.asset}</span>
              <div className="flex-1 bg-white/5 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${item.color === "green" ? "bg-green-400" : item.color === "red" ? "bg-red-400" : "bg-amber-400"}`}
                  style={{width: `${item.pct}%`}}></div>
              </div>
              <span className={`text-xs font-semibold ${item.color === "green" ? "text-green-400" : item.color === "red" ? "text-red-400" : "text-amber-400"}`}>
                {item.bias}
              </span>
            </div>
          ))}
        </div>
        <p className="text-white/30 text-xs mt-3 italic">"Gold bullish — weak dollar + geopolitical risk"</p>
      </div>

      {/* News */}
      <div className="p-4 border-b border-white/5">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">News</span>
        <div className="mt-3 flex flex-col gap-3">
          {[
            { time: "14:30", event: "US CPI Data Release", impact: "HIGH" },
            { time: "16:00", event: "Fed Chair Speech", impact: "HIGH" },
            { time: "18:00", event: "Crude Oil Inventories", impact: "MED" },
          ].map((item) => (
            <div key={item.event} className="flex items-start gap-2">
              <span className="text-white/30 text-xs w-10 mt-0.5">{item.time}</span>
              <div className="flex-1">
                <p className="text-white/70 text-xs">{item.event}</p>
                <span className={`text-xs font-bold ${item.impact === "HIGH" ? "text-red-400" : "text-amber-400"}`}>
                  {item.impact}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Assistant */}
      <div className="p-4 border-b border-white/5">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">AI Assistant</span>
        <div className="mt-3 bg-green-400/5 border border-green-400/10 rounded-lg p-3">
          <p className="text-white/70 text-xs leading-relaxed">
            {riskScore.total > 50
              ? `⚠ Risk is ${riskScore.level}. ${riskScore.recommendation}`
              : `"Your last 3 losses occurred after 3PM. Current time is 2:45PM — consider waiting for tomorrow's London session."`}
          </p>
        </div>
      </div>

      {/* Trade Journal — Latest Entry */}
      <div className="p-4">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Trade Journal</span>
        {!latestEntry ? (
          <p className="text-white/20 text-xs mt-3">Place a trade to log your journal entry</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${latestEntry.direction === "BUY" ? "text-green-400" : "text-red-400"}`}>
                {latestEntry.direction}
              </span>
              <span className="text-white/60 text-xs">{latestEntry.symbol}</span>
              <span className="text-white/40 text-xs">@ ${latestEntry.entryPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
            </div>

            <div>
              <p className="text-white/40 text-xs mb-1">How are you feeling?</p>
              <select value={latestEntry.emotion}
                onChange={(e) => updateEntry(latestEntry.id, { emotion: e.target.value as Emotion })}
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs w-full">
                {emotions.map(em => (
                  <option key={em.value} value={em.value} className="bg-[#0a0a0f]">
                    {em.emoji} {em.label}
                  </option>
                ))}
              </select>
            </div>

            <textarea value={latestEntry.notes}
              onChange={(e) => updateEntry(latestEntry.id, { notes: e.target.value })}
              placeholder="Notes... (breakout, news, scalp...)"
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs resize-none h-16 w-full" />

            <button onClick={handleAnalyze} disabled={analyzingId === latestEntry.id}
              className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 py-1.5 rounded text-xs font-semibold transition disabled:opacity-50">
              {analyzingId === latestEntry.id ? "Analyzing..." : "🤖 Get AI Analysis"}
            </button>

            {latestEntry.aiAnalysis && (
              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3">
                <p className="text-white/60 text-xs leading-relaxed">{latestEntry.aiAnalysis}</p>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}