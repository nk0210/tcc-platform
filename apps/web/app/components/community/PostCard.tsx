"use client";
/**
 * TCC Social — the feed's centerpiece. Header + type-specific body
 * (delegated to PostTypeCards) + reactions + actions + inline comments.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCommunityStore, type CommunityPost, type CommunityPostType } from "@/store/communityStore";
import { useAuthStore } from "@/store/authStore";
import ReportButton from "@/components/ReportButton";
import { ReactionButton, ReactionSummary } from "./ReactionBar";
import { TradeIdeaCard, SharedTradeCard, StrategyPostCard, AcademyPostCard } from "./PostTypeCards";
import CommentSection from "./CommentSection";

const POST_TYPE_BADGE: Record<CommunityPostType, string> = {
  TEXT:                "💬 Thought",
  TRADE_IDEA:          "📈 Trade Idea",
  SHARED_TRADE:        "📊 Shared Trade",
  ACADEMY_COMPLETION:  "🎓 Academy",
  STRATEGY_SHARE:      "📋 Strategy",
  COMPETITION_UPDATE:  "🏆 Competition",
};

const VISIBILITY_ICON: Record<CommunityPost["visibility"], string> = {
  PUBLIC: "🌎", FOLLOWERS_ONLY: "👥", PRIVATE: "🔒",
};

/** Compact, read-only embed of the post a repost points at. Deliberately
 *  not the full PostTypeCards renderers (StrategyPostCard/AcademyPostCard
 *  need fields — linkedStrategyTitle etc. — that the shallow RepostEmbed
 *  the backend sends doesn't carry) — just enough to identify the original
 *  post and its trade numbers at a glance. */
function RepostedEmbed({ repostOf, router }: { repostOf: NonNullable<CommunityPost["repostOf"]>; router: ReturnType<typeof useRouter> }) {
  const idea  = repostOf.type === "TRADE_IDEA"   ? (repostOf.tradeSnapshot as { symbol: string; direction: string; entry: number } | null) : null;
  const trade = repostOf.type === "SHARED_TRADE" ? (repostOf.tradeSnapshot as { symbol: string; side: string; netPnl: number } | null) : null;

  return (
    <button
      onClick={() => router.push(`/community?post=${repostOf.id}`)}
      className="w-full text-left rounded-xl border border-border bg-elevated/60 hover:border-border-strong transition px-3.5 py-3 mb-3"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-6 h-6 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-hover text-[10px] font-bold shrink-0">
          {repostOf.author.handle[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="text-fg text-xs font-semibold">{repostOf.author.displayName}</span>
        <span className="text-fg-dim text-xs">@{repostOf.author.handle}</span>
        <span className="text-fg-dim text-xs">· {timeAgo(repostOf.createdAt)}</span>
      </div>
      {repostOf.content && <p className="text-fg-muted text-xs leading-relaxed line-clamp-3 mb-1.5">{repostOf.content}</p>}
      {idea && (
        <p className="text-xs"><span className="badge badge-accent !text-[10px]">📈 {idea.symbol} {idea.direction}</span> <span className="text-fg-dim">entry {idea.entry}</span></p>
      )}
      {trade && (
        <p className="text-xs"><span className={`badge !text-[10px] ${trade.netPnl >= 0 ? "badge-success" : "badge-danger"}`}>📊 {trade.symbol} {trade.side}</span> <span className={trade.netPnl >= 0 ? "text-success" : "text-danger"}>{trade.netPnl >= 0 ? "+" : ""}${Math.abs(trade.netPnl).toFixed(2)}</span></p>
      )}
    </button>
  );
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Renders #hashtags in post content as clickable links that filter the feed. */
function ContentWithHashtags({ content, onHashtagClick }: { content: string; onHashtagClick: (tag: string) => void }) {
  const parts = content.split(/(#[a-zA-Z0-9_]+)/g);
  return (
    <p className="text-fg-muted text-sm leading-relaxed mb-3 whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.startsWith("#") ? (
          <button
            key={i}
            onClick={() => onHashtagClick(part.slice(1))}
            className="text-accent-hover hover:underline font-medium"
          >
            {part}
          </button>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

export default function PostCard({ post, onHashtagClick }: { post: CommunityPost; onHashtagClick?: (tag: string) => void }) {
  const { user } = useAuthStore();
  const { toggleLike, toggleBookmark, trackShare, repost, deletePost, updatePost, blockUser, muteUser } = useCommunityStore();
  const router = useRouter();
  const [showComments, setShowComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [repostBoxOpen, setRepostBoxOpen] = useState(false);
  const [repostCaption, setRepostCaption] = useState("");
  const [isReposting, setIsReposting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isOwn = post.authorId === user?.id;

  const handleCopyLink = async () => {
    setShareMenuOpen(false);
    await trackShare(post.id);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/community?post=${post.id}`);
    } catch { /* clipboard permission denied — share was still tracked */ }
  };

  const handleRepost = async () => {
    setIsReposting(true);
    const result = await repost(post.id, repostCaption.trim() || undefined);
    setIsReposting(false);
    if (result) { setRepostBoxOpen(false); setRepostCaption(""); }
  };

  const handleSaveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === post.content) { setIsEditing(false); setEditContent(post.content); return; }
    setIsSavingEdit(true);
    await updatePost(post.id, { content: trimmed });
    setIsSavingEdit(false);
    setIsEditing(false);
  };

  const handleBlock = async () => {
    setMenuOpen(false);
    if (!confirm(`Block @${post.author.handle}? You won't see each other's posts, and you'll stop following each other.`)) return;
    await blockUser(post.author.handle);
  };

  const handleMute = async () => {
    setMenuOpen(false);
    await muteUser(post.author.handle);
  };

  return (
    <div className="glass rounded-xl p-4 sm:p-5 hover:border-border-strong transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push(`/profile?handle=${post.author.handle}`)}
            className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-hover text-sm font-bold shrink-0 hover:bg-accent/25 transition"
          >
            {post.author.handle[0]?.toUpperCase() ?? "?"}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => router.push(`/profile?handle=${post.author.handle}`)} className="text-fg font-semibold text-sm hover:underline">
                {post.author.displayName}
              </button>
              {post.author.isVerified && <span className="text-accent-hover text-xs" title="Verified">✓</span>}
            </div>
            <div className="flex items-center gap-1.5 text-fg-dim text-xs">
              <span>@{post.author.handle}</span>
              <span>·</span>
              <span>{timeAgo(post.createdAt)}</span>
              <span>·</span>
              <span title={post.visibility}>{VISIBILITY_ICON[post.visibility]}</span>
            </div>
            <span className="badge badge-neutral mt-1 !text-[10px]">{POST_TYPE_BADGE[post.type]}</span>
          </div>
        </div>

        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen((m) => !m)} className="btn btn-ghost w-7 h-7 !p-0 rounded-full text-fg-dim">⋯</button>
          {menuOpen && (
            <div className="glass absolute right-0 top-8 z-20 rounded-lg py-1 min-w-[160px]" style={{ boxShadow: "var(--shadow-elevated)" }}>
              {isOwn ? (
                <>
                  <button
                    onClick={() => { setMenuOpen(false); setEditContent(post.content); setIsEditing(true); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-fg-muted hover:bg-elevated transition"
                  >
                    ✏️ Edit {post.repostOf ? "caption" : "post"}
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); deletePost(post.id); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-danger hover:bg-elevated transition"
                  >
                    🗑 Delete post
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleMute} className="w-full text-left px-3 py-1.5 text-xs text-fg-muted hover:bg-elevated transition">
                    🔕 Mute @{post.author.handle}
                  </button>
                  <button onClick={handleBlock} className="w-full text-left px-3 py-1.5 text-xs text-danger hover:bg-elevated transition">
                    🚫 Block @{post.author.handle}
                  </button>
                  <div className="px-1 border-t border-border mt-1 pt-1">
                    <ReportButton
                      reportedItemType="post"
                      reportedItemId={post.id}
                      reportedItemTitle={`${post.author.handle}: ${post.content.slice(0, 60)}`}
                      reportedUserId={post.authorId}
                      sourceFeature="Community Feed"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content + hashtags — a repost's own content is just the optional caption */}
      {isEditing ? (
        <div className="mb-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            maxLength={5000}
            rows={3}
            autoFocus
            className="w-full bg-elevated border border-border rounded-lg p-2.5 text-fg text-sm resize-none focus:outline-none focus:border-accent"
          />
          <div className="flex items-center justify-end gap-2 mt-1.5">
            <button onClick={() => { setIsEditing(false); setEditContent(post.content); }} className="btn btn-ghost text-xs !px-3 !py-1.5">Cancel</button>
            <button onClick={handleSaveEdit} disabled={isSavingEdit} className="btn btn-primary text-xs !px-3 !py-1.5 disabled:opacity-50">
              {isSavingEdit ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        post.content && <ContentWithHashtags content={post.content} onHashtagClick={(tag) => onHashtagClick?.(tag)} />
      )}

      {/* Reposted original, embedded */}
      {post.repostOf && <RepostedEmbed repostOf={post.repostOf} router={router} />}

      {/* Type-specific rich body (never set on a repost — its type is always TEXT) */}
      {post.type === "TRADE_IDEA"         && <TradeIdeaCard post={post} />}
      {post.type === "SHARED_TRADE"       && <SharedTradeCard post={post} />}
      {post.type === "STRATEGY_SHARE"     && <StrategyPostCard post={post} />}
      {post.type === "ACADEMY_COMPLETION" && <AcademyPostCard post={post} />}

      {/* Reaction summary */}
      <ReactionSummary count={post._count.likes} reactions={post.reactions} />

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-border pt-2 mt-2">
        <ReactionButton myReaction={post.myReaction} onReact={(type) => toggleLike(post.id, type)} />
        <button onClick={() => setShowComments((s) => !s)} className="btn btn-ghost gap-1.5 text-xs !px-3 !py-1.5">
          <span className="text-sm leading-none">💬</span>
          <span className="font-medium">{post._count.comments > 0 ? post._count.comments : "Comment"}</span>
        </button>
        <div className="relative">
          <button onClick={() => setShareMenuOpen((s) => !s)} className="btn btn-ghost gap-1.5 text-xs !px-3 !py-1.5">
            <span className="text-sm leading-none">↗</span>
            <span className="font-medium">{post._count.shares > 0 ? post._count.shares : "Share"}</span>
          </button>
          {shareMenuOpen && (
            <div className="glass absolute left-0 top-9 z-20 rounded-lg py-1 min-w-[160px]" style={{ boxShadow: "var(--shadow-elevated)" }}>
              <button
                onClick={handleCopyLink}
                className="w-full text-left px-3 py-1.5 text-xs text-fg-muted hover:bg-elevated transition"
              >
                🔗 Copy link
              </button>
              <button
                onClick={() => { setShareMenuOpen(false); setRepostBoxOpen((s) => !s); }}
                className="w-full text-left px-3 py-1.5 text-xs text-fg-muted hover:bg-elevated transition"
              >
                🔁 Repost to your feed
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => toggleBookmark(post.id)}
          className={`btn btn-ghost gap-1.5 text-xs !px-3 !py-1.5 ml-auto ${post.isBookmarked ? "!text-warning" : ""}`}
        >
          <span className="text-sm leading-none">{post.isBookmarked ? "🔖" : "📑"}</span>
        </button>
      </div>

      {repostBoxOpen && (
        <div className="mt-2 rounded-lg border border-border bg-elevated p-3">
          <textarea
            value={repostCaption}
            onChange={(e) => setRepostCaption(e.target.value)}
            placeholder="Add a caption (optional)…"
            maxLength={500}
            rows={2}
            className="w-full bg-transparent text-fg text-sm placeholder-fg-dim focus:outline-none resize-none"
          />
          <div className="flex items-center justify-end gap-2 mt-1.5">
            <button onClick={() => { setRepostBoxOpen(false); setRepostCaption(""); }} className="btn btn-ghost text-xs !px-3 !py-1.5">Cancel</button>
            <button onClick={handleRepost} disabled={isReposting} className="btn btn-primary text-xs !px-3 !py-1.5 disabled:opacity-50">
              {isReposting ? "Reposting…" : "Repost"}
            </button>
          </div>
        </div>
      )}

      {showComments && <CommentSection post={post} />}
    </div>
  );
}
