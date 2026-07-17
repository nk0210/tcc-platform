import db from "../../lib/prisma";

export interface AnalyticsFilters {
  from?: Date;
  to?:   Date;
}

export const analyticsRepository = {
  getClosedTrades(userId: string, filters: AnalyticsFilters = {}) {
    return db.trade.findMany({
      where: {
        userId,
        isOpen: false,
        result: { not: null },
        ...((filters.from || filters.to) ? {
          closedAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to   ? { lte: filters.to }   : {}),
          },
        } : {}),
      },
      orderBy: { closedAt: "asc" },
      select: {
        id: true, symbol: true, displayName: true, category: true,
        emoji: true, side: true, lotSize: true, entryPrice: true,
        exitPrice: true, grossPnl: true, netPnl: true, commission: true,
        result: true, openedAt: true, closedAt: true, durationMs: true,
        closeReason: true, session: true, strategy: true, sl: true, tp: true,
      },
    });
  },

  getJournalEntries(userId: string, filters: AnalyticsFilters = {}) {
    return db.journalEntry.findMany({
      where: {
        userId,
        ...((filters.from || filters.to) ? {
          closedAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to   ? { lte: filters.to }   : {}),
          },
        } : {}),
      },
      orderBy: { closedAt: "asc" },
      select: {
        id: true, symbol: true, session: true, strategy: true,
        result: true, netPnl: true, closedAt: true,
        confidenceLevel: true, stressLevel: true, followedPlan: true,
        emotion: true, entryQuality: true, tags: true,
      },
    });
  },
};