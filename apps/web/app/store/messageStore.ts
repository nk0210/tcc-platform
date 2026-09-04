/**
 * TCC Direct Messages Store — API-backed, with real-time delivery.
 * Incoming messages arrive via receiveMessage(), called by the WebSocket
 * client on a DM_MESSAGE push (see lib/websocket/client.ts) — the same
 * push-into-store pattern notificationStore/tradeStore already use.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";
import type { CommunityAuthor } from "@/store/communityStore";

export interface DirectMessage {
  id:             string;
  conversationId: string;
  senderId:       string;
  sender:         CommunityAuthor;
  content:        string;
  readAt:         string | null;
  createdAt:      string;
}

export interface ConversationSummary {
  id:            string;
  otherUser:     CommunityAuthor;
  lastMessage:   DirectMessage | null;
  lastMessageAt: string;
  unreadCount:   number;
}

interface PaginatedResult<T> {
  items: T[]; total: number; page: number; pageSize: number; totalPages: number; hasNext: boolean; hasPrev: boolean;
}

interface MessageStore {
  conversations:       ConversationSummary[];
  activeConversationId: string | null;
  messages:            DirectMessage[];
  totalUnread:         number;
  isLoading:           boolean;
  error:               string | null;

  loadConversations: () => Promise<void>;
  startConversation: (handle: string) => Promise<ConversationSummary | null>;
  openConversation:  (conversationId: string) => Promise<void>;
  sendMessage:       (conversationId: string, content: string) => Promise<boolean>;
  refreshUnreadCount: () => Promise<void>;
  /** Called by the WS client when a DM_MESSAGE push arrives. */
  receiveMessage:    (conversationId: string, message: DirectMessage) => void;
}

export const useMessageStore = create<MessageStore>()((set, get) => ({
  conversations:        [],
  activeConversationId: null,
  messages:             [],
  totalUnread:          0,
  isLoading:            false,
  error:                null,

  loadConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<PaginatedResult<ConversationSummary>>("/community/messages?page=1&pageSize=30");
      if (!res.success) { set({ isLoading: false, error: res.error }); return; }
      set({ conversations: res.data.items, isLoading: false });
    } catch (err) {
      console.error("[messageStore.loadConversations]", err);
      set({ isLoading: false, error: "Failed to load conversations" });
    }
  },

  startConversation: async (handle) => {
    try {
      const res = await api.post<{ id: string; participantAId: string; participantBId: string }>("/community/messages/start", { handle });
      if (!res.success) return null;
      await get().loadConversations();
      return get().conversations.find((c) => c.id === res.data.id) ?? null;
    } catch (err) {
      console.error("[messageStore.startConversation]", err);
      return null;
    }
  },

  openConversation: async (conversationId) => {
    set({ activeConversationId: conversationId, isLoading: true, messages: [] });
    try {
      const res = await api.get<PaginatedResult<DirectMessage> & { otherUser: CommunityAuthor }>(`/community/messages/${conversationId}?page=1&pageSize=50`);
      if (!res.success) { set({ isLoading: false, error: res.error }); return; }
      set({
        messages:  [...res.data.items].reverse(),
        isLoading: false,
        conversations: get().conversations.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
      });
      get().refreshUnreadCount();
    } catch (err) {
      console.error("[messageStore.openConversation]", err);
      set({ isLoading: false, error: "Failed to load messages" });
    }
  },

  sendMessage: async (conversationId, content) => {
    try {
      const res = await api.post<DirectMessage>(`/community/messages/${conversationId}`, { content });
      if (!res.success) return false;
      set((s) => ({
        messages: s.activeConversationId === conversationId ? [...s.messages, res.data] : s.messages,
        conversations: s.conversations
          .map((c) => (c.id === conversationId ? { ...c, lastMessage: res.data, lastMessageAt: res.data.createdAt } : c))
          .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()),
      }));
      return true;
    } catch (err) {
      console.error("[messageStore.sendMessage]", err);
      return false;
    }
  },

  refreshUnreadCount: async () => {
    try {
      const res = await api.get<{ count: number }>("/community/messages/unread-count");
      if (res.success) set({ totalUnread: res.data.count });
    } catch (err) {
      console.error("[messageStore.refreshUnreadCount]", err);
    }
  },

  receiveMessage: (conversationId, message) => {
    set((s) => {
      const isOpen = s.activeConversationId === conversationId;
      const existingConvo = s.conversations.find((c) => c.id === conversationId);

      const conversations = existingConvo
        ? s.conversations
            .map((c) => (c.id === conversationId
              ? { ...c, lastMessage: message, lastMessageAt: message.createdAt, unreadCount: isOpen ? 0 : c.unreadCount + 1 }
              : c))
            .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
        : s.conversations; // A conversation we don't have loaded yet — the next loadConversations() picks it up.

      return {
        conversations,
        messages: isOpen ? [...s.messages, message] : s.messages,
        totalUnread: isOpen ? s.totalUnread : s.totalUnread + 1,
      };
    });
    if (!get().conversations.find((c) => c.id === conversationId)) get().loadConversations();
  },
}));
