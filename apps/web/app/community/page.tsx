"use client";
/**
 * TCC Community Page — /community
 *
 * API-backed via communityStore.ts (Phase Alpha Frontend Integration).
 *
 * Notable shape changes from the old local-only store:
 *   - post.likes/savedBy arrays → post.isLiked/isBookmarked booleans + _count.
 *   - post.comments is no longer embedded on the post — fetched on demand via
 *     getComments()/addComment(), so CommentSection now owns its own list.
 *   - post.reportCount no longer exists on the API response (moderation
 *     counts aren't exposed to regular users) — the report badge was removed.
 *   - The store holds one active feed (`posts`) selected via feedType
 *     ("global" | "following" | "saved"), not a client-side derived saved
 *     list — switching to the Saved tab now calls setFeedType("saved").
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useCommunityStore,
  type CommunityPost,
  type CommunityComment,
  type CommunityPostType,
  type PostVisibility,
} from "@/store/communityStore";
import { useAuthStore } from "@/store/authStore";
import { useTradeStore } from "@/store/tradeStore";
import { useStrategyStore } from "@/store/strategyStore";
import { useAcademyStore } from "@/store/academyStore";
import { useNotificationStore } from "@/store/notificationStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import ReportButton from "@/components/ReportButton";

// ── Helpers ───────────────────────────────────────────────────────────────

type CommunityTab = "feed" | "saved" | "groups" | "stories" | "messages";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatPnl(val: number) {
  return `${val >= 0 ? "+" : ""}$${Math.abs(val).toFixed(2)}`;
}

const POST_TYPE_LABELS: Record<CommunityPostType, string> = {
  TEXT:                "💬 Thought",
  TRADE_IDEA:          "💡 Trade Idea",
  SHARED_TRADE:        "📊 Shared Trade",
  ACADEMY_COMPLETION:  "🎓 Academy",
  STRATEGY_SHARE:      "📋 Strategy",
  COMPETITION_UPDATE:  "🏆 Competition",
};

// ── Post Composer ─────────────────────────────────────────────────────────

function PostComposer({ onPost }: { onPost: () => void }) {
  const { user } = useAuthStore();
  const { createPost } = useCommunityStore();
  const { closedTrades } = useTradeStore();
  const { strategies } = useStrategyStore();
  const publishedStrategies = strategies.filter((s) => s.type === "CREATOR_PUBLISHED");
  const { courses, myProgress } = useAcademyStore();
  const { addNotification } = useNotificationStore();

  const [type,       setType]       = useState<CommunityPostType>("TEXT");
  const [content,    setContent]    = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("PUBLIC");
  const [linkedTrade,    setLinkedTrade]    = useState("");
  const [linkedStrategy, setLinkedStrategy] = useState("");
  const [linkedCourse,   setLinkedCourse]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const completedCourses = courses.filter(c => {
    const p = myProgress[c.id];
    return p && c.lessons.length > 0 && p.completedLessons.length >= c.lessons.length;
  });

  const canShareTrade    = closedTrades.length > 0;
  const canShareStrategy = publishedStrategies.length > 0;
  const canShareAcademy  = completedCourses.length > 0;

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;
    setSubmitting(true);

    // Build trade snapshot if sharing a trade
    let tradeSnapshot: CommunityPost["tradeSnapshot"] | undefined;
    let linkedStrategyTitle: string | undefined;
    let linkedCourseTitle: string | undefined;

    if (type === "SHARED_TRADE" && linkedTrade) {
      const trade = closedTrades.find(t => t.id === linkedTrade);
      if (trade) {
        tradeSnapshot = {
          symbol:      trade.symbol,
          displayName: trade.displayName,
          side:        trade.side,
          lotSize:     trade.lotSize,
          entryPrice:  trade.entryPrice,
          exitPrice:   trade.exitPrice,
          netPnl:      trade.netPnl,
          closeReason: trade.closeReason,
          durationMs:  trade.durationMs,
        };
      }
    }

    if (type === "STRATEGY_SHARE" && linkedStrategy) {
      const strat = publishedStrategies.find(s => s.id === linkedStrategy);
      linkedStrategyTitle = strat?.title;
    }

    if (type === "ACADEMY_COMPLETION" && linkedCourse) {
      const course = completedCourses.find(c => c.id === linkedCourse);
      linkedCourseTitle = course?.title;
    }

    const post = await createPost({
      type,
      content:             content.trim(),
      visibility,
      linkedTradeId:       type === "SHARED_TRADE"       ? linkedTrade    : undefined,
      linkedStrategyId:    type === "STRATEGY_SHARE"     ? linkedStrategy : undefined,
      linkedCourseId:      type === "ACADEMY_COMPLETION" ? linkedCourse   : undefined,
      tradeSnapshot,
      linkedStrategyTitle,
      linkedCourseTitle,
    });

    setSubmitting(false);
    if (!post) return;

    addNotification({
      type:     "community",
      priority: "low",
      title:    `✅ Post Shared`,
      message:  `Your ${POST_TYPE_LABELS[type]} has been posted to the community.`,
    });

    setContent(""); setLinkedTrade(""); setLinkedStrategy(""); setLinkedCourse("");
    setType("TEXT");
    onPost();
  };

  return (
    <div className="glass border border-white/10 rounded-xl p-5 mb-5">
      <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Create Post</p>

      {/* Post type selector */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(["TEXT","TRADE_IDEA","SHARED_TRADE","STRATEGY_SHARE","ACADEMY_COMPLETION"] as CommunityPostType[]).map(pt => {
          let disabled = false;
          let disabledReason = "";
          if (pt === "SHARED_TRADE"       && !canShareTrade)    { disabled = true; disabledReason = "No closed trades yet"; }
          if (pt === "STRATEGY_SHARE"     && !canShareStrategy) { disabled = true; disabledReason = "No published strategies"; }
          if (pt === "ACADEMY_COMPLETION" && !canShareAcademy)  { disabled = true; disabledReason = "No completed courses yet"; }

          return (
            <button key={pt}
              onClick={() => !disabled && setType(pt)}
              title={disabledReason || undefined}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                disabled
                  ? "text-white/15 bg-white/2 border-white/5 cursor-not-allowed"
                  : type === pt
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "text-white/40 bg-white/5 border-white/10 hover:border-white/20 hover:text-white/60"
              }`}>
              {POST_TYPE_LABELS[pt]}
              {disabled && " 🔒"}
            </button>
          );
        })}
      </div>

      {/* Disabled explanations */}
      {!canShareTrade && (
        <p className="text-white/20 text-xs mb-2 italic">
          💡 You need a closed journal trade before sharing verified trade results.
        </p>
      )}
      {!canShareStrategy && (
        <p className="text-white/20 text-xs mb-2 italic">
          💡 You need to publish a strategy in the Marketplace before sharing it.
        </p>
      )}
      {!canShareAcademy && (
        <p className="text-white/20 text-xs mb-2 italic">
          💡 Complete an Academy course to share your achievement.
        </p>
      )}

      {/* Linked data selectors */}
      {type === "SHARED_TRADE" && canShareTrade && (
        <div className="mb-3">
          <p className="text-white/40 text-xs mb-1">Select trade to share</p>
          <select value={linkedTrade} onChange={e => setLinkedTrade(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
            <option value="">Choose a closed trade...</option>
            {closedTrades.slice(0, 20).map(t => (
              <option key={t.id} value={t.id} className="bg-[#0a0a0f]">
                {t.side} {t.displayName} @ ${t.entryPrice.toFixed(4)} → {formatPnl(t.netPnl)}
              </option>
            ))}
          </select>
          {linkedTrade && (() => {
            const t = closedTrades.find(x => x.id === linkedTrade);
            return t ? (
              <div className="mt-2 p-2 bg-white/3 border border-white/5 rounded-lg flex items-center gap-3 text-xs">
                <span className={t.side === "BUY" ? "text-green-400" : "text-red-400"}>{t.side}</span>
                <span className="text-white/60">{t.displayName}</span>
                <span className={`font-bold ml-auto ${t.netPnl >= 0 ? "text-green-400" : "text-red-400"}`}>{formatPnl(t.netPnl)}</span>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {type === "STRATEGY_SHARE" && canShareStrategy && (
        <div className="mb-3">
          <p className="text-white/40 text-xs mb-1">Select strategy to share</p>
          <select value={linkedStrategy} onChange={e => setLinkedStrategy(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
            <option value="">Choose a strategy...</option>
            {publishedStrategies.map(s => (
              <option key={s.id} value={s.id} className="bg-[#0a0a0f]">{s.title}</option>
            ))}
          </select>
        </div>
      )}

      {type === "ACADEMY_COMPLETION" && canShareAcademy && (
        <div className="mb-3">
          <p className="text-white/40 text-xs mb-1">Select completed course</p>
          <select value={linkedCourse} onChange={e => setLinkedCourse(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs">
            <option value="">Choose a course...</option>
            {completedCourses.map(c => (
              <option key={c.id} value={c.id} className="bg-[#0a0a0f]">{c.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={
          type === "TEXT"          ? "Share a trading thought, lesson, or insight..."
          : type === "TRADE_IDEA"  ? "Share your trade idea, analysis, or market view..."
          : type === "SHARED_TRADE"? "Add context to your trade: what was your thesis? What happened?"
          : type === "STRATEGY_SHARE" ? "Tell the community about your strategy approach..."
          : "Share your academy milestone..."
        }
        rows={4}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-white/25 placeholder-white/20 mb-3"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select value={visibility} onChange={e => setVisibility(e.target.value as PostVisibility)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
            <option value="PUBLIC" className="bg-[#0a0a0f]">🌐 Public</option>
            <option value="FOLLOWERS_ONLY" className="bg-[#0a0a0f]">👥 Followers only</option>
            <option value="PRIVATE" className="bg-[#0a0a0f]">🔒 Private</option>
          </select>
          <span className="text-white/20 text-xs">·</span>
          <span className="text-white/30 text-xs">{content.length} chars</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || submitting}
          className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40">
          {submitting ? "Posting..." : "Post"}
        </button>
      </div>

      <p className="text-white/15 text-xs mt-3">
        All content is your own and not financial advice.
      </p>
    </div>
  );
}

// ── Comment section ────────────────────────────────────────────────────────

function CommentSection({ post }: { post: CommunityPost }) {
  const { user } = useAuthStore();
  const { addComment, deleteComment, toggleCommentLike, getComments } = useCommunityStore();
  const [input, setInput]         = useState("");
  const [comments, setComments]   = useState<CommunityComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const res = await getComments(post.id);
    if (res) setComments(res.items);
    setIsLoading(false);
  }, [post.id, getComments]);

  useEffect(() => { refetch(); }, [refetch]);

  const handleAddComment = async () => {
    if (!user || !input.trim()) return;
    const comment = await addComment(post.id, input.trim());
    if (comment) setComments((prev) => [...prev, comment]);
    setInput("");
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleToggleLike = async (commentId: string) => {
    const result = await toggleCommentLike(commentId);
    if (!result) return;
    setComments((prev) =>
      prev.map((c) => (c.id !== commentId ? c : { ...c, isLiked: result.liked, _count: { ...c._count, likes: result.likeCount } }))
    );
  };

  const visibleComments = comments.filter(c => !c.isHiddenByAdmin);

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      {isLoading && <p className="text-white/20 text-xs mb-2">Loading comments...</p>}
      {visibleComments.map(comment => (
        <div key={comment.id} className="flex gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/50 text-xs font-bold shrink-0">
            {comment.author.handle[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="glass border border-white/5 rounded-xl px-3 py-2 flex-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-xs font-semibold">{comment.author.handle}</span>
                <span className="text-white/20 text-xs">{timeAgo(comment.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleToggleLike(comment.id)}
                  className={`text-xs transition ${comment.isLiked ? "text-red-400" : "text-white/20 hover:text-red-400"}`}>
                  ♥ {comment._count.likes > 0 ? comment._count.likes : ""}
                </button>
                {user && comment.authorId === user.id && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-white/20 hover:text-red-400 text-xs transition">🗑</button>
                )}
                <ReportButton
                  reportedItemType="comment"
                  reportedItemId={comment.id}
                  reportedItemTitle={comment.content.slice(0, 60)}
                  reportedUserId={comment.authorId}
                  sourceFeature="Community Comments"
                  compact
                />
              </div>
            </div>
            <p className="text-white/70 text-xs leading-relaxed">{comment.content}</p>
          </div>
        </div>
      ))}

      {user && (
        <div className="flex gap-2 mt-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAddComment()}
            placeholder="Write a comment..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-white/25 placeholder-white/20"
          />
          <button
            onClick={handleAddComment}
            disabled={!input.trim()}
            className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-green-500/30 transition">
            Post
          </button>
        </div>
      )}
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────

function PostCard({ post }: { post: CommunityPost }) {
  const { user } = useAuthStore();
  const { toggleLike, toggleBookmark, deletePost } = useCommunityStore();
  const [showComments, setShowComments] = useState(false);

  const userId  = user?.id ?? "";
  const isLiked = post.isLiked;
  const isSaved = post.isBookmarked;
  const isOwn   = post.authorId === userId;

  return (
    <div className="glass border border-white/5 rounded-xl p-5 hover:border-white/10 transition">
      {/* Post header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-sm font-bold shrink-0">
            {post.author.handle[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-sm">{post.author.handle}</span>
              <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                {POST_TYPE_LABELS[post.type]}
              </span>
              <span className={`text-xs ${
                post.visibility === "PUBLIC" ? "text-white/20"
                : post.visibility === "FOLLOWERS_ONLY" ? "text-amber-400/40"
                : "text-red-400/40"
              }`}>
                {post.visibility === "PUBLIC" ? "🌐" : post.visibility === "FOLLOWERS_ONLY" ? "👥" : "🔒"}
              </span>
            </div>
            <p className="text-white/30 text-xs mt-0.5">{timeAgo(post.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isOwn && (
            <button
              onClick={() => deletePost(post.id)}
              className="text-white/20 hover:text-red-400 text-xs transition px-2 py-1 rounded-lg">
              🗑
            </button>
          )}
          {!isOwn && (
            <ReportButton
              reportedItemType="post"
              reportedItemId={post.id}
              reportedItemTitle={`${post.author.handle}: ${post.content.slice(0, 60)}`}
              reportedUserId={post.authorId}
              sourceFeature="Community Feed"
              compact
            />
          )}
        </div>
      </div>

      {/* Trade snapshot */}
      {post.tradeSnapshot && (
        <div className="glass border border-white/5 rounded-xl p-3 mb-3 flex items-center gap-4 flex-wrap">
          <span className={`font-bold text-sm ${post.tradeSnapshot.side === "BUY" ? "text-green-400" : "text-red-400"}`}>
            {post.tradeSnapshot.side}
          </span>
          <span className="text-white font-semibold">{post.tradeSnapshot.displayName}</span>
          <span className="text-white/40 text-xs">@ ${post.tradeSnapshot.entryPrice.toFixed(4)}</span>
          <span className={`font-bold ml-auto ${post.tradeSnapshot.netPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatPnl(post.tradeSnapshot.netPnl)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            post.tradeSnapshot.closeReason === "STOP_LOSS"   ? "text-red-400    bg-red-500/10"
            : post.tradeSnapshot.closeReason === "TAKE_PROFIT" ? "text-green-400  bg-green-500/10"
            : "text-white/30 bg-white/5"
          }`}>
            {post.tradeSnapshot.closeReason === "STOP_LOSS"  ? "⛔ SL"
             : post.tradeSnapshot.closeReason === "TAKE_PROFIT" ? "✅ TP"
             : "Manual"}
          </span>
          <span className="text-white/20 text-xs">
            ⚠ Paper trade · Not verified · Not financial advice
          </span>
        </div>
      )}

      {/* Strategy share */}
      {post.type === "STRATEGY_SHARE" && post.linkedStrategyTitle && (
        <div className="glass border border-indigo-500/20 bg-indigo-500/3 rounded-xl p-3 mb-3">
          <p className="text-indigo-400/70 text-xs font-semibold">📋 Strategy: {post.linkedStrategyTitle}</p>
          <p className="text-white/20 text-xs mt-0.5">Educational content · Not verified performance</p>
        </div>
      )}

      {/* Academy share */}
      {post.type === "ACADEMY_COMPLETION" && post.linkedCourseTitle && (
        <div className="glass border border-amber-500/20 bg-amber-500/3 rounded-xl p-3 mb-3">
          <p className="text-amber-400/70 text-xs font-semibold">🎓 Completed: {post.linkedCourseTitle}</p>
          <p className="text-white/20 text-xs mt-0.5">Course completed · Certificates coming soon</p>
        </div>
      )}

      {/* Post content */}
      <p className="text-white/80 text-sm leading-relaxed mb-4">{post.content}</p>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-white/5 pt-3 flex-wrap">
        <button onClick={() => toggleLike(post.id)}
          className={`flex items-center gap-1.5 text-xs transition ${isLiked ? "text-red-400" : "text-white/40 hover:text-red-400"}`}>
          {isLiked ? "❤️" : "🤍"} {post._count.likes > 0 ? post._count.likes : "Like"}
        </button>
        <button onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition">
          💬 {post._count.comments > 0 ? post._count.comments : "Comment"}
        </button>
        <button onClick={() => toggleBookmark(post.id)}
          className={`flex items-center gap-1.5 text-xs transition ${isSaved ? "text-amber-400" : "text-white/40 hover:text-amber-400"}`}>
          {isSaved ? "🔖 Saved" : "📌 Save"}
        </button>
      </div>

      {/* Comments */}
      {showComments && <CommentSection post={post} />}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const { user }            = useAuthStore();
  const { posts, feedType, setFeedType, isLoading, isInitialized, error } = useCommunityStore();
  const router               = useRouter();

  const [activeTab,   setActiveTab]   = useState<CommunityTab>("feed");
  const [filterType,  setFilterType]  = useState<CommunityPostType | "all">("all");
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  // The store holds one active feed at a time — switch it when the tab changes.
  useEffect(() => {
    if (activeTab === "feed"  && feedType !== "global") setFeedType("global");
    if (activeTab === "saved" && feedType !== "saved")  setFeedType("saved");
  }, [activeTab, feedType, setFeedType]);

  const feedPosts = useMemo(
    () => (feedType !== "global" ? [] : filterType === "all" ? posts : posts.filter(p => p.type === filterType)),
    [posts, feedType, filterType]
  );

  const savedPosts = feedType === "saved" ? posts : [];

  if (!user) return null;

  if (!isInitialized || isLoading) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/30 text-sm animate-pulse">Loading community...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => useCommunityStore.getState().init()}
              className="text-white/40 text-xs border border-white/10 px-3 py-1 rounded hover:text-white/70 hover:border-white/20 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const TABS: { key: CommunityTab; label: string; count?: number }[] = [
    { key: "feed",     label: `🌐 Feed`,    count: feedType === "global" ? posts.length : undefined },
    { key: "saved",    label: `🔖 Saved`,   count: feedType === "saved"  ? posts.length : undefined },
    { key: "groups",   label: "👥 Groups"   },
    { key: "stories",  label: "✨ Stories"  },
    { key: "messages", label: "✉️ Messages" },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto py-6 px-4">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Community</h1>
                <p className="text-white/30 text-xs mt-0.5">
                  Global feed · Live via TCC API
                </p>
              </div>
              <button
                onClick={() => setShowComposer(!showComposer)}
                className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm font-semibold transition">
                {showComposer ? "Cancel" : "+ Post"}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 bg-white/5 rounded-lg p-1 mb-5 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                    activeTab === tab.key ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/60"
                  }`}>
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1 text-white/30">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>

            {/* ── FEED ──────────────────────────────────────────────────── */}
            {activeTab === "feed" && (
              <>
                {/* Composer */}
                {showComposer && (
                  <PostComposer onPost={() => setShowComposer(false)} />
                )}

                {/* Filter by type */}
                <div className="flex gap-1.5 flex-wrap mb-4">
                  {(["all","TEXT","TRADE_IDEA","SHARED_TRADE","STRATEGY_SHARE","ACADEMY_COMPLETION"] as const).map(ft => (
                    <button key={ft}
                      onClick={() => setFilterType(ft)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${
                        filterType === ft
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "text-white/30 border-white/10 hover:border-white/20 bg-white/3"
                      }`}>
                      {ft === "all" ? "All" : POST_TYPE_LABELS[ft]}
                    </button>
                  ))}
                </div>

                {feedPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <p className="text-4xl">🌐</p>
                    <p className="text-white/30 text-sm">No community posts yet.</p>
                    <p className="text-white/15 text-xs text-center max-w-xs leading-relaxed">
                      Share your first trading thought, strategy idea, or journal lesson.
                      {!showComposer && (
                        <>
                          {" "}
                          <button onClick={() => setShowComposer(true)} className="text-green-400/60 hover:text-green-400 underline transition">
                            Create a post →
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {feedPosts.map(post => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── SAVED ─────────────────────────────────────────────────── */}
            {activeTab === "saved" && (
              <>
                {savedPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <p className="text-4xl">🔖</p>
                    <p className="text-white/30 text-sm">No saved posts yet.</p>
                    <p className="text-white/15 text-xs">Click 📌 on any post to save it here.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {savedPosts.map(post => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── GROUPS (stub) ─────────────────────────────────────────── */}
            {activeTab === "groups" && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <p className="text-4xl">👥</p>
                <p className="text-white/40 text-sm font-semibold">Groups</p>
                <p className="text-white/20 text-xs text-center max-w-xs leading-relaxed">
                  Trading groups and communities foundation coming soon.
                  Phase Alpha will include public and private groups, group feeds, and group challenges.
                </p>
              </div>
            )}

            {/* ── STORIES (stub) ────────────────────────────────────────── */}
            {activeTab === "stories" && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <p className="text-4xl">✨</p>
                <p className="text-white/40 text-sm font-semibold">Stories & Reels</p>
                <p className="text-white/20 text-xs text-center max-w-xs leading-relaxed">
                  Stories and short-form trading content coming soon.
                  No fake stories or fake reels will be shown here.
                </p>
              </div>
            )}

            {/* ── MESSAGES (stub) ───────────────────────────────────────── */}
            {activeTab === "messages" && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <p className="text-4xl">✉️</p>
                <p className="text-white/40 text-sm font-semibold">Direct Messages</p>
                <p className="text-white/20 text-xs text-center max-w-xs leading-relaxed">
                  Direct messaging coming soon. Requires backend + user accounts.
                  Phase Alpha will enable real-time messaging between traders.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
