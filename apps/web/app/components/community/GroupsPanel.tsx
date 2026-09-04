"use client";
/**
 * TCC Social — Groups tab: discover public groups, see your own, create one.
 * Group detail (feed, members, join/leave, settings) lives at
 * /community/groups/[slug].
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGroupStore, type CommunityGroup, type GroupVisibility } from "@/store/groupStore";

function GroupCard({ group }: { group: CommunityGroup }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/community/groups/${group.slug}`)}
      className="glass rounded-xl p-4 text-left hover:border-border-strong transition w-full"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-fg font-semibold text-sm">{group.name}</p>
        {group.visibility === "PRIVATE" && <span className="badge badge-neutral !text-[10px] shrink-0">🔒 Private</span>}
      </div>
      <p className="text-fg-dim text-xs leading-relaxed line-clamp-2 mb-2">{group.description || "No description yet."}</p>
      <div className="flex items-center gap-3 text-fg-dim text-xs">
        <span>{group._count.members} member{group._count.members !== 1 ? "s" : ""}</span>
        <span>{group._count.posts} post{group._count.posts !== 1 ? "s" : ""}</span>
        {group.myRole && <span className="badge badge-accent !text-[10px]">{group.myRole === "OWNER" ? "Owner" : group.myRole === "ADMIN" ? "Admin" : "Member"}</span>}
      </div>
    </button>
  );
}

function CreateGroupForm({ onDone, onCancel }: { onDone: (group: CommunityGroup) => void; onCancel: () => void }) {
  const { createGroup } = useGroupStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<GroupVisibility>("PUBLIC");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const group = await createGroup({ name: name.trim(), description: description.trim(), visibility });
    setBusy(false);
    if (group) onDone(group);
  };

  return (
    <div className="glass rounded-xl p-4 mb-4">
      <p className="text-fg font-semibold text-sm mb-3">Create a group</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name"
        maxLength={80}
        className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm mb-2 focus:outline-none focus:border-accent placeholder-fg-dim"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What's this group about? (optional)"
        maxLength={500}
        rows={2}
        className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm mb-2 resize-none focus:outline-none focus:border-accent placeholder-fg-dim"
      />
      <div className="flex items-center gap-1 bg-elevated rounded-lg p-1 mb-3 w-fit">
        {(["PUBLIC", "PRIVATE"] as GroupVisibility[]).map((v) => (
          <button
            key={v}
            onClick={() => setVisibility(v)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${visibility === v ? "bg-accent text-white" : "text-fg-dim hover:text-fg-muted"}`}
          >
            {v === "PUBLIC" ? "🌎 Public" : "🔒 Private"}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="btn btn-ghost text-xs !px-3 !py-1.5">Cancel</button>
        <button onClick={handleCreate} disabled={busy || !name.trim()} className="btn btn-primary text-xs !px-4 !py-1.5 disabled:opacity-50">
          {busy ? "Creating…" : "Create group"}
        </button>
      </div>
    </div>
  );
}

export default function GroupsPanel() {
  const { discoverGroups, getMyGroups } = useGroupStore();
  const router = useRouter();
  const [tab, setTab] = useState<"discover" | "mine">("discover");
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = tab === "discover" ? await discoverGroups() : await getMyGroups();
    setGroups(result?.items ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1 bg-elevated rounded-lg p-1 w-fit">
          <button onClick={() => setTab("discover")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${tab === "discover" ? "bg-accent text-white" : "text-fg-dim hover:text-fg-muted"}`}>Discover</button>
          <button onClick={() => setTab("mine")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${tab === "mine" ? "bg-accent text-white" : "text-fg-dim hover:text-fg-muted"}`}>My Groups</button>
        </div>
        <button onClick={() => setShowCreate((s) => !s)} className="btn btn-primary text-xs !px-3 !py-1.5">
          {showCreate ? "Cancel" : "+ Create"}
        </button>
      </div>

      {showCreate && (
        <CreateGroupForm
          onCancel={() => setShowCreate(false)}
          onDone={(group) => { setShowCreate(false); router.push(`/community/groups/${group.slug}`); }}
        />
      )}

      {loading ? (
        <p className="text-fg-dim text-xs animate-pulse py-6 text-center">Loading groups…</p>
      ) : groups.length === 0 ? (
        <div className="glass rounded-xl flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
          <p className="text-4xl">👨‍👩‍👧</p>
          <p className="text-fg-muted text-sm font-semibold">{tab === "discover" ? "No public groups yet" : "You haven't joined any groups"}</p>
          <p className="text-fg-dim text-xs max-w-xs leading-relaxed">
            {tab === "discover" ? "Be the first to start one." : "Discover public groups or create your own."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map((g) => <GroupCard key={g.id} group={g} />)}
        </div>
      )}
    </div>
  );
}
