"use client";
/**
 * TCC Social — full comment experience: add, reply (one level of nesting,
 * matching CommunityComment.parentId's own shape), like, edit own, delete
 * own, report. All backed by real endpoints already on the API — nothing
 * here is a second comment architecture.
 */
import { useState, useCallback, useEffect } from "react";
import { useCommunityStore, type CommunityPost, type CommunityComment } from "@/store/communityStore";
import { useAuthStore } from "@/store/authStore";
import ReportButton from "@/components/ReportButton";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function CommentAvatar({ handle }: { handle: string }) {
  return (
    <div className="w-7 h-7 rounded-full bg-elevated border border-border flex items-center justify-center text-fg-muted text-xs font-bold shrink-0">
      {handle[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function ReplyComposer({ onSubmit, onCancel }: { onSubmit: (content: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2 mt-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) { onSubmit(value.trim()); setValue(""); }
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Write a reply…"
        className="flex-1 bg-elevated border border-border rounded-lg px-3 py-1.5 text-fg text-xs focus:outline-none focus:border-accent placeholder-fg-dim"
      />
      <button
        onClick={() => { if (value.trim()) { onSubmit(value.trim()); setValue(""); } }}
        disabled={!value.trim()}
        className="btn btn-primary text-xs !px-3 !py-1.5 disabled:opacity-40"
      >
        Reply
      </button>
    </div>
  );
}

function CommentItem({
  comment, isReply = false, onDeleted, onReplyPosted,
}: {
  comment: CommunityComment;
  isReply?: boolean;
  onDeleted: (id: string) => void;
  onReplyPosted: (parentId: string, reply: CommunityComment) => void;
}) {
  const { user } = useAuthStore();
  const { toggleCommentLike, deleteComment, editComment, addReply, getReplies } = useCommunityStore();

  const [liked, setLiked]         = useState(comment.isLiked);
  const [likeCount, setLikeCount] = useState(comment._count.likes);
  const [replying, setReplying]   = useState(false);
  const [editing, setEditing]     = useState(false);
  const [editValue, setEditValue] = useState(comment.content);
  const [content, setContent]     = useState(comment.content);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies]     = useState<CommunityComment[]>([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);

  const isOwn = user?.id === comment.authorId;

  const handleToggleLike = async () => {
    const result = await toggleCommentLike(comment.id);
    if (result) { setLiked(result.liked); setLikeCount(result.likeCount); }
  };

  const handleDelete = async () => {
    await deleteComment(comment.id);
    onDeleted(comment.id);
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim()) return;
    const updated = await editComment(comment.id, editValue.trim());
    if (updated) { setContent(updated.content); setEditing(false); }
  };

  const handleReply = async (text: string) => {
    const reply = await addReply(comment.id, text);
    if (reply) {
      setReplies((prev) => [...prev, reply]);
      setShowReplies(true);
      setRepliesLoaded(true);
      onReplyPosted(comment.id, reply);
    }
    setReplying(false);
  };

  const loadReplies = useCallback(async () => {
    if (repliesLoaded) { setShowReplies((s) => !s); return; }
    const res = await getReplies(comment.id);
    setReplies(res?.items ?? []);
    setRepliesLoaded(true);
    setShowReplies(true);
  }, [comment.id, getReplies, repliesLoaded]);

  return (
    <div className={`flex gap-2 ${isReply ? "mt-2" : "mb-3"}`}>
      <CommentAvatar handle={comment.author.handle} />
      <div className="flex-1 min-w-0">
        <div className="bg-elevated border border-border rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-fg text-xs font-semibold">{comment.author.displayName}</span>
            <span className="text-fg-dim text-xs">@{comment.author.handle}</span>
          </div>
          {editing ? (
            <div className="flex flex-col gap-1.5 mt-1">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={2}
                autoFocus
                className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-fg text-xs resize-none focus:outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="text-accent-hover text-xs font-semibold">Save</button>
                <button onClick={() => { setEditing(false); setEditValue(content); }} className="text-fg-dim text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-fg-muted text-xs leading-relaxed">{content}</p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 px-1">
          <button
            onClick={handleToggleLike}
            className={`text-xs font-medium transition ${liked ? "text-danger" : "text-fg-dim hover:text-danger"}`}
          >
            {liked ? "❤️" : "♡"} {likeCount > 0 ? likeCount : ""}
          </button>
          {!isReply && (
            <button onClick={() => setReplying((r) => !r)} className="text-fg-dim hover:text-fg-muted text-xs font-medium transition">
              Reply
            </button>
          )}
          <span className="text-fg-dim text-xs">{timeAgo(comment.createdAt)}</span>
          {isOwn ? (
            <>
              <button onClick={() => setEditing(true)} className="text-fg-dim hover:text-fg-muted text-xs transition">Edit</button>
              <button onClick={handleDelete} className="text-fg-dim hover:text-danger text-xs transition">Delete</button>
            </>
          ) : (
            <ReportButton
              reportedItemType="comment"
              reportedItemId={comment.id}
              reportedItemTitle={comment.content.slice(0, 60)}
              reportedUserId={comment.authorId}
              sourceFeature="Community Comments"
              compact
            />
          )}
          {!isReply && comment._count.replies > 0 && (
            <button onClick={loadReplies} className="text-accent-hover text-xs font-medium transition">
              {showReplies ? "Hide" : `View ${comment._count.replies}`} {comment._count.replies === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>

        {replying && <ReplyComposer onSubmit={handleReply} onCancel={() => setReplying(false)} />}

        {showReplies && replies.length > 0 && (
          <div className="mt-1 pl-2 border-l border-border">
            {replies.filter((r) => !r.isHiddenByAdmin).map((r) => (
              <CommentItem key={r.id} comment={r} isReply onDeleted={() => setReplies((p) => p.filter((x) => x.id !== r.id))} onReplyPosted={() => {}} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentSection({ post }: { post: CommunityPost }) {
  const { user } = useAuthStore();
  const { addComment, getComments } = useCommunityStore();
  const [input, setInput]         = useState("");
  const [comments, setComments]   = useState<CommunityComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [posting, setPosting]     = useState(false);

  const refetch = useCallback(async () => {
    const res = await getComments(post.id);
    if (res) setComments(res.items);
    setIsLoading(false);
  }, [post.id, getComments]);

  useEffect(() => { refetch(); }, [refetch]);

  const handleAddComment = async () => {
    if (!user || !input.trim()) return;
    setPosting(true);
    const comment = await addComment(post.id, input.trim());
    setPosting(false);
    if (comment) setComments((prev) => [...prev, comment]);
    setInput("");
  };

  const visibleComments = comments.filter((c) => !c.isHiddenByAdmin);

  return (
    <div className="mt-3 border-t border-border pt-3">
      {isLoading && <p className="text-fg-dim text-xs mb-2 animate-pulse">Loading comments…</p>}

      {!isLoading && visibleComments.length === 0 && (
        <p className="text-fg-dim text-xs mb-3">No comments yet — be the first to reply.</p>
      )}

      {visibleComments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onDeleted={(id) => setComments((prev) => prev.filter((c) => c.id !== id))}
          onReplyPosted={() => {}}
        />
      ))}

      {user && (
        <div className="flex gap-2 mt-2">
          <CommentAvatar handle={user.handle} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddComment()}
            placeholder="Write a comment…"
            className="flex-1 bg-elevated border border-border rounded-full px-4 py-1.5 text-fg text-xs focus:outline-none focus:border-accent placeholder-fg-dim"
          />
          <button
            onClick={handleAddComment}
            disabled={!input.trim() || posting}
            className="btn btn-primary text-xs !px-4 !py-1.5 disabled:opacity-40"
          >
            {posting ? "…" : "Post"}
          </button>
        </div>
      )}
    </div>
  );
}
