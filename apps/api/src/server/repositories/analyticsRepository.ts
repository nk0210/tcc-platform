/**
 * TCC Analytics Repository — sole Prisma layer for analytics aggregations.
 * All statistics are computed from the Trade and JournalEntry tables.
 */
import db from "../../lib/prisma";

export interface AnalyticsFilters {
  from?: Date;
  to?:   Date;
}

export const analyticsRepository = {
  // Fetch all closed trades needed for analytics computation
  getClosedTrades(userId: string, filters: AnalyticsFilters = {}) {
    return db.trade.findMany({
      where: {
        userId,
        isOpen: false,
        result: { not: null },
        ...(filters.from || filters.to ? {
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

  // Journal entries for session/reflection analytics
  getJournalEntries(userId: string, filters: AnalyticsFilters = {}) {
    return db.journalEntry.findMany({
      where: {
        userId,
        ...(filters.from || filters.to ? {
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

  // Aggregate totals for quick overview
  async aggregateTotals(userId: string) {
    return db.trade.aggregate({
      where: { userId, isOpen: false },
      _sum:   { netPnl: true, grossPnl: true, commission: true },
      _count: { id: true },
      _avg:   { netPnl: true },
    });
  },

  // Count by result for win rate
  async countByResult(userId: string) {
    return db.trade.groupBy({
      by:    ["result"],
      where: { userId, isOpen: false, result: { not: null } },
      _count: { id: true },
    });
  },

  // Monthly aggregation
  async getMonthlyPnl(userId: string, year: number) {
    const start = new Date(year, 0, 1);
    const end   = new Date(year + 1, 0, 1);
    const trades = await db.trade.findMany({
      where: {
        userId,
        isOpen: false,
        closedAt: { gte: start, lt: end },
        result: { not: null },
      },
      select: { closedAt: true, netPnl: true, result: true },
      orderBy: { closedAt: "asc" },
    });
    return trades;
  },

  // Symbol aggregation
  async getSymbolStats(userId: string) {
    return db.trade.groupBy({
      by:    ["symbol", "displayName"],
      where: { userId, isOpen: false, result: { not: null } },
      _count:  { id: true },
      _sum:    { netPnl: true, grossPnl: true },
      _avg:    { netPnl: true },
    });
  },
};