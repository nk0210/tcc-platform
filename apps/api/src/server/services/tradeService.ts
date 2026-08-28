import {
  tradeRepository,
  type CreateTradeInput,
  type ListTradesParams,
} from "../repositories/tradeRepository";
import { send } from "../../websocket/connectionManager";
import type { CloseReason, TradeResult } from "@prisma/client";

export const PAPER_INITIAL_BALANCE = 10_000;
export const COMMISSION_RATE       = 0.0001;

function detectSession(date: Date): string {
  const h = date.getUTCHours();
  if (h >= 22 || h < 2)  return "sydney";
  if (h >= 0  && h < 9)  return "asian";
  if (h >= 7  && h < 16) return "london";
  if (h >= 13 && h < 22) return "newyork";
  return "unknown";
}

function determineResult(netPnl: number): TradeResult {
  if (netPnl > 0.001)  return "WIN";
  if (netPnl < -0.001) return "LOSS";
  return "BREAKEVEN";
}

export const tradeService = {
  getOpenPositions: (userId: string) => tradeRepository.findOpenByUserId(userId),

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

  openPosition: (userId: string, input: CreateTradeInput) =>
    tradeRepository.create({ ...input, userId }),

  async updateSLTP(id: string, userId: string, sl?: number | null, tp?: number | null) {
    const trade = await tradeRepository.findById(id, userId);
    if (!trade)        throw new Error("TRADE_NOT_FOUND");
    if (!trade.isOpen) throw new Error("TRADE_ALREADY_CLOSED");
    return tradeRepository.updateSLTP(id, { sl, tp });
  },

  async closePosition(
    id:     string,
    userId: string,
    input:  { exitPrice: number; closeReason: CloseReason; grossPnl: number; durationMs: number }
  ) {
    const trade = await tradeRepository.findById(id, userId);
    if (!trade)        throw new Error("TRADE_NOT_FOUND");
    if (!trade.isOpen) throw new Error("TRADE_ALREADY_CLOSED");

    const commission = Math.abs(input.grossPnl) * COMMISSION_RATE;
    const netPnl     = input.grossPnl - commission;
    const result     = determineResult(netPnl);
    const closedAt   = new Date();

    const { trade: closedTrade, journalEntry } = await tradeRepository.close(id, userId, {
      exitPrice:   input.exitPrice,
      closeReason: input.closeReason,
      grossPnl:    parseFloat(input.grossPnl.toFixed(6)),
      commission:  parseFloat(commission.toFixed(6)),
      netPnl:      parseFloat(netPnl.toFixed(6)),
      durationMs:  input.durationMs,
      result,
      closedAt,
      session:     detectSession(closedAt),
    });

    const totalPnl = await tradeRepository.sumClosedNetPnl(userId);
    const balance  = parseFloat((PAPER_INITIAL_BALANCE + totalPnl).toFixed(6));

    await tradeRepository.saveSnapshot(userId, {
      balance,
      equity:      balance,
      floatingPnl: 0,
      marginUsed:  0,
      freeMargin:  balance,
    });

    send(userId, {
      type: "TRADE_CLOSED",
      payload: {
        tradeId:    closedTrade.id,
        netPnl:     closedTrade.netPnl ?? 0,
        result:     closedTrade.result ?? "BREAKEVEN",
        newBalance: balance,
      },
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
    if (snapshot) return snapshot;
    return { balance, equity: balance, floatingPnl: 0, marginUsed: 0, freeMargin: balance, marginLevel: null };
  },

  saveAccountSnapshot: (
    userId: string,
    data: { balance: number; equity: number; floatingPnl: number; marginUsed: number; freeMargin: number; marginLevel?: number | null }
  ) => tradeRepository.saveSnapshot(userId, data),
};