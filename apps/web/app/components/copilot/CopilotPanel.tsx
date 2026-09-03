"use client";
/**
 * TCC Copilot Panel — chat + conversation history (Phase 6) + memory (Phase 7).
 *
 * Still intentionally lean: a single chat surface plus two lightweight
 * overlays (history via the clock icon, memory via the brain icon) rather
 * than a redesign of RightPanel itself. Opening an old conversation always
 * refetches it from the backend (copilotStore.openConversation) — a
 * pending action's real state (still confirmable vs. expired) is only ever
 * known server-side, so nothing here assumes stale local state is still
 * accurate. Same principle for memory: MemoryOverlay always reloads from
 * GET /copilot/memories rather than trusting anything cached.
 */
import { useState, useRef, useEffect } from "react";
import { useCopilotStore, type CopilotChatMessage, type CopilotConversationSummary, type PendingActionInfo, type CopilotMemoryItem, type CopilotMemoryType } from "@/store/copilotStore";

function toolLabel(name: string): string {
  return name.replace(/_/g, " ");
}

function toolStatusIcon(status: string): string {
  switch (status) {
    case "EXECUTED": return "✓";
    case "PENDING_CONFIRMATION": return "⏳";
    case "FAILED": return "✗";
    default: return "·"; // REJECTED, or anything unexpected — skipped/no-op, not worth alarming over
  }
}

function ToolStatusLine({ toolCalls }: { toolCalls: NonNullable<CopilotChatMessage["toolCalls"]> }) {
  if (toolCalls.length === 0) return null;
  return (
    <div className="text-white/30 text-xs mt-2 pt-2 border-t border-white/5 flex flex-col gap-0.5">
      {toolCalls.map((t, i) => (
        <span key={i}>
          {toolStatusIcon(t.status)} {toolLabel(t.name)}
        </span>
      ))}
    </div>
  );
}

function PendingActionCard({ messageId, action }: { messageId: string; action: PendingActionInfo }) {
  const { confirmAction, cancelAction } = useCopilotStore();
  const isExpiredLocally = action.status === "pending" && new Date(action.expiresAt).getTime() < Date.now();
  const busy = action.status === "confirming" || action.status === "cancelling";

  if (action.status === "pending" && !isExpiredLocally) {
    return (
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
        <button
          onClick={() => void confirmAction(messageId)}
          disabled={busy}
          className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-green-500/30 transition disabled:opacity-40"
        >
          Confirm
        </button>
        <button
          onClick={() => void cancelAction(messageId)}
          disabled={busy}
          className="bg-white/5 text-white/50 border border-white/10 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-white/10 transition disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (action.status === "confirming" || action.status === "cancelling") {
    return (
      <p className="mt-3 pt-3 border-t border-white/10 text-white/30 text-xs animate-pulse">
        {action.status === "confirming" ? "Confirming…" : "Cancelling…"}
      </p>
    );
  }

  if (action.status === "executed") {
    return <p className="mt-3 pt-3 border-t border-white/10 text-green-400 text-xs">✓ {action.resultMessage ?? "Done."}</p>;
  }
  if (action.status === "cancelled") {
    return <p className="mt-3 pt-3 border-t border-white/10 text-white/30 text-xs">Cancelled — nothing was done.</p>;
  }
  if (action.status === "expired" || isExpiredLocally) {
    return <p className="mt-3 pt-3 border-t border-white/10 text-yellow-400/80 text-xs">This action has expired. Ask again if you still want it done.</p>;
  }
  if (action.status === "unavailable") {
    return <p className="mt-3 pt-3 border-t border-white/10 text-white/30 text-xs">This action is no longer available.</p>;
  }
  // "failed"
  return <p className="mt-3 pt-3 border-t border-white/10 text-red-400 text-xs">✗ {action.resultMessage ?? "That didn't work."}</p>;
}

// ── Conversation history overlay ────────────────────────────────────────

function dateGroupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

/** Groups an already most-recently-updated-first list into date sections,
 *  preserving that order within and across groups — no re-sorting here. */
function groupByDate(conversations: CopilotConversationSummary[]): Array<[string, CopilotConversationSummary[]]> {
  const groups: Array<[string, CopilotConversationSummary[]]> = [];
  for (const c of conversations) {
    const label = dateGroupLabel(c.updatedAt);
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(c);
    else groups.push([label, [c]]);
  }
  return groups;
}

function HistoryOverlay({ onClose }: { onClose: () => void }) {
  const { conversations, conversationsLoading, conversationsError, loadConversations, openConversation, deleteConversation, conversationId } = useCopilotStore();
  // Two-step delete (click once to arm, again to confirm) rather than a
  // native window.confirm() — keeps the delete affordance in-panel and
  // consistent with the rest of this overlay's styling.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  const handleOpen = (id: string) => {
    void openConversation(id);
    onClose();
  };

  const handleDelete = async (id: string) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      setDeleteError(null);
      return;
    }
    setConfirmingId(null);
    const result = await deleteConversation(id);
    if (!result.ok) setDeleteError(result.error ?? "Failed to delete conversation.");
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-black/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <p className="text-white/70 text-xs font-semibold">History</p>
        <button onClick={onClose} className="text-white/40 hover:text-white/70 text-xs px-2 py-1" aria-label="Close history">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {conversationsLoading && <p className="text-white/30 text-xs px-1 py-2 animate-pulse">Loading…</p>}
        {conversationsError && <p className="text-red-400 text-xs px-1 py-2">{conversationsError}</p>}
        {deleteError && <p className="text-red-400 text-xs px-1 py-2">{deleteError}</p>}
        {!conversationsLoading && !conversationsError && conversations.length === 0 && (
          <p className="text-white/30 text-xs px-1 py-2">No conversations yet.</p>
        )}

        {groupByDate(conversations).map(([label, items]) => (
          <div key={label} className="mb-3">
            <p className="text-white/25 text-[10px] uppercase tracking-wide px-1 mb-1">{label}</p>
            <div className="flex flex-col gap-0.5">
              {items.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-lg transition ${
                    c.id === conversationId ? "bg-indigo-500/15" : "hover:bg-white/5"
                  }`}
                >
                  <button
                    onClick={() => handleOpen(c.id)}
                    className={`flex-1 text-left px-2 py-1.5 text-xs truncate ${
                      c.id === conversationId ? "text-indigo-300" : "text-white/60"
                    }`}
                    title={c.title}
                  >
                    {c.title}
                  </button>
                  <button
                    onClick={() => void handleDelete(c.id)}
                    className={`shrink-0 px-2 py-1.5 text-xs transition ${
                      confirmingId === c.id
                        ? "text-red-400 opacity-100"
                        : "text-white/20 opacity-0 group-hover:opacity-100 hover:text-red-400"
                    }`}
                    title={confirmingId === c.id ? "Click again to confirm delete" : "Delete conversation"}
                    aria-label={confirmingId === c.id ? "Confirm delete conversation" : "Delete conversation"}
                  >
                    {confirmingId === c.id ? "Confirm?" : "✕"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Memory overlay (Phase 7) ─────────────────────────────────────────────

const MEMORY_TYPE_LABEL: Record<CopilotMemoryType, string> = {
  PREFERENCE:          "Preferences",
  GOAL:                "Goals",
  TRADING_PREFERENCE:  "Trading",
  COPILOT_PREFERENCE:  "Copilot style",
  EXPLICIT_FACT:       "About you",
};

/** Preserves the backend's own ordering (most recently saved first) within
 *  each type group — no re-sorting here, same convention as
 *  groupByDate() above. */
function groupByType(memories: CopilotMemoryItem[]): Array<[CopilotMemoryType, CopilotMemoryItem[]]> {
  const order: CopilotMemoryType[] = ["COPILOT_PREFERENCE", "TRADING_PREFERENCE", "GOAL", "PREFERENCE", "EXPLICIT_FACT"];
  const groups = new Map<CopilotMemoryType, CopilotMemoryItem[]>();
  for (const m of memories) {
    const list = groups.get(m.type);
    if (list) list.push(m);
    else groups.set(m.type, [m]);
  }
  return order.filter((t) => groups.has(t)).map((t) => [t, groups.get(t)!]);
}

function MemoryOverlay({ onClose }: { onClose: () => void }) {
  const { memories, memoriesLoading, memoriesError, loadMemories, forgetMemory, updateMemory } = useCopilotStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void loadMemories(); }, [loadMemories]);

  const startEdit = (id: string, content: string) => {
    setEditingId(id);
    setEditValue(content);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const saveEdit = async (id: string) => {
    const content = editValue.trim();
    if (!content || saving) return;
    setSaving(true);
    const result = await updateMemory(id, content);
    setSaving(false);
    if (!result.ok) {
      setEditError(result.error ?? "Couldn't save that edit.");
      return;
    }
    setEditingId(null);
    setEditError(null);
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-black/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <p className="text-white/70 text-xs font-semibold">What Copilot remembers</p>
        <button onClick={onClose} className="text-white/40 hover:text-white/70 text-xs px-2 py-1" aria-label="Close memory">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {memoriesLoading && <p className="text-white/30 text-xs px-1 py-2 animate-pulse">Loading…</p>}
        {memoriesError && <p className="text-red-400 text-xs px-1 py-2">{memoriesError}</p>}
        {!memoriesLoading && !memoriesError && memories.length === 0 && (
          <p className="text-white/30 text-xs px-1 py-2">
            Nothing saved yet — try saying "remember that I prefer XAUUSD".
          </p>
        )}

        {groupByType(memories).map(([type, items]) => (
          <div key={type} className="mb-3">
            <p className="text-white/25 text-[10px] uppercase tracking-wide px-1 mb-1">{MEMORY_TYPE_LABEL[type]}</p>
            <div className="flex flex-col gap-1">
              {items.map((m) =>
                editingId === m.id ? (
                  <div key={m.id} className="flex flex-col gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 text-xs">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/80 text-xs leading-relaxed placeholder-white/20 focus:outline-none focus:border-white/20 resize-none"
                    />
                    {editError && <p className="text-red-400 text-xs">{editError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void saveEdit(m.id)}
                        disabled={saving || !editValue.trim()}
                        className="text-green-400 hover:text-green-300 transition disabled:opacity-40"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={cancelEdit} disabled={saving} className="text-white/40 hover:text-white/60 transition disabled:opacity-40">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="group flex items-start justify-between gap-2 px-2 py-1.5 rounded-lg bg-white/5 text-xs text-white/70">
                    <span className="leading-relaxed">{m.content}</span>
                    <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => startEdit(m.id, m.content)} className="text-white/30 hover:text-indigo-400 transition" title="Edit this">
                        Edit
                      </button>
                      <button onClick={() => void forgetMemory(m.id)} className="text-white/30 hover:text-red-400 transition" title="Forget this">
                        Forget
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────

export default function CopilotPanel() {
  const { messages, isLoading, error, sendMessage, startNewConversation } = useCopilotStore();
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    // CopilotPanel currently only renders inside the main trading page's
    // RightPanel — this is the honest, constant context until Copilot is
    // available elsewhere too (see copilotStore.ts's CopilotUiContext doc).
    void sendMessage(input, { currentModule: "trading", currentPage: "dashboard" });
    setInput("");
  };

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 shrink-0">
        <p className="text-white/70 text-xs font-semibold">Copilot</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setHistoryOpen(true)}
            className="text-white/40 hover:text-white/70 text-xs w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/5 transition"
            title="Conversation history"
            aria-label="Conversation history"
          >
            🕓
          </button>
          <button
            onClick={() => setMemoryOpen(true)}
            className="text-white/40 hover:text-white/70 text-xs w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/5 transition"
            title="What Copilot remembers"
            aria-label="What Copilot remembers"
          >
            🧠
          </button>
          <button
            onClick={startNewConversation}
            className="text-white/40 hover:text-white/70 text-xs w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/5 transition"
            title="New conversation"
            aria-label="New conversation"
          >
            +
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <p className="text-2xl">🤖</p>
            <p className="text-white/30 text-xs">
              Ask TCC Copilot about your trades, analytics, journal, watchlist, or risk score.
            </p>
            <p className="text-white/15 text-xs">e.g. "Analyze my trading performance this month" or "Add XAUUSD to my watchlist"</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`glass border rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "border-green-500/15 bg-green-500/5 text-white/80 ml-6"
                  : "border-white/5 text-white/70 mr-6"
              }`}
            >
              {m.content}
              {/* A continuation turn can both have already executed LOW
                  tools AND end by proposing a further MEDIUM/HIGH one —
                  show the status line and the confirmation card together
                  rather than treating them as mutually exclusive. */}
              {m.toolCalls && m.toolCalls.length > 0 && <ToolStatusLine toolCalls={m.toolCalls} />}
              {m.pendingAction && <PendingActionCard messageId={m.id} action={m.pendingAction} />}
            </div>
          ))
        )}

        {isLoading && (
          <div className="glass border border-white/5 rounded-xl p-3 mr-6">
            <p className="text-white/30 text-xs animate-pulse">Thinking…</p>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 pb-2">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      <div className="p-3 border-t border-white/5 flex gap-2 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          disabled={isLoading}
          placeholder="Ask Copilot…"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs placeholder-white/20 focus:outline-none focus:border-white/20 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-indigo-500/30 transition"
        >
          Send
        </button>
      </div>

      {historyOpen && <HistoryOverlay onClose={() => setHistoryOpen(false)} />}
      {memoryOpen && <MemoryOverlay onClose={() => setMemoryOpen(false)} />}
    </div>
  );
}
