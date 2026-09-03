/**
 * TCC Copilot Store — Phase 6 (conversation history) + Phase 7 (memory)
 *
 * Talks to the agent-backed /copilot/chat, the confirmation endpoints
 * (/copilot/actions/:id/{confirm,cancel}), the conversation list/detail
 * endpoints (/copilot/conversations[/:id]), and now the memory endpoints
 * (/copilot/memories[/:id]). The store never decides whether an action is
 * allowed to run — it only relays the user's explicit confirm/cancel intent
 * to the backend and renders whatever state comes back. Nothing here
 * executes a tool client-side; there is no local "confirmed = true, so run
 * it" branch anywhere in this file — see copilotActionService.ts on the
 * backend for why that matters.
 *
 * Same principle for history and memory: opening an old conversation always
 * refetches it from the backend (openConversation()) rather than trusting
 * anything cached locally — a pending action's real state (still pending
 * vs. expired) is only ever known server-side; loadMemories() likewise
 * always reflects the backend's current, authoritative memory set, never a
 * client-side guess.
 */
import { create } from "zustand";
import { api } from "@/lib/api/client";

export type PendingActionStatus =
  | "pending"     // proposed, waiting on the user
  | "confirming"  // confirm request in flight
  | "cancelling"  // cancel request in flight
  | "executed"
  | "failed"
  | "cancelled"
  | "expired"
  | "unavailable"; // e.g. already resolved elsewhere, or a bad id

export interface PendingActionInfo {
  id:        string;
  toolName:  string;
  expiresAt: string;
  status:    PendingActionStatus;
  /** App-authored summary of the outcome once resolved — never raw tool
   *  arguments or provider output. */
  resultMessage?: string;
}

/** Structured hint about what the user is currently looking at — sent
 *  alongside each message so Copilot doesn't have to rely purely on
 *  natural-language interpretation (see copilotContextOrchestrator.ts's
 *  verifySelectedEntity() on the backend, Phase 8, which re-verifies any
 *  referenced entity against the authenticated user before ever using it —
 *  this is a hint, never an authorization). CopilotPanel currently only
 *  renders on the main trading page, so currentModule/currentPage are
 *  constant for now; selectedEntity exists for future pages that let the
 *  user focus a specific trade, journal entry, community post, or copy-
 *  trading relationship — all four are recognized by the backend (Phase 8
 *  added journal, Phase 9 added community_post/copy_relationship) but
 *  nothing in the UI sets any but "trade" yet. */
export interface CopilotUiContext {
  currentModule?:  string;
  currentPage?:    string;
  selectedEntity?: { type: "trade" | "journal" | "community_post" | "copy_relationship"; id: string };
}

export interface CopilotChatMessage {
  id:      string;
  role:    "user" | "assistant";
  content: string;
  /** Present on assistant messages that used tools, for a minimal status line. */
  toolCalls?: Array<{ name: string; status: string }>;
  /** Present only on the assistant message that proposed a MEDIUM/HIGH-risk
   *  action this turn. */
  pendingAction?: PendingActionInfo;
}

export interface CopilotConversationSummary {
  id:        string;
  title:     string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: { role: "USER" | "ASSISTANT"; content: string };
}

/** Phase 7 — long-term memory. Distinct from conversation history above:
 *  this is what Copilot remembers ABOUT the user across every conversation,
 *  not what happened in one of them. */
export type CopilotMemoryType = "PREFERENCE" | "GOAL" | "TRADING_PREFERENCE" | "COPILOT_PREFERENCE" | "EXPLICIT_FACT";

export interface CopilotMemoryItem {
  id:        string;
  type:      CopilotMemoryType;
  content:   string;
  source:    "EXPLICIT" | "USER_APPROVED";
  createdAt: string;
}

interface ChatApiResponse {
  conversationId: string;
  message:        string;
  toolCalls:      Array<{ name: string; status: string }>;
  tokensUsed:     number;
  model:          string | null;
  pendingAction?: { id: string; toolName: string; expiresAt: string };
}

interface ActionApiResponse {
  id:             string;
  toolName:       string;
  status:         "EXECUTED" | "FAILED" | "CANCELLED";
  message:        string;
  conversationId: string;
  /** Present only when the confirmed/cancelled action was part of a
   *  multi-step request (e.g. "add XAUUSD and analyze it") — the resumed
   *  turn's own result, which may itself include a further pendingAction. */
  continuation?: {
    message:        string;
    toolCalls:      Array<{ name: string; status: string }>;
    pendingAction?: { id: string; toolName: string; expiresAt: string };
  };
}

interface ConversationListApiResponse {
  items:      CopilotConversationSummary[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

interface MemoryListApiResponse {
  items: CopilotMemoryItem[];
  total: number;
}

interface ConversationDetailApiResponse {
  conversation: { id: string; title: string; createdAt: string; updatedAt: string };
  messages: Array<{
    id:        string;
    role:      "USER" | "ASSISTANT";
    content:   string;
    createdAt: string;
    toolCalls?: Array<{ name: string; status: string }>;
    // The backend's PendingActionViewStatus is exactly the subset of
    // PendingActionStatus a reload can ever produce (no "confirming"/
    // "cancelling" in-flight states — those only exist client-side while a
    // request is outstanding) — same string values, no mapping needed.
    pendingAction?: { id: string; toolName: string; expiresAt: string; status: PendingActionStatus; resultMessage?: string };
  }>;
}

interface CopilotStore {
  conversationId: string | null;
  messages:       CopilotChatMessage[];
  isLoading:      boolean;
  error:          string | null;

  conversations:        CopilotConversationSummary[];
  conversationsLoading: boolean;
  conversationsError:   string | null;

  memories:        CopilotMemoryItem[];
  memoriesLoading: boolean;
  memoriesError:   string | null;

  sendMessage:   (message: string, context?: CopilotUiContext) => Promise<void>;
  confirmAction: (messageId: string) => Promise<void>;
  cancelAction:  (messageId: string) => Promise<void>;
  reset:         () => void;

  /** Clears the active conversation locally — does NOT create a row on the
   *  server. The next sendMessage() call creates it lazily (conversationId
   *  is null, exactly like the very first message a new user ever sends),
   *  so opening "New conversation" and never typing anything leaves no
   *  trace. */
  startNewConversation: () => void;
  /** Always refetches from the backend — never trusts a locally-cached
   *  transcript, since a pending action's real state (confirmable vs.
   *  expired) is only known server-side. */
  openConversation:      (id: string) => Promise<void>;
  loadConversations:     () => Promise<void>;
  /** Deletes a conversation on the backend, then removes it from the local
   *  list. Not optimistic (unlike forgetMemory below): a delete that fails
   *  server-side must not disappear from the sidebar, and there's no
   *  meaningful "undo the delete" UI to roll back into either — this always
   *  waits for the backend's answer first. If the currently-open
   *  conversation is the one deleted, clears it back to the "New
   *  conversation" state locally. */
  deleteConversation: (id: string) => Promise<{ ok: boolean; error?: string }>;

  /** Always refetches from the backend, same reasoning as
   *  openConversation() above — memory is authoritative server-side. */
  loadMemories: () => Promise<void>;
  /** Optimistically removes the item locally, then confirms with the
   *  backend; re-adds it back on failure rather than leaving the UI out of
   *  sync with what's actually still stored. */
  forgetMemory: (id: string) => Promise<void>;
  /** Edits a memory's content through the same governance the backend
   *  applies to creation (PATCH /copilot/memories/:id) — not optimistic,
   *  since the backend can reject the new content (e.g. secret-like) or
   *  merge it into an existing memory (a different id comes back). Returns
   *  ok:false with an error message on rejection so the edit UI can show it
   *  inline rather than silently losing the user's edit. */
  updateMemory: (id: string, content: string) => Promise<{ ok: boolean; error?: string }>;
}

let nextId = 0;
const makeId = () => `copilot-msg-${Date.now()}-${nextId++}`;

/** Shared by confirmAction/cancelAction — same request/response shape,
 *  same optimistic "in flight" state, same status-mapping on completion. */
async function resolvePendingAction(
  set: (fn: (s: CopilotStore) => Partial<CopilotStore>) => void,
  get: () => CopilotStore,
  messageId: string,
  kind: "confirm" | "cancel"
): Promise<void> {
  const msg = get().messages.find((m) => m.id === messageId);
  if (!msg?.pendingAction || msg.pendingAction.status !== "pending") return;

  const actionId = msg.pendingAction.id;
  const inFlightStatus: PendingActionStatus = kind === "confirm" ? "confirming" : "cancelling";

  const patch = (patchFn: (a: PendingActionInfo) => PendingActionInfo) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId && m.pendingAction ? { ...m, pendingAction: patchFn(m.pendingAction) } : m
      ),
    }));

  patch((a) => ({ ...a, status: inFlightStatus }));

  const res = await api.post<ActionApiResponse>(`/copilot/actions/${actionId}/${kind}`);

  if (res.success) {
    const status: PendingActionStatus =
      res.data.status === "EXECUTED" ? "executed" : res.data.status === "CANCELLED" ? "cancelled" : "failed";
    patch((a) => ({ ...a, status, resultMessage: res.data.message }));

    // If this action was part of a multi-step request, the backend already
    // resumed it and produced a follow-up response (possibly with its own
    // new pendingAction) — render it as the next assistant message, same
    // as any other turn.
    if (res.data.continuation) {
      const cont = res.data.continuation;
      const continuationMsg: CopilotChatMessage = {
        id:        makeId(),
        role:      "assistant",
        content:   cont.message,
        toolCalls: cont.toolCalls,
        pendingAction: cont.pendingAction ? { ...cont.pendingAction, status: "pending" } : undefined,
      };
      set((s) => ({ messages: [...s.messages, continuationMsg] }));
    }
    return;
  }

  const status: PendingActionStatus = res.code === "CONFLICT" ? "expired" : res.code === "NOT_FOUND" ? "unavailable" : "failed";
  patch((a) => ({ ...a, status, resultMessage: res.error }));
}

export const useCopilotStore = create<CopilotStore>((set, get) => ({
  conversationId: null,
  messages:       [],
  isLoading:      false,
  error:          null,

  conversations:        [],
  conversationsLoading: false,
  conversationsError:   null,

  memories:        [],
  memoriesLoading: false,
  memoriesError:   null,

  sendMessage: async (message: string, context?: CopilotUiContext) => {
    const text = message.trim();
    if (!text || get().isLoading) return;

    const userMsg: CopilotChatMessage = { id: makeId(), role: "user", content: text };
    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true, error: null }));

    try {
      const res = await api.post<ChatApiResponse>("/copilot/chat", {
        message: text,
        conversationId: get().conversationId ?? undefined,
        context,
      });

      if (!res.success) {
        set({ isLoading: false, error: res.error });
        return;
      }

      const assistantMsg: CopilotChatMessage = {
        id:        makeId(),
        role:      "assistant",
        content:   res.data.message,
        toolCalls: res.data.toolCalls,
        pendingAction: res.data.pendingAction
          ? { ...res.data.pendingAction, status: "pending" }
          : undefined,
      };

      set((s) => ({
        conversationId: res.data.conversationId,
        messages:       [...s.messages, assistantMsg],
        isLoading:      false,
        error:          null,
      }));
    } catch {
      set({ isLoading: false, error: "Failed to reach Copilot. Check your connection." });
    }
  },

  confirmAction: (messageId) => resolvePendingAction(set, get, messageId, "confirm"),
  cancelAction:  (messageId) => resolvePendingAction(set, get, messageId, "cancel"),

  reset: () => set({
    conversationId: null, messages: [], isLoading: false, error: null,
    conversations: [], conversationsLoading: false, conversationsError: null,
    memories: [], memoriesLoading: false, memoriesError: null,
  }),

  startNewConversation: () => set({ conversationId: null, messages: [], error: null }),

  openConversation: async (id: string) => {
    set({ isLoading: true, error: null });

    const res = await api.get<ConversationDetailApiResponse>(`/copilot/conversations/${id}`);
    if (!res.success) {
      set({ isLoading: false, error: res.error });
      return;
    }

    const messages: CopilotChatMessage[] = res.data.messages.map((m) => ({
      id:      m.id,
      role:    m.role === "USER" ? "user" : "assistant",
      content: m.content,
      toolCalls: m.toolCalls,
      pendingAction: m.pendingAction,
    }));

    set({ conversationId: res.data.conversation.id, messages, isLoading: false, error: null });
  },

  loadConversations: async () => {
    set({ conversationsLoading: true, conversationsError: null });

    const res = await api.get<ConversationListApiResponse>("/copilot/conversations?page=1&pageSize=20");
    if (!res.success) {
      set({ conversationsLoading: false, conversationsError: res.error });
      return;
    }

    set({ conversations: res.data.items, conversationsLoading: false });
  },

  deleteConversation: async (id: string) => {
    const res = await api.delete(`/copilot/conversations/${id}`);
    if (!res.success) {
      set({ conversationsError: res.error });
      return { ok: false, error: res.error };
    }

    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      // The deleted conversation was open in the chat pane — clear it back
      // to "New conversation" rather than leaving a transcript on screen
      // for a conversation that no longer exists server-side.
      ...(s.conversationId === id ? { conversationId: null, messages: [] } : {}),
    }));
    return { ok: true };
  },

  loadMemories: async () => {
    set({ memoriesLoading: true, memoriesError: null });

    const res = await api.get<MemoryListApiResponse>("/copilot/memories?page=1&pageSize=100");
    if (!res.success) {
      set({ memoriesLoading: false, memoriesError: res.error });
      return;
    }

    set({ memories: res.data.items, memoriesLoading: false });
  },

  forgetMemory: async (id: string) => {
    const previous = get().memories;
    set({ memories: previous.filter((m) => m.id !== id) });

    const res = await api.delete(`/copilot/memories/${id}`);
    if (!res.success) {
      set({ memories: previous, memoriesError: res.error }); // roll back
    }
  },

  updateMemory: async (id: string, content: string) => {
    const res = await api.patch<CopilotMemoryItem>(`/copilot/memories/${id}`, { content });
    if (!res.success) {
      return { ok: false, error: res.error };
    }

    // A merge (the edit now exactly restates another existing memory) comes
    // back with a DIFFERENT id than the one edited — drop both the old row
    // and any existing row for the surviving id before inserting the fresh one.
    set((s) => ({
      memories: [res.data, ...s.memories.filter((m) => m.id !== id && m.id !== res.data.id)],
    }));
    return { ok: true };
  },
}));

// ── Auto-reset on logout ─────────────────────────────────────────────────

if (typeof window !== "undefined") {
  import("@/store/authStore").then(({ useAuthStore }) => {
    let prevUserId: string | undefined = useAuthStore.getState().user?.id;

    useAuthStore.subscribe((state) => {
      const userId = state.user?.id;
      if (userId !== prevUserId) {
        prevUserId = userId;
        if (!userId) useCopilotStore.getState().reset();
      }
    });
  });
}
