/**
 * Direct Message Repository
 * Sole Prisma layer for Conversation/Message. No business logic — canonical
 * participant ordering (so A↔B always resolves to one row regardless of who
 * initiated) lives in directMessageService.ts, not here.
 */
import db from "../../lib/prisma";

const PARTICIPANT_SELECT = {
  id: true, handle: true, displayName: true, avatarUrl: true, isVerified: true,
} as const;

export const directMessageRepository = {
  findConversation(participantAId: string, participantBId: string) {
    return db.conversation.findUnique({
      where: { participantAId_participantBId: { participantAId, participantBId } },
    });
  },

  createConversation(participantAId: string, participantBId: string) {
    return db.conversation.create({ data: { participantAId, participantBId } });
  },

  async findConversationsForUser(userId: string, page: number, pageSize: number) {
    const where = { OR: [{ participantAId: userId }, { participantBId: userId }] };
    const [rows, total] = await Promise.all([
      db.conversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: {
          participantA: { select: PARTICIPANT_SELECT },
          participantB: { select: PARTICIPANT_SELECT },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      db.conversation.count({ where }),
    ]);
    return { items: rows, total };
  },

  findConversationById(conversationId: string) {
    return db.conversation.findUnique({
      where:   { id: conversationId },
      include: {
        participantA: { select: PARTICIPANT_SELECT },
        participantB: { select: PARTICIPANT_SELECT },
      },
    });
  },

  touchLastMessageAt(conversationId: string, at: Date) {
    return db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: at } });
  },

  createMessage(conversationId: string, senderId: string, content: string) {
    return db.message.create({
      data: { conversationId, senderId, content },
      include: { sender: { select: PARTICIPANT_SELECT } },
    });
  },

  async findMessages(conversationId: string, page: number, pageSize: number) {
    const where = { conversationId };
    const [rows, total] = await Promise.all([
      db.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { sender: { select: PARTICIPANT_SELECT } },
      }),
      db.message.count({ where }),
    ]);
    return { items: rows, total };
  },

  markReadUpTo(conversationId: string, readerId: string, at: Date) {
    return db.message.updateMany({
      where: { conversationId, senderId: { not: readerId }, readAt: null },
      data:  { readAt: at },
    });
  },

  unreadCount(conversationId: string, readerId: string) {
    return db.message.count({ where: { conversationId, senderId: { not: readerId }, readAt: null } });
  },

  async totalUnreadCount(userId: string): Promise<number> {
    return db.message.count({
      where: {
        readAt: null,
        senderId: { not: userId },
        conversation: { OR: [{ participantAId: userId }, { participantBId: userId }] },
      },
    });
  },
};
