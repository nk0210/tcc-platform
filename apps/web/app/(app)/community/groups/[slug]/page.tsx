"use client";
/**
 * TCC Social — group detail. Feed (members' posts, scoped to this group),
 * membership state, and owner/admin management (rename, visibility, kick).
 */
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useGroupStore, type CommunityGroup, type GroupMemberSummary } from "@/store/groupStore";
import type { CommunityPost } from "@/store/communityStore";
import PostCard from "@/components/community/PostCard";

export default function GroupDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    getGroup, joinGroup, leaveGroup, deleteGroup,
    getMembers, kickMember, getGroupFeed, createGroupPost,
  } = useGroupStore();

  const [group, setGroup]       = useState<CommunityGroup | null | undefined>(undefined);
  const [posts, setPosts]       = useState<CommunityPost[]>([]);
  const [members, setMembers]   = useState<GroupMemberSummary[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [busy, setBusy] = useState(false);
  const [postsLoading, setPostsLoading] = useState(true);

  const load = useCallback(async () => {
    const g = await getGroup(params.slug);
    setGroup(g);
    if (g) {
      setPostsLoading(true);
      const feed = await getGroupFeed(g.id);
      setPosts(feed?.items ?? []);
      setPostsLoading(false);
    }
  }, [params.slug, getGroup, getGroupFeed]);

  useEffect(() => { load(); }, [load]);

  const loadMembers = async () => {
    if (!group) return;
    const result = await getMembers(group.id);
    setMembers(result?.items ?? []);
    setShowMembers(true);
  };

  const handleJoin = async () => {
    if (!group) return;
    setBusy(true);
    const ok = await joinGroup(group.id);
    setBusy(false);
    if (ok) load();
  };

  const handleLeave = async () => {
    if (!group) return;
    if (!confirm(`Leave ${group.name}?`)) return;
    setBusy(true);
    const ok = await leaveGroup(group.id);
    setBusy(false);
    if (ok) load();
  };

  const handleDelete = async () => {
    if (!group) return;
    if (!confirm(`Delete ${group.name} permanently? This can't be undone.`)) return;
    const ok = await deleteGroup(group.id);
    if (ok) router.push("/community");
  };

  const handlePost = async () => {
    if (!group || !composerText.trim()) return;
    setBusy(true);
    const post = await createGroupPost(group.id, composerText.trim());
    setBusy(false);
    if (post) { setPosts((p) => [post, ...p]); setComposerText(""); }
  };

  const handleKick = async (userId: string) => {
    if (!group) return;
    await kickMember(group.id, userId);
    setMembers((m) => m.filter((x) => x.id !== userId));
  };

  if (group === undefined) {
    return <div className="flex-1 py-16 text-center text-fg-dim text-sm">Loading group…</div>;
  }
  if (group === null) {
    return (
      <div className="flex-1 py-16 text-center">
        <p className="text-fg-muted text-sm font-semibold mb-2">Group not found</p>
        <button onClick={() => router.push("/community")} className="btn btn-secondary text-xs">← Back to Community</button>
      </div>
    );
  }

  const isMember = !!group.myRole;
  const isAdmin  = group.myRole === "OWNER" || group.myRole === "ADMIN";
  const isOwner  = group.myRole === "OWNER";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto py-6 px-4">
        <button onClick={() => router.push("/community")} className="text-fg-dim hover:text-fg-muted text-xs mb-4">← Back to feed</button>

        <div className="glass rounded-xl p-5 mb-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h1 className="text-xl font-bold text-fg">{group.name}</h1>
              <p className="text-fg-dim text-xs mt-0.5">
                {group.visibility === "PRIVATE" ? "🔒 Private group" : "🌎 Public group"} · {group._count.members} member{group._count.members !== 1 ? "s" : ""} · {group._count.posts} posts
              </p>
            </div>
            {isMember ? (
              isOwner ? (
                <button onClick={handleDelete} className="btn btn-secondary text-xs !px-3 !py-1.5 shrink-0 !text-danger">Delete group</button>
              ) : (
                <button onClick={handleLeave} disabled={busy} className="btn btn-secondary text-xs !px-3 !py-1.5 shrink-0">Leave</button>
              )
            ) : (
              <button onClick={handleJoin} disabled={busy} className="btn btn-primary text-xs !px-4 !py-1.5 shrink-0">Join group</button>
            )}
          </div>
          {group.description && <p className="text-fg-muted text-sm leading-relaxed mb-3">{group.description}</p>}
          <button onClick={loadMembers} className="text-accent-hover text-xs hover:underline">View members</button>
        </div>

        {showMembers && (
          <div className="glass rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-fg font-semibold text-sm">Members</p>
              <button onClick={() => setShowMembers(false)} className="text-fg-dim hover:text-fg-muted text-xs">✕</button>
            </div>
            <div className="flex flex-col divide-y divide-border">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 py-2">
                  <button onClick={() => router.push(`/profile?handle=${m.handle}`)} className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-hover text-xs font-bold shrink-0">
                    {m.handle[0]?.toUpperCase()}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-fg text-xs font-semibold truncate">{m.displayName}</p>
                    <p className="text-fg-dim text-xs truncate">@{m.handle}</p>
                  </div>
                  <span className="badge badge-neutral !text-[10px] shrink-0">{m.role === "OWNER" ? "Owner" : m.role === "ADMIN" ? "Admin" : "Member"}</span>
                  {isAdmin && m.id !== user?.id && m.role !== "OWNER" && (
                    <button onClick={() => handleKick(m.id)} className="text-danger text-xs hover:underline shrink-0">Remove</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isMember && (
          <div className="glass rounded-xl p-4 mb-4">
            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              placeholder={`Post something in ${group.name}…`}
              maxLength={5000}
              rows={2}
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm resize-none focus:outline-none focus:border-accent placeholder-fg-dim mb-2"
            />
            <div className="flex justify-end">
              <button onClick={handlePost} disabled={busy || !composerText.trim()} className="btn btn-primary text-xs !px-4 !py-1.5 disabled:opacity-50">Post</button>
            </div>
          </div>
        )}

        {postsLoading ? (
          <p className="text-fg-dim text-xs animate-pulse py-6 text-center">Loading posts…</p>
        ) : posts.length === 0 ? (
          <div className="glass rounded-xl flex flex-col items-center justify-center py-16 gap-2 text-center">
            <p className="text-4xl">💬</p>
            <p className="text-fg-muted text-sm font-semibold">No posts in this group yet</p>
            {isMember && <p className="text-fg-dim text-xs">Be the first to post.</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
        )}
      </div>
    </div>
  );
}
