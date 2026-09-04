"use client";
/**
 * TCC Social — post composer. Type-specific structured fields per the post
 * type, all through the existing createPost API (which already accepts
 * linkedTradeId/linkedStrategyId/tradeSnapshot/etc — nothing invented on
 * the backend for this). Trade Idea's entry/stopLoss/takeProfit/timeframe
 * are stored in the same flexible tradeSnapshot JSON column Shared Trade
 * already uses, just a differently-shaped object (see TradeIdeaSnapshot in
 * communityStore.ts) — disambiguated by post.type at render time.
 */
import { useState } from "react";
import {
  useCommunityStore,
  type CommunityPostType,
  type PostVisibility,
  type TradeIdeaSnapshot,
} from "@/store/communityStore";
import { useAuthStore } from "@/store/authStore";
import { useTradeStore } from "@/store/tradeStore";
import { useStrategyStore } from "@/store/strategyStore";
import { useAcademyStore } from "@/store/academyStore";
import { useNotificationStore } from "@/store/notificationStore";

const POST_TYPE_LABELS: Record<CommunityPostType, string> = {
  TEXT:                "💬 Thought",
  TRADE_IDEA:          "📈 Trade Idea",
  SHARED_TRADE:        "📊 Shared Trade",
  STRATEGY_SHARE:      "📋 Strategy",
  ACADEMY_COMPLETION:  "🎓 Academy",
  COMPETITION_UPDATE:  "🏆 Competition",
};

const COMPOSABLE_TYPES: CommunityPostType[] = ["TEXT", "TRADE_IDEA", "SHARED_TRADE", "STRATEGY_SHARE", "ACADEMY_COMPLETION"];

function formatPnl(val: number) {
  return `${val >= 0 ? "+" : ""}$${Math.abs(val).toFixed(2)}`;
}

/** Pulls #hashtags out of freeform content into a tags[] array — the
 *  backend already has a real `tags` column, this just populates it from
 *  what the user typed instead of requiring a separate tag input. */
function extractTags(content: string): string[] {
  const matches = content.match(/#([a-zA-Z0-9_]+)/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase()))).slice(0, 10);
}

export default function PostComposer({ onPost, onCancel }: { onPost: () => void; onCancel: () => void }) {
  const { user } = useAuthStore();
  const { createPost } = useCommunityStore();
  const { closedTrades } = useTradeStore();
  const { strategies } = useStrategyStore();
  const publishedStrategies = strategies.filter((s) => s.type === "CREATOR_PUBLISHED");
  const { courses, myProgress } = useAcademyStore();
  const { addNotification } = useNotificationStore();

  const [type, setType]             = useState<CommunityPostType>("TEXT");
  const [content, setContent]       = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("PUBLIC");
  const [linkedTrade, setLinkedTrade]       = useState("");
  const [linkedStrategy, setLinkedStrategy] = useState("");
  const [linkedCourse, setLinkedCourse]     = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Trade Idea structured fields
  const [ideaSymbol, setIdeaSymbol]       = useState("");
  const [ideaDirection, setIdeaDirection] = useState<"LONG" | "SHORT">("LONG");
  const [ideaEntry, setIdeaEntry]         = useState("");
  const [ideaStopLoss, setIdeaStopLoss]   = useState("");
  const [ideaTakeProfit, setIdeaTakeProfit] = useState("");
  const [ideaTimeframe, setIdeaTimeframe] = useState("");

  const completedCourses = courses.filter((c) => {
    const p = myProgress[c.id];
    return p && c.lessons.length > 0 && p.completedLessons.length >= c.lessons.length;
  });

  const canShareTrade    = closedTrades.length > 0;
  const canShareStrategy = publishedStrategies.length > 0;
  const canShareAcademy  = completedCourses.length > 0;

  const ideaValid = type !== "TRADE_IDEA" || (ideaSymbol.trim() && ideaEntry.trim());
  const canSubmit = content.trim().length > 0 && ideaValid;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);

    let tradeSnapshot: TradeIdeaSnapshot | ReturnType<typeof buildSharedSnapshot> | undefined;
    let linkedStrategyTitle: string | undefined;
    let linkedCourseTitle: string | undefined;
    let symbol: string | undefined;

    if (type === "TRADE_IDEA") {
      tradeSnapshot = {
        symbol: ideaSymbol.trim().toUpperCase(),
        displayName: ideaSymbol.trim().toUpperCase(),
        direction: ideaDirection,
        entry: Number(ideaEntry),
        stopLoss: ideaStopLoss ? Number(ideaStopLoss) : null,
        takeProfit: ideaTakeProfit ? Number(ideaTakeProfit) : null,
        timeframe: ideaTimeframe.trim() || null,
      };
      symbol = tradeSnapshot.symbol;
    }

    if (type === "SHARED_TRADE" && linkedTrade) {
      const trade = closedTrades.find((t) => t.id === linkedTrade);
      if (trade) {
        tradeSnapshot = buildSharedSnapshot(trade);
        symbol = trade.symbol;
      }
    }

    if (type === "STRATEGY_SHARE" && linkedStrategy) {
      linkedStrategyTitle = publishedStrategies.find((s) => s.id === linkedStrategy)?.title;
    }
    if (type === "ACADEMY_COMPLETION" && linkedCourse) {
      linkedCourseTitle = completedCourses.find((c) => c.id === linkedCourse)?.title;
    }

    const post = await createPost({
      type,
      content: content.trim(),
      visibility,
      linkedTradeId:    type === "SHARED_TRADE"       ? linkedTrade    : undefined,
      linkedStrategyId: type === "STRATEGY_SHARE"     ? linkedStrategy : undefined,
      linkedCourseId:   type === "ACADEMY_COMPLETION" ? linkedCourse   : undefined,
      tradeSnapshot,
      linkedStrategyTitle,
      linkedCourseTitle,
      symbol,
      tags: extractTags(content),
    });

    setSubmitting(false);
    if (!post) return;

    addNotification({
      type: "community", priority: "low",
      title: "✅ Post shared",
      message: `Your ${POST_TYPE_LABELS[type]} has been posted to the community.`,
    });

    setContent(""); setLinkedTrade(""); setLinkedStrategy(""); setLinkedCourse("");
    setIdeaSymbol(""); setIdeaEntry(""); setIdeaStopLoss(""); setIdeaTakeProfit(""); setIdeaTimeframe("");
    setType("TEXT");
    onPost();
  };

  return (
    <div className="glass rounded-xl p-4 sm:p-5 mb-5" style={{ boxShadow: "var(--shadow-elevated)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-fg font-semibold text-sm">Create post</p>
        <button onClick={onCancel} className="btn btn-ghost w-7 h-7 !p-0 rounded-full text-fg-dim">✕</button>
      </div>

      {/* Post type selector */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {COMPOSABLE_TYPES.map((pt) => {
          let disabled = false;
          let reason = "";
          if (pt === "SHARED_TRADE"       && !canShareTrade)    { disabled = true; reason = "No closed trades yet"; }
          if (pt === "STRATEGY_SHARE"     && !canShareStrategy) { disabled = true; reason = "No published strategies"; }
          if (pt === "ACADEMY_COMPLETION" && !canShareAcademy)  { disabled = true; reason = "No completed courses yet"; }

          return (
            <button
              key={pt}
              onClick={() => !disabled && setType(pt)}
              title={reason || undefined}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                disabled
                  ? "text-fg-dim bg-elevated border-border cursor-not-allowed opacity-50"
                  : type === pt
                    ? "bg-accent text-white border-accent"
                    : "text-fg-dim bg-elevated border-border hover:border-border-strong hover:text-fg-muted"
              }`}
            >
              {POST_TYPE_LABELS[pt]}
            </button>
          );
        })}
      </div>

      {/* Trade Idea structured fields */}
      {type === "TRADE_IDEA" && (
        <div className="mb-3 p-3 bg-elevated border border-border rounded-xl flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={ideaSymbol}
              onChange={(e) => setIdeaSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol (e.g. XAUUSD)"
              className="bg-surface border border-border rounded-lg px-3 py-2 text-fg text-xs focus:outline-none focus:border-accent placeholder-fg-dim"
            />
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setIdeaDirection("LONG")}
                className={`flex-1 text-xs font-semibold py-2 transition ${ideaDirection === "LONG" ? "bg-success-soft text-success" : "bg-surface text-fg-dim"}`}
              >LONG</button>
              <button
                onClick={() => setIdeaDirection("SHORT")}
                className={`flex-1 text-xs font-semibold py-2 transition ${ideaDirection === "SHORT" ? "bg-danger-soft text-danger" : "bg-surface text-fg-dim"}`}
              >SHORT</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input value={ideaEntry} onChange={(e) => setIdeaEntry(e.target.value)} placeholder="Entry" inputMode="decimal"
              className="bg-surface border border-border rounded-lg px-3 py-2 text-fg text-xs focus:outline-none focus:border-accent placeholder-fg-dim" />
            <input value={ideaStopLoss} onChange={(e) => setIdeaStopLoss(e.target.value)} placeholder="Stop loss" inputMode="decimal"
              className="bg-surface border border-border rounded-lg px-3 py-2 text-fg text-xs focus:outline-none focus:border-accent placeholder-fg-dim" />
            <input value={ideaTakeProfit} onChange={(e) => setIdeaTakeProfit(e.target.value)} placeholder="Take profit" inputMode="decimal"
              className="bg-surface border border-border rounded-lg px-3 py-2 text-fg text-xs focus:outline-none focus:border-accent placeholder-fg-dim" />
          </div>
          <input value={ideaTimeframe} onChange={(e) => setIdeaTimeframe(e.target.value)} placeholder="Timeframe (e.g. 15m, H1, D1) — optional"
            className="bg-surface border border-border rounded-lg px-3 py-2 text-fg text-xs focus:outline-none focus:border-accent placeholder-fg-dim" />
        </div>
      )}

      {/* Disabled-type hints */}
      {type === "TEXT" && !canShareTrade && (
        <p className="text-fg-dim text-xs mb-2 italic">💡 You need a closed journal trade before sharing verified results.</p>
      )}

      {/* Linked selectors for existing-data post types */}
      {type === "SHARED_TRADE" && canShareTrade && (
        <div className="mb-3">
          <select value={linkedTrade} onChange={(e) => setLinkedTrade(e.target.value)}
            className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-xs">
            <option value="">Choose a closed trade…</option>
            {closedTrades.slice(0, 20).map((t) => (
              <option key={t.id} value={t.id}>{t.side} {t.displayName} @ ${t.entryPrice.toFixed(4)} → {formatPnl(t.netPnl)}</option>
            ))}
          </select>
        </div>
      )}
      {type === "STRATEGY_SHARE" && canShareStrategy && (
        <div className="mb-3">
          <select value={linkedStrategy} onChange={(e) => setLinkedStrategy(e.target.value)}
            className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-xs">
            <option value="">Choose a strategy…</option>
            {publishedStrategies.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
      )}
      {type === "ACADEMY_COMPLETION" && canShareAcademy && (
        <div className="mb-3">
          <select value={linkedCourse} onChange={(e) => setLinkedCourse(e.target.value)}
            className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-xs">
            <option value="">Choose a completed course…</option>
            {completedCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      )}

      {/* Content */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          type === "TEXT"          ? "Share a trading thought, lesson, or insight… use #hashtags"
          : type === "TRADE_IDEA"  ? "What's your thesis for this setup?"
          : type === "SHARED_TRADE"? "What was your thesis? What happened?"
          : type === "STRATEGY_SHARE" ? "Tell the community about your strategy approach…"
          : "Share your academy milestone…"
        }
        rows={3}
        className="w-full bg-elevated border border-border rounded-xl px-4 py-3 text-fg text-sm resize-none focus:outline-none focus:border-accent placeholder-fg-dim mb-3"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as PostVisibility)}
            className="bg-elevated border border-border rounded-lg px-2 py-1.5 text-fg text-xs">
            <option value="PUBLIC">🌎 Public</option>
            <option value="FOLLOWERS_ONLY">👥 Followers only</option>
            <option value="PRIVATE">🔒 Private</option>
          </select>
          <span className="text-fg-dim text-xs">{content.length}/5000</span>
        </div>
        <button onClick={handleSubmit} disabled={!canSubmit || submitting} className="btn btn-primary text-sm !px-5 !py-2 disabled:opacity-40">
          {submitting ? "Posting…" : "Post"}
        </button>
      </div>

      <p className="text-fg-dim text-xs mt-3">All content is your own and not financial advice.</p>
    </div>
  );
}

function buildSharedSnapshot(trade: {
  symbol: string; displayName: string; side: "BUY" | "SELL"; lotSize: number;
  entryPrice: number; exitPrice: number; netPnl: number;
  closeReason: "MANUAL" | "STOP_LOSS" | "TAKE_PROFIT"; durationMs: number;
}) {
  return {
    symbol: trade.symbol, displayName: trade.displayName, side: trade.side, lotSize: trade.lotSize,
    entryPrice: trade.entryPrice, exitPrice: trade.exitPrice, netPnl: trade.netPnl,
    closeReason: trade.closeReason, durationMs: trade.durationMs,
  };
}
