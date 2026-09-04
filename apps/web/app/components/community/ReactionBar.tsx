"use client";
/**
 * TCC Social — reaction bar + hover picker.
 * Backed by the real PostLike.type column (communityStore.toggleLike) —
 * six real, persisted reaction types, not a client-side decoration.
 */
import { useState, useRef, useEffect } from "react";
import type { ReactionType } from "@/store/communityStore";

export const REACTION_META: Record<ReactionType, { emoji: string; label: string }> = {
  LIKE:        { emoji: "❤️", label: "Like" },
  INSIGHTFUL:  { emoji: "💡", label: "Insightful" },
  BULLISH:     { emoji: "📈", label: "Bullish" },
  BEARISH:     { emoji: "📉", label: "Bearish" },
  CELEBRATE:   { emoji: "🎉", label: "Celebrate" },
  INTERESTING: { emoji: "🤔", label: "Interesting" },
};

const REACTION_ORDER: ReactionType[] = ["LIKE", "INSIGHTFUL", "BULLISH", "BEARISH", "CELEBRATE", "INTERESTING"];

export function ReactionPicker({ onPick, onClose }: { onPick: (type: ReactionType) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="glass absolute bottom-full left-0 mb-2 flex items-center gap-0.5 px-1.5 py-1 rounded-full z-20 animate-in fade-in zoom-in-95 duration-100"
      style={{ boxShadow: "var(--shadow-elevated)" }}
    >
      {REACTION_ORDER.map((type) => (
        <button
          key={type}
          role="menuitem"
          onClick={() => onPick(type)}
          title={REACTION_META[type].label}
          aria-label={REACTION_META[type].label}
          className="text-xl w-9 h-9 flex items-center justify-center rounded-full hover:scale-125 hover:bg-elevated transition-transform duration-100"
        >
          {REACTION_META[type].emoji}
        </button>
      ))}
    </div>
  );
}

export function ReactionButton({
  myReaction,
  onReact,
}: {
  myReaction: ReactionType | null;
  onReact: (type: ReactionType) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const active = myReaction !== null;
  const meta = myReaction ? REACTION_META[myReaction] : REACTION_META.LIKE;

  return (
    <div className="relative">
      {pickerOpen && (
        <ReactionPicker
          onPick={(type) => { onReact(type); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      <button
        onClick={() => onReact(myReaction ?? "LIKE")}
        onMouseEnter={() => setPickerOpen(true)}
        className={`btn btn-ghost gap-1.5 text-xs !px-3 !py-1.5 ${active ? "!text-danger" : ""}`}
      >
        <span className="text-sm leading-none">{active ? meta.emoji : "🤍"}</span>
        <span className="font-medium">{active ? meta.label : "Like"}</span>
      </button>
    </div>
  );
}

/** Compact total + top-reaction-emoji summary shown above the action row,
 *  e.g. "❤️💡 24" — only rendered when there's at least one reaction. */
export function ReactionSummary({ count, reactions }: { count: number; reactions?: Record<ReactionType, number> }) {
  if (count === 0) return null;

  const topTypes = reactions
    ? REACTION_ORDER.filter((t) => reactions[t] > 0).sort((a, b) => reactions[b] - reactions[a]).slice(0, 3)
    : ["LIKE" as ReactionType];

  return (
    <div className="flex items-center gap-1 text-xs text-fg-dim">
      <span className="flex -space-x-1">
        {topTypes.map((t) => (
          <span key={t} className="leading-none">{REACTION_META[t].emoji}</span>
        ))}
      </span>
      <span>{count}</span>
    </div>
  );
}
