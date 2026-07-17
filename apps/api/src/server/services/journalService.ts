import { journalRepository, type UpdateJournalInput, type ListJournalParams } from "../repositories/journalRepository";

export const journalService = {
  async getEntries(userId: string, params: ListJournalParams) {
    const { items, total } = await journalRepository.findByUserId(userId, params);
    return {
      items,
      total,
      page:       params.page,
      pageSize:   params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
      hasNext:    params.page * params.pageSize < total,
      hasPrev:    params.page > 1,
    };
  },

  async getEntryById(id: string, userId: string) {
    const entry = await journalRepository.findById(id, userId);
    if (!entry) throw new Error("JOURNAL_ENTRY_NOT_FOUND");
    return entry;
  },

  async getEntryByTradeId(tradeId: string, userId: string) {
    const entry = await journalRepository.findByTradeId(tradeId, userId);
    if (!entry) throw new Error("JOURNAL_ENTRY_NOT_FOUND");
    return entry;
  },

  async updateEntry(id: string, userId: string, input: UpdateJournalInput) {
    const entry = await journalRepository.findById(id, userId);
    if (!entry) throw new Error("JOURNAL_ENTRY_NOT_FOUND");
    return journalRepository.update(id, input);
  },
};