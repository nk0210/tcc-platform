"use client";
/**
 * TCC Social — Stories: a horizontal rail of active (<24h) stories grouped
 * by author, a full-screen-ish viewer that cycles through one author's
 * stories and marks them viewed as it goes, and a minimal create form.
 * No upload infra exists in this app (avatarUrl etc. are plain URL strings
 * everywhere) so a story image is a URL, not a file upload.
 */
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useStoryStore, type StoryGroup, type Story } from "@/store/storyStore";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

// ── Create story ─────────────────────────────────────────────────────────

function CreateStoryModal({ onClose }: { onClose: () => void }) {
  const { createStory } = useStoryStore();
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!content.trim() && !imageUrl.trim()) return;
    setBusy(true);
    const story = await createStory(content.trim(), imageUrl.trim() || null);
    setBusy(false);
    if (story) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="text-fg font-semibold text-sm mb-3">New story <span className="text-fg-dim font-normal">· disappears in 24h</span></p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening in the markets?"
          maxLength={500}
          rows={3}
          autoFocus
          className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm resize-none focus:outline-none focus:border-accent placeholder-fg-dim mb-2"
        />
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Image URL (optional)"
          className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm mb-3 focus:outline-none focus:border-accent placeholder-fg-dim"
        />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost text-xs !px-3 !py-1.5">Cancel</button>
          <button onClick={handleCreate} disabled={busy || (!content.trim() && !imageUrl.trim())} className="btn btn-primary text-xs !px-4 !py-1.5 disabled:opacity-50">
            {busy ? "Posting…" : "Share story"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Viewer ───────────────────────────────────────────────────────────────

function StoryViewer({ group, onClose }: { group: StoryGroup; onClose: () => void }) {
  const { user } = useAuthStore();
  const { viewStory, deleteStory } = useStoryStore();
  const [index, setIndex] = useState(0);
  const story: Story | undefined = group.stories[index];
  const isOwn = story?.authorId === user?.id;

  useEffect(() => {
    if (story) viewStory(story.id);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!story) return null;

  const next = () => (index < group.stories.length - 1 ? setIndex(index + 1) : onClose());
  const prev = () => (index > 0 ? setIndex(index - 1) : undefined);

  const handleDelete = async () => {
    if (!confirm("Delete this story?")) return;
    await deleteStory(story.id);
    next();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-md h-[80vh] max-h-[700px] rounded-xl overflow-hidden bg-elevated flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1 p-2">
          {group.stories.map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
              <div className={`h-full bg-white transition-all ${i < index ? "w-full" : i === index ? "w-full" : "w-0"}`} />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 pb-2">
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent-hover text-xs font-bold shrink-0">
            {group.author.handle[0]?.toUpperCase()}
          </div>
          <p className="text-fg text-xs font-semibold">{group.author.displayName}</p>
          <p className="text-fg-dim text-xs">{timeAgo(story.createdAt)}</p>
          {isOwn && (
            <button onClick={handleDelete} className="ml-auto text-danger text-xs hover:underline">Delete</button>
          )}
          <button onClick={onClose} className="text-fg-dim hover:text-fg text-sm px-2">✕</button>
        </div>

        <div className="flex-1 flex items-center justify-center relative px-4 pb-4">
          <button onClick={prev} className="absolute left-0 top-0 bottom-0 w-1/3" aria-label="Previous" />
          <button onClick={next} className="absolute right-0 top-0 bottom-0 w-1/3" aria-label="Next" />
          {story.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.imageUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          )}
          {story.content && (
            <p className={`text-fg text-lg font-medium text-center leading-relaxed px-4 ${story.imageUrl ? "absolute bottom-6 bg-black/50 rounded-lg py-2" : ""}`}>
              {story.content}
            </p>
          )}
        </div>

        {isOwn && <p className="text-fg-dim text-xs text-center pb-2">👁 {story._count.views} view{story._count.views !== 1 ? "s" : ""}</p>}
      </div>
    </div>
  );
}

// ── Rail (used at the top of the feed) ────────────────────────────────────

export function StoryRail() {
  const { groups, loadFeed } = useStoryStore();
  const [viewing, setViewing] = useState<StoryGroup | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 mb-4 -mx-1 px-1">
      <button onClick={() => setCreating(true)} className="flex flex-col items-center gap-1 shrink-0 w-16">
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-border flex items-center justify-center text-fg-dim text-lg hover:border-accent hover:text-accent-hover transition">+</div>
        <span className="text-fg-dim text-[10px]">Add story</span>
      </button>
      {groups.map((g) => (
        <button key={g.author.id} onClick={() => setViewing(g)} className="flex flex-col items-center gap-1 shrink-0 w-16">
          <div className={`w-14 h-14 rounded-full p-0.5 ${g.allViewed ? "bg-border" : "bg-gradient-to-tr from-accent to-warning"}`}>
            <div className="w-full h-full rounded-full bg-elevated flex items-center justify-center text-accent-hover text-sm font-bold">
              {g.author.handle[0]?.toUpperCase()}
            </div>
          </div>
          <span className="text-fg-dim text-[10px] truncate w-full text-center">{g.author.handle}</span>
        </button>
      ))}

      {creating && <CreateStoryModal onClose={() => setCreating(false)} />}
      {viewing && <StoryViewer group={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ── Full panel (used by the "Stories" nav tab) ─────────────────────────────

export default function StoriesPanel() {
  const { groups, loadFeed } = useStoryStore();
  useEffect(() => { loadFeed(); }, [loadFeed]);

  return (
    <div>
      <StoryRail />
      {groups.length === 0 ? (
        <div className="glass rounded-xl flex flex-col items-center justify-center py-16 gap-2 text-center">
          <p className="text-4xl">✨</p>
          <p className="text-fg-muted text-sm font-semibold">No active stories</p>
          <p className="text-fg-dim text-xs max-w-xs leading-relaxed">
            Stories from you and people you follow appear here for 24 hours.
          </p>
        </div>
      ) : (
        <p className="text-fg-dim text-xs text-center py-4">Tap a story above to view it.</p>
      )}
    </div>
  );
}
