/**
 * Direct Message Service
 * Business logic for 1:1 conversations. Canonical participant ordering
 * (lexicographically smaller user id stored as participantA) is enforced
 * here so "find or create the conversation between A and B" is always one
 * unique lookup regardless of who initiated it.
 */
import { directMessageRepository }   from "../repositories/directMessageRepository";
import { communityFollowRepository } from "../repositories/communityFollowRepository";
import { userRelationService }       from "./userRelationService";
import { send } from "../../websocket/connectionManager";

export class UserNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("USER_NOT_FOUND"); }
}
export class CannotMessageSelfError extends Error {
  statusCode = 400;
  constructor() { super("CANNOT_MESSAGE_SELF"); }
}
export class BlockedError extends Error {
  statusCode = 403;
  constructor() { super("USER_BLOCKED"); }
}
export class ConversationNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("CONVERSATION_NOT_FOUND"); }
}
export class NotParticipantError extends Error {
  statusCode = 403;
  constructor() { super("NOT_PARTICIPANT"); }
}

function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function paginate(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize);
  return { total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

function otherParticipant<T>(conversation: { participantAId: string; participantA: T; participantBId: string; participantB: T }, viewerId: string): T {
  return conversation.participantAId === viewerId ? conversation.participantB : conversation.participantA;
}

export const directMessageService = {
  async getOrCreateConversation(userId: string, otherUserId: string) {
    if (userId === otherUserId) throw new CannotMessageSelfError();
    if (await userRelationService.isBlockedEitherWay(userId, otherUserId)) throw new BlockedError();

    const [a, b] = orderPair(userId, otherUserId);
    const existing = await directMessageRepository.findConversation(a, b);
    if (existing) return existing;
    return directMessageRepository.createConversation(a, b);
  },

  async listConversations(userId: string, page: number, pageSize: number) {
    const { items, total } = await directMessageRepository.findConversationsForUser(userId, page, pageSize);
    const withMeta = await Promise.all(
      items.map(async (c) => ({
        id:            c.id,
        otherUser:     otherParticipant(c, userId),
        lastMessage:   c.messages[0] ?? null,
        lastMessageAt: c.lastMessageAt,
        unreadCount:   await directMessageRepository.unreadCount(c.id, userId),
      }))
    );
    return { items: withMeta, ...paginate(total, page, pageSize) };
  },

  async getTotalUnreadCount(userId: string) {
    return directMessageRepository.totalUnreadCount(userId);
  },

  async getMessages(conversationId: string, viewerId: string, page: number, pageSize: number) {
    const conversation = await directMessageRepository.findConversationById(conversationId);
    if (!conversation) throw new ConversationNotFoundError();
    if (conversation.participantAId !== viewerId && conversation.participantBId !== viewerId) {
      throw new NotParticipantError();
    }

    const { items, total } = await directMessageRepository.findMessages(conversationId, page, pageSize);
    await directMessageRepository.markReadUpTo(conversationId, viewerId, new Date());

    return { items, ...paginate(total, page, pageSize), otherUser: otherParticipant(conversation, viewerId) };
  },

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const conversation = await directMessageRepository.findConversationById(conversationId);
    if (!conversation) throw new ConversationNotFoundError();
    if (conversation.participantAId !== senderId && conversation.participantBId !== senderId) {
      throw new NotParticipantError();
    }

    const recipientId = otherParticipant(conversation, senderId).id;
    if (await userRelationService.isBlockedEitherWay(senderId, recipientId)) throw new BlockedError();

    const message = await directMessageRepository.createMessage(conversationId, senderId, content);
    await directMessageRepository.touchLastMessageAt(conversationId, message.createdAt);

    // Real-time push if the recipient is connected — send() is a no-op if
    // they're not, matching the existing NOTIFICATION/TRADE_CLOSED pattern.
    send(recipientId, { type: "DM_MESSAGE", payload: { conversationId, message } });

    return message;
  },

  async startConversationByHandle(userId: string, handle: string) {
    const target = await communityFollowRepository.findUserByHandle(handle);
    if (!target || !target.isActive) throw new UserNotFoundError();
    return directMessageService.getOrCreateConversation(userId, target.id);
  },
};
