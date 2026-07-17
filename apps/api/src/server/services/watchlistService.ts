import { watchlistRepository, type WatchlistItemInput } from "../repositories/watchlistRepository";

export const watchlistService = {
  getWatchlist:    (userId: string)                     => watchlistRepository.findOrCreate(userId),
  addSymbol:       (userId: string, i: WatchlistItemInput) => watchlistRepository.addItem(userId, i),
  removeSymbol:    (userId: string, symbol: string)     => watchlistRepository.removeItem(userId, symbol),
  clearWatchlist:  (userId: string)                     => watchlistRepository.clearItems(userId),
  isInWatchlist:   (userId: string, symbol: string)     => watchlistRepository.isInWatchlist(userId, symbol),
};