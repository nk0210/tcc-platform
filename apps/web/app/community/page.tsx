"use client";
import { useState } from "react";
import { useCommunityStore, PostType } from "@/store/communityStore";
import { useAuthStore } from "@/store/authStore";
import { useJournalStore } from "@/store/journalStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

const postTypeColors: Record<PostType, string> = {
  trade: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  idea: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  lesson: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  win: "text-green-400 bg-green-500/10 border-green-500/20",
  loss: "text-red-400 bg-red-500/10 border-red-500/20",
};

const skillBadgeColors: Record<string, string> = {
  ROOKIE: "text-white/40 bg-white/5",
  LEARNER: "text-blue-400 bg-blue-500/10",
  ANALYST: "text-purple-400 bg-purple-500/10",
  TRADER: "text-amber-400 bg-amber-500/10",
  PRO: "text-green-400 bg-green-500/10",
  MENTOR: "text-orange-400 bg-orange-500/10",
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function CommunityPage() {
  const { posts, likePost, savePost, addPost, addComment } = useCommunityStore();
  const { user } = useAuthStore();
  const { entries } = useJournalStore();
  const [activeTab, setActiveTab] = useState<"feed" | "saved">("feed");
  const [showPostForm, setShowPostForm] = useState(false);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const [form, setForm] = useState({
    postType: "idea" as PostType,
    content: "",
    symbol: "",
    direction: "" as "BUY" | "SELL" | "",
    strategy: "",
    linkedTradeId: "",
  });

  const handlePost = () => {
    if (!form.content.trim()) return;
    const linkedTrade = entries.find(e => e.id === form.linkedTradeId);
    addPost({
      userId: user?.id || "guest",
      handle: user?.handle || "guest",
      skillLevel: user?.skillLevel || "ROOKIE",
      postType: form.postType,
      content: form.content,
      symbol: linkedTrade?.symbol || form.symbol || undefined,
      direction: linkedTrade?.direction || (form.direction as "BUY" | "SELL") || undefined,
      entryPrice: linkedTrade?.entryPrice,
      exitPrice: linkedTrade?.exitPrice,
      pnl: linkedTrade?.pnl,
      pnlPct: linkedTrade?.pnl && linkedTrade?.entryPrice
        ? parseFloat(((linkedTrade.pnl / (linkedTrade.entryPrice * linkedTrade.lots)) * 100).toFixed(2))
        : undefined,
      strategy: linkedTrade?.strategy || form.strategy || undefined,
      verified: !!linkedTrade,
    });
    setForm({ postType: "idea", content: "", symbol: "", direction: "", strategy: "", linkedTradeId: "" });
    setShowPostForm(false);
  };

  const handleComment = (postId: string) => {
    if (!commentText.trim()) return;
    addComment(postId, { handle: user?.handle || "guest", content: commentText });
    setCommentText("");
    setCommentingOn(null);
  };

  const displayPosts = activeTab === "saved" ? posts.filter(p => p.saved) : posts;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto py-6 px-4">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Community</h1>
                <p className="text-white/40 text-sm mt-1">Verified trades, ideas and lessons from traders worldwide</p>
              </div>
              <button onClick={() => setShowPostForm(!showPostForm)}
                className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm font-semibold transition">
                + Post
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1">
              {(["feed", "saved"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-md text-xs font-semibold capitalize transition ${activeTab === tab ? "bg-green-500/20 text-green-400" : "text-white/40"}`}>
                  {tab === "saved" ? "💾 Saved" : "🌐 Feed"}
                </button>
              ))}
            </div>

            {/* Post Form */}
            {showPostForm && (
              <div className="glass border border-white/10 rounded-xl p-5 mb-6">
                <p className="text-white/60 text-sm font-semibold mb-4">Create a Post</p>

                <div className="flex gap-2 mb-3 flex-wrap">
                  {(["trade", "idea", "lesson", "win", "loss"] as PostType[]).map(type => (
                    <button key={type} onClick={() => setForm({ ...form, postType: type })}
                      className={`text-xs px-3 py-1 rounded-full border capitalize transition ${form.postType === type ? postTypeColors[type] : "text-white/30 border-white/10"}`}>
                      {type}
                    </button>
                  ))}
                </div>

                {entries.filter(e => e.pnl !== undefined).length > 0 && (
                  <div className="mb-3">
                    <p className="text-white/40 text-xs mb-1">Link a verified trade (optional)</p>
                    <select value={form.linkedTradeId}
                      onChange={(e) => setForm({ ...form, linkedTradeId: e.target.value })}
                      className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-xs w-full">
                      <option value="">No trade linked</option>
                      {entries.filter(e => e.pnl !== undefined).map(e => (
                        <option key={e.id} value={e.id} className="bg-[#0a0a0f]">
                          {e.direction} {e.symbol} @ ${e.entryPrice.toFixed(2)} — {e.pnl && e.pnl >= 0 ? "+" : ""}${e.pnl?.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <textarea value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Share your trade idea, lesson, or market insight..."
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none h-24 w-full mb-3" />

                <div className="flex gap-3">
                  <button onClick={handlePost}
                    className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-green-500/30 transition">
                    Post
                  </button>
                  <button onClick={() => setShowPostForm(false)}
                    className="bg-white/5 text-white/40 px-4 py-2 rounded-lg text-xs font-semibold transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Posts */}
            {displayPosts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-white/20">No posts yet</p>
              </div>
            ) : (
              displayPosts.map(post => (
                <div key={post.id} className="glass border border-white/5 rounded-xl p-5 mb-4">

                  {/* Post header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 font-bold text-sm">
                        {post.handle[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-semibold">{post.handle}</span>
                          {post.verified && <span className="text-green-400 text-xs">✓ verified</span>}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${skillBadgeColors[post.skillLevel] || skillBadgeColors.ROOKIE}`}>
                            {post.skillLevel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${postTypeColors[post.postType]}`}>
                            {post.postType}
                          </span>
                          <span className="text-white/30 text-xs">{timeAgo(post.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trade card */}
                  {post.symbol && (
                    <div className="glass border border-white/5 rounded-lg p-3 mb-3 flex items-center gap-4">
                      <span className={`text-sm font-bold ${post.direction === "BUY" ? "text-green-400" : "text-red-400"}`}>
                        {post.direction}
                      </span>
                      <span className="text-white font-semibold">{post.symbol}</span>
                      {post.entryPrice && <span className="text-white/40 text-xs">@ ${post.entryPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>}
                      {post.pnl !== undefined && (
                        <span className={`text-sm font-bold ml-auto ${post.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {post.pnl >= 0 ? "+" : ""}${post.pnl.toFixed(2)}
                          {post.pnlPct && ` (${post.pnlPct >= 0 ? "+" : ""}${post.pnlPct}%)`}
                        </span>
                      )}
                      {post.rr && <span className="text-white/40 text-xs">RR: {post.rr}x</span>}
                      {post.strategy && (
                        <span className="text-xs bg-white/5 text-white/40 px-2 py-0.5 rounded-full">{post.strategy}</span>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <p className="text-white/80 text-sm leading-relaxed mb-4">{post.content}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-4 border-t border-white/5 pt-3">
                    <button onClick={() => likePost(post.id)}
                      className={`flex items-center gap-1.5 text-xs transition ${post.liked ? "text-red-400" : "text-white/40 hover:text-red-400"}`}>
                      {post.liked ? "❤️" : "🤍"} {post.likes}
                    </button>
                    <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition">
                      💬 {post.comments.length}
                    </button>
                    <button onClick={() => savePost(post.id)}
                      className={`flex items-center gap-1.5 text-xs transition ${post.saved ? "text-amber-400" : "text-white/40 hover:text-amber-400"}`}>
                      {post.saved ? "🔖" : "📌"} {post.saved ? "Saved" : "Save"}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition ml-auto">
                      ↗ Share
                    </button>
                  </div>

                  {/* Comments */}
                  {expandedPost === post.id && (
                    <div className="mt-4 border-t border-white/5 pt-4">
                      {post.comments.map(comment => (
                        <div key={comment.id} className="flex gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-bold shrink-0">
                            {comment.handle[0].toUpperCase()}
                          </div>
                          <div className="glass border border-white/5 rounded-lg px-3 py-2 flex-1">
                            <p className="text-white/60 text-xs font-semibold mb-0.5">{comment.handle}</p>
                            <p className="text-white/70 text-xs">{comment.content}</p>
                          </div>
                        </div>
                      ))}

                      {commentingOn === post.id ? (
                        <div className="flex gap-2 mt-2">
                          <input value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleComment(post.id)}
                            placeholder="Write a comment..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs" />
                          <button onClick={() => handleComment(post.id)}
                            className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-2 rounded-lg text-xs font-semibold">
                            Post
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setCommentingOn(post.id)}
                          className="text-white/30 text-xs hover:text-white/60 transition mt-2">
                          + Add a comment
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}