"use client";
/**
 * TCC Social — Blocked & Muted management. The only place a block/mute
 * started from a post's "…" menu can be reversed.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCommunityStore, type CommunityUserSummary } from "@/store/communityStore";

function UserRow({ user, actionLabel, onAction }: { user: CommunityUserSummary; actionLabel: string; onAction: () => void }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <button onClick={() => router.push(`/profile?handle=${user.handle}`)} className="w-9 h-9 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-hover text-xs font-bold shrink-0">
        {user.handle[0]?.toUpperCase()}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-fg text-sm font-semibold truncate">{user.displayName}</p>
        <p className="text-fg-dim text-xs truncate">@{user.handle}</p>
      </div>
      <button
        onClick={() => { setDone(true); onAction(); }}
        disabled={done}
        className="btn btn-secondary text-xs !px-3 !py-1.5 shrink-0 disabled:opacity-40"
      >
        {done ? "Done" : actionLabel}
      </button>
    </div>
  );
}

export default function PrivacyPanel() {
  const { getBlockedUsers, unblockUser, getMutedUsers, unmuteUser } = useCommunityStore();
  const [tab, setTab] = useState<"blocked" | "muted">("blocked");
  const [blocked, setBlocked] = useState<CommunityUserSummary[]>([]);
  const [muted, setMuted]     = useState<CommunityUserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getBlockedUsers(), getMutedUsers()]).then(([b, m]) => {
      setBlocked(b?.items ?? []);
      setMuted(m?.items ?? []);
      setLoading(false);
    });
  }, [getBlockedUsers, getMutedUsers]);

  const list = tab === "blocked" ? blocked : muted;

  return (
    <div className="glass rounded-xl p-4">
      <h2 className="text-lg font-bold text-fg mb-0.5">Blocked & Muted</h2>
      <p className="text-fg-dim text-xs mb-4">Manage who you've blocked or muted.</p>

      <div className="flex items-center gap-1 bg-elevated rounded-lg p-1 mb-3 w-fit">
        <button
          onClick={() => setTab("blocked")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${tab === "blocked" ? "bg-accent text-white" : "text-fg-dim hover:text-fg-muted"}`}
        >
          🚫 Blocked ({blocked.length})
        </button>
        <button
          onClick={() => setTab("muted")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${tab === "muted" ? "bg-accent text-white" : "text-fg-dim hover:text-fg-muted"}`}
        >
          🔕 Muted ({muted.length})
        </button>
      </div>

      {loading ? (
        <p className="text-fg-dim text-xs animate-pulse py-4">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-fg-dim text-xs py-6 text-center">
          {tab === "blocked" ? "You haven't blocked anyone." : "You haven't muted anyone."}
        </p>
      ) : (
        <div className="flex flex-col">
          {list.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              actionLabel={tab === "blocked" ? "Unblock" : "Unmute"}
              onAction={async () => {
                if (tab === "blocked") { await unblockUser(u.handle); setBlocked((prev) => prev.filter((x) => x.id !== u.id)); }
                else                   { await unmuteUser(u.handle);  setMuted((prev) => prev.filter((x) => x.id !== u.id)); }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
