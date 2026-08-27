"use client";
/**
 * TCC Trade Journal Page
 *
 * Shows auto-created journal entries from closed paper trades.
 * Users can add notes, emotion, strategy etc. after the fact.
 * No fake data. No Invalid Date.
 */
import { useState, useMemo } from "react";
import { useJournalStore, JournalEntry, Emotion, Strategy, EntryQuality, MarketStructure } from "@/store/journalStore";
import { formatDate, formatDuration, safeDate } from "@/lib/analytics/performance";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

// ── Helpers ───────────────────────────────────────────────────────────────

function safeFmt(val: string | number | undefined | null): string {
  if (val === undefined || val === null || val === "") return "—";
  return String(val);
}

function safePriceStr(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return "—";
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

function safePnlStr(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return "—";
  return `${val >= 0 ? "+" : ""}$${Math.abs(val).toFixed(2)}`;
}

// ── Badge Styles ──────────────────────────────────────────────────────────

const resultBadge = (result?: string | null) => {
  if (result === "WIN") return "text-green-400 bg-green-500/10 border-green-500/20";
  if (result === "LOSS") return "text-red-400 bg-red-500/10 border-red-500/20";
  return "text-white/40 bg-white/5 border-white/10";
};

const sideBadge = (side: string) =>
  side === "BUY" ? "text-green-400" : "text-red-400";

const reasonBadge = (reason?: string | null) => {
  if (reason === "STOP_LOSS") return "text-red-400 bg-red-500/10";
  if (reason === "TAKE_PROFIT") return "text-green-400 bg-green-500/10";
  return "text-white/30 bg-white/5";
};

const reasonLabel = (reason?: string | null) => {
  if (reason === "STOP_LOSS") return "⛔ SL Hit";
  if (reason === "TAKE_PROFIT") return "✅ TP Hit";
  if (reason === "MANUAL") return "Manual";
  return "—";
};

// ── Entry Detail Panel ────────────────────────────────────────────────────

function EntryDetail({ entry, onClose }: { entry: JournalEntry; onClose: () => void }) {
  const { updateEntry, updateAiAnalysis, setAiLoading } = useJournalStore();

  const pnlColor = (entry.netPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400";

  const handleGroqAnalysis = async () => {
    const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
    if (!apiKey) {
      updateEntry(entry.id, { aiAnalysis: "Groq API key not configured. Add NEXT_PUBLIC_GROQ_API_KEY to .env.local." });
      return;
    }
    setAiLoading(entry.id, true);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 250,
          messages: [
            { role: "system", content: "You are a professional trading coach. Analyze this paper trade and give concise, actionable feedback in 2-3 sentences. Be direct and honest." },
            { role: "user", content: `Trade: ${entry.side} ${entry.displayName} | Entry: ${entry.entryPrice} | Exit: ${entry.exitPrice ?? "open"} | P&L: ${safePnlStr(entry.netPnl)} | Result: ${entry.result ?? "—"} | Duration: ${formatDuration(entry.durationMs)} | Emotion: ${entry.emotion} | Followed plan: ${entry.followedPlan === null ? "not recorded" : entry.followedPlan ? "yes" : "no"} | Entry quality: ${entry.entryQuality} | Notes: ${entry.notes || "none"}. Give coaching feedback.` }
          ],
        }),
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "Analysis unavailable.";
      updateAiAnalysis(entry.id, text);
    } catch {
      updateAiAnalysis(entry.id, "AI analysis failed. Check your Groq API key and connection.");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-white/5 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`font-bold text-sm ${sideBadge(entry.side)}`}>{entry.side}</span>
            <span className="text-white font-semibold">{entry.displayName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${resultBadge(entry.result)}`}>
              {entry.result ?? "—"}
            </span>
          </div>
          <p className="text-white/30 text-xs">{formatDate(entry.closedAt || entry.openedAt || entry.createdAt)}</p>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white transition text-xl w-7 h-7 flex items-center justify-center">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Trade Data */}
        <div className="p-4 border-b border-white/5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Trade Data (Paper)</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {[
              { label: "Lots", value: safeFmt(entry.lotSize) },
              { label: "Entry Price", value: safePriceStr(entry.entryPrice) },
              { label: "Exit Price", value: entry.exitPrice != null ? safePriceStr(entry.exitPrice) : "Not closed yet" },
              { label: "SL", value: entry.sl != null && entry.sl > 0 ? safePriceStr(entry.sl) : "Not recorded" },
              { label: "TP", value: entry.tp != null && entry.tp > 0 ? safePriceStr(entry.tp) : "Not recorded" },
              { label: "Gross P&L", value: entry.grossPnl != null ? safePnlStr(entry.grossPnl) : "—" },
              { label: "Net P&L", value: entry.netPnl != null ? safePnlStr(entry.netPnl) : "—", highlight: pnlColor },
              { label: "Duration", value: formatDuration(entry.durationMs) },
              { label: "Close Reason", value: reasonLabel(entry.closeReason) },
              { label: "Session", value: entry.session || "—" },
              { label: "Timeframe", value: entry.timeframe || "—" },
              { label: "Opened", value: formatDate(entry.openedAt) },
              { label: "Closed", value: entry.closedAt ? formatDate(entry.closedAt) : "—" },
            ].map(item => (
              <div key={item.label} className="flex justify-between gap-2">
                <span className="text-white/30 shrink-0">{item.label}</span>
                <span className={`${item.highlight ?? "text-white/70"} text-right`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* User-fill fields */}
        <div className="p-4 border-b border-white/5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Your Journal</p>
          <div className="flex flex-col gap-3">

            {/* Emotion */}
            <div>
              <p className="text-white/30 text-xs mb-1.5">Emotion during trade</p>
              <div className="flex gap-1 flex-wrap">
                {(["confident", "fearful", "greedy", "hesitant", "neutral", "frustrated"] as Emotion[]).map(em => (
                  <button key={em} onClick={() => updateEntry(entry.id, { emotion: em })}
                    className={`text-xs px-2.5 py-1 rounded-lg border capitalize transition ${entry.emotion === em ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"}`}>
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Followed plan */}
            <div>
              <p className="text-white/30 text-xs mb-1.5">Followed your plan?</p>
              <div className="flex gap-2">
                {[{ label: "✅ Yes", val: true }, { label: "❌ No", val: false }, { label: "— Not set", val: null }].map(opt => (
                  <button key={String(opt.val)} onClick={() => updateEntry(entry.id, { followedPlan: opt.val })}
                    className={`flex-1 py-1.5 rounded-lg text-xs border transition ${entry.followedPlan === opt.val ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Strategy */}
            <div>
              <p className="text-white/30 text-xs mb-1.5">Strategy used</p>
              <select value={entry.strategy}
                onChange={e => updateEntry(entry.id, { strategy: e.target.value as Strategy })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-white/25">
                {["other", "smc", "ema_pullback", "breakout", "reversal", "scalp", "news", "fibonacci", "support_resistance"].map(s => (
                  <option key={s} value={s} className="bg-[#0a0a0f] capitalize">{s.replace(/_/g, " ").toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Entry quality */}
            <div>
              <p className="text-white/30 text-xs mb-1.5">Entry quality</p>
              <div className="flex gap-1 flex-wrap">
                {(["good", "early", "late", "impulsive", "missed", "unknown"] as EntryQuality[]).map(q => (
                  <button key={q} onClick={() => updateEntry(entry.id, { entryQuality: q })}
                    className={`text-xs px-2.5 py-1 rounded-lg border capitalize transition ${entry.entryQuality === q ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"}`}>
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence/Stress sliders */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Confidence", key: "confidenceLevel", val: entry.confidenceLevel, color: "accent-green-400" },
                { label: "Stress", key: "stressLevel", val: entry.stressLevel, color: "accent-red-400" },
              ].map(item => (
                <div key={item.key}>
                  <div className="flex justify-between mb-1">
                    <span className="text-white/30 text-xs">{item.label}</span>
                    <span className="text-white/60 text-xs">{item.val}/10</span>
                  </div>
                  <input type="range" min={1} max={10} step={1} value={item.val}
                    onChange={e => updateEntry(entry.id, { [item.key]: parseInt(e.target.value) })}
                    className={`w-full ${item.color}`} />
                </div>
              ))}
            </div>

            {/* Notes */}
            <div>
              <p className="text-white/30 text-xs mb-1.5">Notes</p>
              <textarea value={entry.notes} rows={3}
                onChange={e => updateEntry(entry.id, { notes: e.target.value })}
                placeholder="What was your thesis? What happened during the trade?"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-white/25 placeholder-white/20" />
            </div>

            {/* What went right/wrong */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-green-400/60 text-xs mb-1.5">What went right</p>
                <textarea value={entry.whatWentRight} rows={2}
                  onChange={e => updateEntry(entry.id, { whatWentRight: e.target.value })}
                  placeholder="What worked?"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs resize-none focus:outline-none focus:border-green-500/20 placeholder-white/20" />
              </div>
              <div>
                <p className="text-red-400/60 text-xs mb-1.5">What went wrong</p>
                <textarea value={entry.whatWentWrong} rows={2}
                  onChange={e => updateEntry(entry.id, { whatWentWrong: e.target.value })}
                  placeholder="What failed?"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs resize-none focus:outline-none focus:border-red-500/20 placeholder-white/20" />
              </div>
            </div>

            {/* Lesson learned */}
            <div>
              <p className="text-white/30 text-xs mb-1.5">Lesson learned</p>
              <textarea value={entry.lessonLearned} rows={2}
                onChange={e => updateEntry(entry.id, { lessonLearned: e.target.value })}
                placeholder="What would you do differently?"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-white/25 placeholder-white/20" />
            </div>

          </div>
        </div>

        {/* AI Analysis */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/40 text-xs uppercase tracking-wider">AI Coaching (Groq)</p>
            <button
              onClick={handleGroqAnalysis}
              disabled={entry.aiLoading}
              className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-indigo-500/30 transition">
              {entry.aiLoading ? "Analyzing..." : "🤖 Get Feedback"}
            </button>
          </div>
          {entry.aiAnalysis ? (
            <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3">
              <p className="text-white/70 text-xs leading-relaxed">{entry.aiAnalysis}</p>
            </div>
          ) : (
            <p className="text-white/20 text-xs italic">
              Click "Get Feedback" to receive AI coaching on this trade. Requires NEXT_PUBLIC_GROQ_API_KEY.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Entry Card (list item) ────────────────────────────────────────────────

function EntryCard({
  entry,
  isSelected,
  onClick,
}: {
  entry: JournalEntry;
  isSelected: boolean;
  onClick: () => void;
}) {
  const displayDate = safeDate(entry.closedAt || entry.openedAt);
  const dateStr = displayDate
    ? displayDate.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  const pnlColor = (entry.netPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-white/5 cursor-pointer transition ${isSelected ? "bg-green-500/5 border-l-2 border-l-green-400" : "hover:bg-white/2 border-l-2 border-l-transparent"}`}>
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${sideBadge(entry.side)}`}>{entry.side}</span>
          <span className="text-white text-sm font-semibold">{entry.displayName}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full border capitalize ${resultBadge(entry.result)}`}>
            {entry.result ?? "—"}
          </span>
        </div>
        {entry.netPnl !== undefined && (
          <span className={`text-sm font-bold ${pnlColor}`}>{safePnlStr(entry.netPnl)}</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-white/30">
        <span>{dateStr}</span>
        {entry.durationMs && <span>{formatDuration(entry.durationMs)}</span>}
        {entry.closeReason && (
          <span className={`px-1.5 py-0.5 rounded-full ${reasonBadge(entry.closeReason)}`}>
            {reasonLabel(entry.closeReason)}
          </span>
        )}
        {entry.emotion && entry.emotion !== "neutral" && (
          <span className="text-white/20 capitalize">{entry.emotion}</span>
        )}
      </div>
      {entry.notes && entry.notes.trim().length > 0 && (
        <p className="text-white/20 text-xs mt-1.5 line-clamp-1 italic">"{entry.notes.trim()}"</p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

type FilterResult = "all" | "WIN" | "LOSS" | "BREAKEVEN";
type FilterSide = "all" | "BUY" | "SELL";
type FilterSession = "all" | "london" | "newyork" | "asian" | "sydney" | "unknown";
type SortKey = "date_desc" | "date_asc" | "pnl_desc" | "pnl_asc";

export default function JournalPage() {
  const { entries } = useJournalStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterResult, setFilterResult] = useState<FilterResult>("all");
  const [filterSide, setFilterSide] = useState<FilterSide>("all");
  const [filterSession, setFilterSession] = useState<FilterSession>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let list = [...entries];

    if (filterResult !== "all") list = list.filter(e => e.result === filterResult);
    if (filterSide !== "all") list = list.filter(e => e.side === filterSide);
    if (filterSession !== "all") list = list.filter(e => e.session === filterSession);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.displayName.toLowerCase().includes(q) ||
        e.symbol.toLowerCase().includes(q) ||
        (e.notes || "").toLowerCase().includes(q) ||
        (e.strategy || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      switch (sortKey) {
        case "date_desc": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "date_asc": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "pnl_desc": return (b.netPnl ?? 0) - (a.netPnl ?? 0);
        case "pnl_asc": return (a.netPnl ?? 0) - (b.netPnl ?? 0);
        default: return 0;
      }
    });

    return list;
  }, [entries, filterResult, filterSide, filterSession, sortKey, searchQuery]);

  const selectedEntry = entries.find(e => e.id === selectedId);

  const totalPnl = entries.filter(e => e.netPnl != null).reduce((s, e) => s + (e.netPnl ?? 0), 0);
  const winCount = entries.filter(e => e.result === "WIN").length;
  const closedCount = entries.filter(e => e.netPnl != null).length;
  const winRate = closedCount > 0 ? ((winCount / closedCount) * 100).toFixed(1) : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left — Entry list */}
          <div className={`flex flex-col border-r border-white/5 ${selectedEntry ? "w-96 shrink-0" : "flex-1"}`}>

            {/* Header */}
            <div className="p-4 border-b border-white/5 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-lg font-bold text-white">Trade Journal</h1>
                  <p className="text-white/30 text-xs mt-0.5">
                    {entries.length} entries from paper trades — auto-logged on close
                  </p>
                </div>
                {/* Summary badges */}
                {closedCount > 0 && (
                  <div className="flex gap-2 text-xs">
                    <span className={`px-2 py-1 rounded-lg font-semibold ${totalPnl >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                      {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
                    </span>
                    {winRate !== null && (
                      <span className="bg-white/5 text-white/50 px-2 py-1 rounded-lg">{winRate}% WR</span>
                    )}
                  </div>
                )}
              </div>

              {/* Search */}
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search symbol, notes, strategy..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-white/25 placeholder-white/20 mb-2"
              />

              {/* Filters row */}
              <div className="flex gap-2 flex-wrap items-center">
                <select value={filterResult} onChange={e => setFilterResult(e.target.value as FilterResult)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs">
                  <option value="all">All results</option>
                  <option value="WIN">Wins</option>
                  <option value="LOSS">Losses</option>
                  <option value="BREAKEVEN">Breakeven</option>
                </select>
                <select value={filterSide} onChange={e => setFilterSide(e.target.value as FilterSide)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs">
                  <option value="all">All sides</option>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
                <select value={filterSession} onChange={e => setFilterSession(e.target.value as FilterSession)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs">
                  <option value="all">All sessions</option>
                  <option value="london">London</option>
                  <option value="newyork">New York</option>
                  <option value="asian">Asian</option>
                  <option value="sydney">Sydney</option>
                  <option value="unknown">Unknown</option>
                </select>
                <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs">
                  <option value="date_desc">Newest first</option>
                  <option value="date_asc">Oldest first</option>
                  <option value="pnl_desc">Best P&L first</option>
                  <option value="pnl_asc">Worst P&L first</option>
                </select>
              </div>
            </div>

            {/* Entry list */}
            <div className="flex-1 overflow-y-auto">
              {entries.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center px-6">
                    <p className="text-3xl mb-3">📓</p>
                    <p className="text-white/30 text-sm">No journal entries yet</p>
                    <p className="text-white/15 text-xs mt-2 leading-relaxed">
                      Entries are automatically created when you close a paper trade from the Dashboard.
                    </p>
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-white/20 text-sm">No entries match your filters</p>
                </div>
              ) : (
                filtered.map(entry => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    isSelected={selectedId === entry.id}
                    onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
                  />
                ))
              )}
            </div>

          </div>

          {/* Right — Entry detail */}
          {selectedEntry && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <EntryDetail
                entry={selectedEntry}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}