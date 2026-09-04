/**
 * TCC Social — type-specific post bodies. A Trade Idea/Shared Trade should
 * look substantially more premium than a plain text post; these are the
 * dedicated renderers PostCard delegates to based on post.type. All read
 * real fields off the post (tradeSnapshot/linkedStrategyTitle/etc,
 * populated by the composer at creation time) — nothing here invents data.
 */
import type { CommunityPost, TradeSnapshot, TradeIdeaSnapshot } from "@/store/communityStore";

function formatPnl(val: number): string {
  return `${val >= 0 ? "+" : ""}$${Math.abs(val).toFixed(2)}`;
}

// ── Trade Idea ────────────────────────────────────────────────────────────

export function TradeIdeaCard({ post }: { post: CommunityPost }) {
  const idea = post.tradeSnapshot as TradeIdeaSnapshot | null;
  if (!idea) return null;

  const isLong = idea.direction === "LONG";
  const rr =
    idea.stopLoss != null && idea.takeProfit != null
      ? Math.abs(idea.takeProfit - idea.entry) / Math.max(Math.abs(idea.entry - idea.stopLoss), 1e-9)
      : null;

  return (
    <div className="rounded-xl border border-accent/25 bg-accent/5 overflow-hidden mb-3">
      <div className="flex items-center gap-2 px-4 pt-3">
        <span className="badge badge-accent">📈 TRADE IDEA</span>
        <span className={`badge ${isLong ? "badge-success" : "badge-danger"}`}>{idea.direction}</span>
      </div>

      <div className="px-4 pt-2 pb-1">
        <p className="text-fg text-xl font-bold tracking-tight">{idea.symbol}</p>
        {idea.timeframe && <p className="text-fg-dim text-xs">{idea.timeframe} timeframe</p>}
      </div>

      <div className="grid grid-cols-3 gap-px bg-border mt-2">
        <div className="bg-surface px-3 py-2.5 text-center">
          <p className="text-fg-dim text-[10px] uppercase tracking-wide">Entry</p>
          <p className="text-fg font-semibold text-sm tabular-nums">{idea.entry}</p>
        </div>
        <div className="bg-surface px-3 py-2.5 text-center">
          <p className="text-fg-dim text-[10px] uppercase tracking-wide">Stop Loss</p>
          <p className="text-danger font-semibold text-sm tabular-nums">{idea.stopLoss ?? "—"}</p>
        </div>
        <div className="bg-surface px-3 py-2.5 text-center">
          <p className="text-fg-dim text-[10px] uppercase tracking-wide">Target</p>
          <p className="text-success font-semibold text-sm tabular-nums">{idea.takeProfit ?? "—"}</p>
        </div>
      </div>

      {rr !== null && (
        <div className="px-4 py-2 flex items-center justify-between border-t border-border">
          <span className="text-fg-dim text-xs">Risk / Reward</span>
          <span className="text-accent-hover font-semibold text-xs">1 : {rr.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

// ── Shared Trade (real, verified from the trader's own journal) ──────────

export function SharedTradeCard({ post }: { post: CommunityPost }) {
  const trade = post.tradeSnapshot as TradeSnapshot | null;
  if (!trade) return null;

  const isWin = trade.netPnl >= 0;

  return (
    <div className={`rounded-xl border overflow-hidden mb-3 ${isWin ? "border-success/25 bg-success/5" : "border-danger/25 bg-danger/5"}`}>
      <div className="flex items-center gap-2 px-4 pt-3">
        <span className={`badge ${isWin ? "badge-success" : "badge-danger"}`}>
          {isWin ? "✓ TRADE CLOSED" : "✗ TRADE CLOSED"}
        </span>
        <span className={`badge ${trade.side === "BUY" ? "badge-success" : "badge-danger"}`}>{trade.side}</span>
      </div>

      <div className="px-4 pt-2">
        <p className="text-fg text-lg font-bold">{trade.displayName}</p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border mt-2">
        <div className="bg-surface px-3 py-2.5 text-center">
          <p className="text-fg-dim text-[10px] uppercase tracking-wide">Entry</p>
          <p className="text-fg font-semibold text-sm tabular-nums">{trade.entryPrice}</p>
        </div>
        <div className="bg-surface px-3 py-2.5 text-center">
          <p className="text-fg-dim text-[10px] uppercase tracking-wide">Exit</p>
          <p className="text-fg font-semibold text-sm tabular-nums">{trade.exitPrice}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <span className={`text-2xl font-bold tabular-nums ${isWin ? "text-success" : "text-danger"}`}>
          {formatPnl(trade.netPnl)}
        </span>
        <span className={`badge ${
          trade.closeReason === "STOP_LOSS" ? "badge-danger" : trade.closeReason === "TAKE_PROFIT" ? "badge-success" : "badge-neutral"
        }`}>
          {trade.closeReason === "STOP_LOSS" ? "⛔ Stop Loss" : trade.closeReason === "TAKE_PROFIT" ? "✅ Take Profit" : "Manual close"}
        </span>
      </div>

      <p className="text-fg-dim text-[11px] px-4 pb-3">⚠ Paper trade · Verified from journal · Not financial advice</p>
    </div>
  );
}

// ── Strategy share ─────────────────────────────────────────────────────────

export function StrategyPostCard({ post }: { post: CommunityPost }) {
  if (!post.linkedStrategyTitle) return null;
  return (
    <div className="rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 mb-3">
      <p className="text-accent-hover text-xs font-bold uppercase tracking-wide mb-1">📋 Strategy</p>
      <p className="text-fg font-semibold text-sm">{post.linkedStrategyTitle}</p>
      <p className="text-fg-dim text-[11px] mt-1">Educational content · Not verified performance</p>
    </div>
  );
}

// ── Academy share ───────────────────────────────────────────────────────────

export function AcademyPostCard({ post }: { post: CommunityPost }) {
  if (!post.linkedCourseTitle) return null;
  return (
    <div className="rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 mb-3">
      <p className="text-warning text-xs font-bold uppercase tracking-wide mb-1">🎓 Academy Milestone</p>
      <p className="text-fg font-semibold text-sm">Completed: {post.linkedCourseTitle}</p>
    </div>
  );
}
