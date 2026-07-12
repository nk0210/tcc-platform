/**
 * TCC Trade Service — business logic for paper trading.
 *
 * Handles:
 *   - Commission calculation (0.01% of |grossPnl|)
 *   - Balance accounting via AccountSnapshot
 *   - Result determination (WIN / LOSS / BREAKEVEN)
 *   - Session detection from trade open time
 *   - Full close flow in a single DB transaction
 */
import { tradeRepository, type CreateTradeInput, type ListTradesParams } from "../repositories/tradeRepository";
import type { CloseReason, TradeSide, TradeResult } from "@tcc/db";

export const PAPER_INITIAL_BALANCE = 10_000;
export const COMMISSION_RATE       = 0.0001; // 0.01%

// ── Helpers ───────────────────────────────────────────────────────────────

function determineResult(netPnl: number): TradeResult {
  if (netPnl > 0.001)  return "WIN";
  if (netPnl < -0.001) return "LOSS";
  return "BREAKEVEN";
}

function detectSession(date: Date = new Date()): string {
  const hour = date.getUTCHours();
  if (hour >= 22 || hour < 2)  return "sydney";
  if (hour >= 0  && hour < 9)  return "asian";
  if (hour >= 7  && hour < 16) return "london";
  if (hour >= 13 && hour < 22) return "newyork";
  return "unknown";
}

// ── Service ───────────────────────────────────────────────────────────────

export const tradeService = {
  async getOpenPositions(userId: string) {
    return tradeRepository.findOpenByUserId(userId);
  },

  async getClosedTrades(userId: string, params: ListTradesParams) {
    const { items, total } = await tradeRepository.findClosedByUserId(userId, params);
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

  async getTradeById(id: string, userId: string) {
    const trade = await tradeRepository.findById(id, userId);
    if (!trade) throw new Error("TRADE_NOT_FOUND");
    return trade;
  },

  async openPosition(userId: string, input: CreateTradeInput) {
    return tradeRepository.create(input);
  },

  async updateSLTP(id: string, userId: string, sl?: number | null, tp?: number | null) {
    const trade = await tradeRepository.findById(id, userId);
    if (!trade)         throw new Error("TRADE_NOT_FOUND");
    if (!trade.isOpen)  throw new Error("TRADE_ALREADY_CLOSED");
    return tradeRepository.updateSLTP(id, userId, { sl, tp });
  },

  async closePosition(
    id: string,
    userId: string,
    input: {
      exitPrice:   number;
      closeReason: CloseReason;
      grossPnl:    number;
      durationMs:  number;
    }
  ) {
    const trade = await tradeRepository.findById(id, userId);
    if (!trade)        throw new Error("TRADE_NOT_FOUND");
    if (!trade.isOpen) throw new Error("TRADE_ALREADY_CLOSED");

    const commission = Math.abs(input.grossPnl) * COMMISSION_RATE;
    const netPnl     = input.grossPnl - commission;
    const result     = determineResult(netPnl);
    const closedAt   = new Date();
    const session    = detectSession(closedAt);

    const { trade: closedTrade, journalEntry } = await tradeRepository.close(id, userId, {
      exitPrice:   input.exitPrice,
      closeReason: input.closeReason,
      grossPnl:    parseFloat(input.grossPnl.toFixed(6)),
      commission:  parseFloat(commission.toFixed(6)),
      netPnl:      parseFloat(netPnl.toFixed(6)),
      durationMs:  input.durationMs,
      result,
      closedAt,
      session,
    });

    // Update account snapshot
    const totalPnl     = await tradeRepository.sumClosedNetPnl(userId);
    const balance      = parseFloat((PAPER_INITIAL_BALANCE + totalPnl).toFixed(6));
    await tradeRepository.saveSnapshot(userId, {
      balance,
      equity:      balance, // floatingPnl = 0 at close time
      floatingPnl: 0,
      marginUsed:  0, // simplified — actual margin would need to sum all open trades
      freeMargin:  balance,
      marginLevel: null,
    });

    return { trade: closedTrade, journalEntry, newBalance: balance };
  },

  async deleteOpenTrade(id: string, userId: string) {
    return tradeRepository.delete(id, userId);
  },

  async getAccountState(userId: string) {
    const [snapshot, totalPnl] = await Promise.all([
      tradeRepository.getLatestSnapshot(userId),
      tradeRepository.sumClosedNetPnl(userId),
    ]);

    const balance = parseFloat((PAPER_INITIAL_BALANCE + totalPnl).toFixed(6));

    if (snapshot) {
      return snapshot;
    }

    return {
      balance,
      equity:      balance,
      floatingPnl: 0,
      marginUsed:  0,
      freeMargin:  balance,
      marginLevel: null,
    };
  },

  async saveAccountSnapshot(userId: string, data: {
    balance: number; equity: number; floatingPnl: number;
    marginUsed: number; freeMargin: number; marginLevel?: number | null;
  }) {
    return tradeRepository.saveSnapshot(userId, data);
  },
};