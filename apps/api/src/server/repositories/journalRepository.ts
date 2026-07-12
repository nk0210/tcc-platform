/**
 * TCC Journal Repository — sole Prisma layer for JournalEntry.
 */
import db from "../../lib/prisma";
import type { Prisma } from "@tcc/db";

export interface UpdateJournalInput {
  emotion?:         string;
  confidenceLevel?: number;
  stressLevel?:     number;
  entryQuality?:    string;
  followedPlan?:    boolean | null;
  strategy?:        string;
  marketStructure?: string;
  session?:         string;
  timeframe?:       string;
  notes?:           string;
  whatWentRight?:   string;
  whatWentWrong?:   string;
  lessonLearned?:   string;
  tags?:            string[];
  aiAnalysis?:      string;
}

export interface ListJournalParams {
  page:      number;
  pageSize:  number;
  symbol?:   string;
  session?:  string;
  strategy?: string;
  from?:     Date;
  to?:       Date;
}

export const journalRepository = {
  async findByUserId(userId: string, params: ListJournalParams) {
    const { page, pageSize, symbol, session, strategy, from, to } = params;

    const where: Prisma.JournalEntryWhereInput = {
      userId,
      ...(symbol   ? { symbol }   : {}),
      ...(session  ? { session }  : {}),
      ...(strategy ? { strategy } : {}),
      ...(from || to ? {
        closedAt: {
          ...(from ? { gte: from } : {}),
          ...(to   ? { lte: to }   : {}),
        },
      } : {}),
    };

    const [items, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      db.journalEntry.count({ where }),
    ]);

    return { items, total };
  },

  findById(id: string, userId: string) {
    return db.journalEntry.findFirst({
      where: { id, userId },
    });
  },

  findByTradeId(tradeId: string, userId: string) {
    return db.journalEntry.findFirst({
      where: { tradeId, userId },
    });
  },

  update(id: string, userId: string, input: UpdateJournalInput) {
    return db.journalEntry.update({
      where: { id },
      data:  input,
    });
  },

  // For analytics — all entries without pagination
  findAllByUserId(userId: string) {
    return db.journalEntry.findMany({
      where:   { userId },
      orderBy: { closedAt: "asc" },
      select: {
        id: true, symbol: true, displayName: true, category: true,
        side: true, lotSize: true, entryPrice: true, exitPrice: true,
        grossPnl: true, netPnl: true, commission: true, result: true,
        openedAt: true, closedAt: true, durationMs: true, closeReason: true,
        session: true, strategy: true, timeframe: true,
        confidenceLevel: true, stressLevel: true, followedPlan: true,
        entryQuality: true, tags: true, emotion: true,
      },
    });
  },
};