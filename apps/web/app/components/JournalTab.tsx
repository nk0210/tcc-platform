"use client";
import { useJournalStore } from "@/store/journalStore";

export default function JournalTab() {
  const { entries } = useJournalStore();

  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
      {entries.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-white/20 text-xs">No trades yet — place a trade and it will appear here automatically</p>
        </div>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="glass border border-white/5 rounded-lg p-3 flex gap-4">
            <div className="flex flex-col gap-1 w-40 shrink-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${entry.side === "BUY" ? "text-green-400" : "text-red-400"}`}>
                  {entry.side}
                </span>
                <span className="text-white/70 text-xs">{entry.symbol}</span>
              </div>
              <span className="text-white/40 text-xs">@ ${entry.entryPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
              <span className="text-white/40 text-xs">{entry.lotSize} lots</span>
              {entry.netPnl != null && (
                <span className={`text-xs font-bold ${entry.netPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {entry.netPnl >= 0 ? "+" : ""}${entry.netPnl.toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 w-28 shrink-0 border-l border-white/5 pl-3">
              <span className="text-white/40 text-xs">Emotion</span>
              <span className="text-white/70 text-xs">{entry.emotion}</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {entry.tags.map(tag => (
                  <span key={tag} className="text-xs bg-white/5 text-white/40 px-1.5 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
            <div className="flex-1 border-l border-white/5 pl-3">
              <p className="text-xs text-indigo-400 font-semibold mb-1">🤖 AI Analysis</p>
              {entry.aiLoading ? (
                <p className="text-white/30 text-xs italic">Waiting for analysis...</p>
              ) : entry.aiAnalysis ? (
                <p className="text-white/60 text-xs leading-relaxed">{entry.aiAnalysis}</p>
              ) : (
                <p className="text-white/20 text-xs italic">No analysis yet</p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}