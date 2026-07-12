/**
 * TCC Watchlist Service — business logic for user watchlists.
 */
import { watchlistRepository, type WatchlistItemInput } from "../repositories/watchlistRepository";

export const watchlistService = {
  async getWatchlist(userId: string) {
    return watchlistRepository.findOrCreate(userId);
  },

  async addSymbol(userId: string, input: WatchlistItemInput) {
    return watchlistRepository.addItem(userId, input);
  },

  async removeSymbol(userId: string, symbol: string) {
    return watchlistRepository.removeItem(userId, symbol);
  },

  async clearWatchlist(userId: string) {
    return watchlistRepository.clearItems(userId);
  },

  async isInWatchlist(userId: string, symbol: string) {
    return watchlistRepository.isInWatchlist(userId, symbol);
  },
};