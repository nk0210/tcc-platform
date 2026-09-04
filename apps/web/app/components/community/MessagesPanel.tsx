"use client";
/**
 * TCC Social — Direct Messages: conversation list + active chat, real-time
 * via the shared WebSocket connection (messageStore.receiveMessage is
 * called by lib/websocket/client.ts on a DM_MESSAGE push).
 */
import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useMessageStore } from "@/store/messageStore";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function NewMessageForm({ onStarted, onCancel }: { onStarted: (conversationId: string) => void; onCancel: () => void }) {
  const { startConversation } = useMessageStore();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!handle.trim()) return;
    setBusy(true);
    setError(null);
    const convo = await startConversation(handle.trim().replace(/^@/, ""));
    setBusy(false);
    if (convo) onStarted(convo.id);
    else setError("Couldn't start a conversation with that user.");
  };

  return (
    <div className="glass rounded-xl p-4 mb-3">
      <p className="text-fg font-semibold text-sm mb-2">New message</p>
      <div className="flex gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleStart()}
          placeholder="@handle"
          autoFocus
          className="flex-1 bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-accent placeholder-fg-dim"
        />
        <button onClick={handleStart} disabled={busy || !handle.trim()} className="btn btn-primary text-xs !px-4 disabled:opacity-50">Start</button>
        <button onClick={onCancel} className="btn btn-ghost text-xs !px-3">Cancel</button>
      </div>
      {error && <p className="text-danger text-xs mt-1.5">{error}</p>}
    </div>
  );
}

function ChatPanel({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const { user } = useAuthStore();
  const { messages, conversations, openConversation, sendMessage, isLoading } = useMessageStore();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === conversationId);

  useEffect(() => { openConversation(conversationId); }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const ok = await sendMessage(conversationId, text.trim());
    setSending(false);
    if (ok) setText("");
  };

  return (
    <div className="glass rounded-xl flex flex-col h-[70vh]">
      <div className="flex items-center gap-2.5 p-3 border-b border-border shrink-0">
        <button onClick={onBack} className="text-fg-dim hover:text-fg-muted text-sm">←</button>
        {conversation && (
          <>
            <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-hover text-xs font-bold shrink-0">
              {conversation.otherUser.handle[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-fg text-sm font-semibold">{conversation.otherUser.displayName}</p>
              <p className="text-fg-dim text-xs">@{conversation.otherUser.handle}</p>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {isLoading ? (
          <p className="text-fg-dim text-xs text-center py-6 animate-pulse">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-fg-dim text-xs text-center py-6">Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-accent text-white" : "bg-elevated text-fg-muted"}`}>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`text-[10px] mt-0.5 ${mine ? "text-white/70" : "text-fg-dim"}`}>{timeAgo(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 p-3 border-t border-border shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Message…"
          maxLength={2000}
          className="flex-1 bg-elevated border border-border rounded-full px-4 py-2 text-fg text-sm focus:outline-none focus:border-accent placeholder-fg-dim"
        />
        <button onClick={handleSend} disabled={sending || !text.trim()} className="btn btn-primary text-xs !px-4 !py-2 disabled:opacity-50">Send</button>
      </div>
    </div>
  );
}

export default function MessagesPanel() {
  const { conversations, loadConversations, isLoading } = useMessageStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  if (activeId) return <ChatPanel conversationId={activeId} onBack={() => setActiveId(null)} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-fg-dim text-xs">{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowNew((s) => !s)} className="btn btn-primary text-xs !px-3 !py-1.5">
          {showNew ? "Cancel" : "✉️ New message"}
        </button>
      </div>

      {showNew && <NewMessageForm onCancel={() => setShowNew(false)} onStarted={(id) => { setShowNew(false); setActiveId(id); }} />}

      {isLoading ? (
        <p className="text-fg-dim text-xs animate-pulse py-6 text-center">Loading…</p>
      ) : conversations.length === 0 ? (
        <div className="glass rounded-xl flex flex-col items-center justify-center py-16 gap-2 text-center">
          <p className="text-4xl">✉️</p>
          <p className="text-fg-muted text-sm font-semibold">No messages yet</p>
          <p className="text-fg-dim text-xs">Start a conversation with another trader.</p>
        </div>
      ) : (
        <div className="glass rounded-xl divide-y divide-border">
          {conversations.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)} className="w-full flex items-center gap-3 p-3 hover:bg-elevated transition text-left">
              <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-hover text-sm font-bold shrink-0">
                {c.otherUser.handle[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-fg text-sm font-semibold truncate">{c.otherUser.displayName}</p>
                <p className="text-fg-dim text-xs truncate">{c.lastMessage?.content ?? "No messages yet"}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-fg-dim text-[10px]">{timeAgo(c.lastMessageAt)}</span>
                {c.unreadCount > 0 && (
                  <span className="bg-accent text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{c.unreadCount}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
