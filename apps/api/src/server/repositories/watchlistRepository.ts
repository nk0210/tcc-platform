/**
 * TCC Watchlist Repository — sole Prisma layer for Watchlist + WatchlistItem.
 */
import db from "../../lib/prisma";

export interface WatchlistItemInput {
  symbol:      string;
  displayName: string;
  category:    string;
  emoji?:      string;
}

export const watchlistRepository = {
  // Find or create the user's watchlist
  async findOrCreate(userId: string) {
    const existing = await db.watchlist.findUnique({
      where:   { userId },
      include: { items: { orderBy: { addedAt: "desc" } } },
    });
    if (existing) return existing;

    return db.watchlist.create({
      data:    { userId },
      include: { items: { orderBy: { addedAt: "desc" } } },
    });
  },

  findByUserId(userId: string) {
    return db.watchlist.findUnique({
      where:   { userId },
      include: { items: { orderBy: { addedAt: "desc" } } },
    });
  },

  async addItem(userId: string, input: WatchlistItemInput) {
    const watchlist = await this.findOrCreate(userId);
    return db.watchlistItem.upsert({
      where: {
        watchlistId_symbol: { watchlistId: watchlist.id, symbol: input.symbol },
      },
      create: {
        watchlistId: watchlist.id,
        symbol:      input.symbol,
        displayName: input.displayName,
        category:    input.category,
        emoji:       input.emoji ?? null,
      },
      update: {
        displayName: input.displayName,
        category:    input.category,
        emoji:       input.emoji ?? null,
      },
    });
  },

  async removeItem(userId: string, symbol: string) {
    const watchlist = await db.watchlist.findUnique({ where: { userId } });
    if (!watchlist) return null;
    return db.watchlistItem.deleteMany({
      where: { watchlistId: watchlist.id, symbol },
    });
  },

  async clearItems(userId: string) {
    const watchlist = await db.watchlist.findUnique({ where: { userId } });
    if (!watchlist) return null;
    return db.watchlistItem.deleteMany({
      where: { watchlistId: watchlist.id },
    });
  },

  async isInWatchlist(userId: string, symbol: string): Promise<boolean> {
    const watchlist = await db.watchlist.findUnique({ where: { userId } });
    if (!watchlist) return false;
    const item = await db.watchlistItem.findUnique({
      where: { watchlistId_symbol: { watchlistId: watchlist.id, symbol } },
    });
    return !!item;
  },
};