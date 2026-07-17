import db from "../../lib/prisma";
import type { Prisma, TradeSide, CloseReason, TradeResult } from "@prisma/client";

export interface CreateTradeInput {
  userId:        string;
  symbol:        string;
  displayName:   string;
  category:      string;
  emoji?:        string | null;
  side:          TradeSide;
  lotSize:       number;
  entryPrice:    number;
  sl?:           number | null;
  tp?:           number | null;
  marginUsed:    number;
  notionalValue: number;
  leverage:      number;
  openedAt?:     Date;
}

export interface CloseTradeInput {
  exitPrice:   number;
  closeReason: CloseReason;
  grossPnl:    number;
  commission:  number;
  netPnl:      number;
  durationMs:  number;
  result:      TradeResult;
  closedAt:    Date;
  session?:    string | null;
}

export interface ListTradesParams {
  page:     number;
  pageSize: number;
  symbol?:  string;
  side?:    TradeSide;
  from?:    Date;
  to?:      Date;
}

export const tradeRepository = {
  findOpenByUserId(userId: string) {
    return db.trade.findMany({
      where:   { userId, isOpen: true },
      orderBy: { openedAt: "desc" },
    });
  },

  async findClosedByUserId(userId: string, params: ListTradesParams) {
    const { page, pageSize, symbol, side, from, to } = params;
    const where: Prisma.TradeWhereInput = {
      userId,
      isOpen: false,
      ...(symbol ? { symbol } : {}),
      ...(side   ? { side }   : {}),
      ...((from || to) ? {
        closedAt: {
          ...(from ? { gte: from } : {}),
          ...(to   ? { lte: to }   : {}),
        },
      } : {}),
    };
    const [items, total] = await Promise.all([
      db.trade.findMany({
        where,
        orderBy: { closedAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      db.trade.count({ where }),
    ]);
    return { items, total };
  },

  findAllClosedByUserId(userId: string, from?: Date, to?: Date) {
    return db.trade.findMany({
      where: {
        userId,
        isOpen: false,
        ...((from || to) ? {
          closedAt: {
            ...(from ? { gte: from } : {}),
            ...(to   ? { lte: to }   : {}),
          },
        } : {}),
      },
      orderBy: { closedAt: "asc" },
    });
  },

  findById(id: string, userId: string) {
    return db.trade.findFirst({ where: { id, userId } });
  },

  create(input: CreateTradeInput) {
    return db.trade.create({
      data: {
        userId:        input.userId,
        mode:          "paper",
        symbol:        input.symbol,
        displayName:   input.displayName,
        category:      input.category,
        emoji:         input.emoji   ?? null,
        side:          input.side,
        lotSize:       input.lotSize,
        entryPrice:    input.entryPrice,
        currentPrice:  input.entryPrice,
        sl:            input.sl      ?? null,
        tp:            input.tp      ?? null,
        marginUsed:    input.marginUsed,
        notionalValue: input.notionalValue,
        leverage:      input.leverage,
        isOpen:        true,
        openedAt:      input.openedAt ?? new Date(),
      },
    });
  },

  updateSLTP(id: string, input: { sl?: number | null; tp?: number | null }) {
    return db.trade.update({
      where: { id },
      data:  {
        ...(input.sl !== undefined ? { sl: input.sl } : {}),
        ...(input.tp !== undefined ? { tp: input.tp } : {}),
      },
    });
  },

  async close(id: string, userId: string, input: CloseTradeInput) {
    return db.$transaction(async (tx) => {
      const trade = await tx.trade.findFirst({ where: { id, userId, isOpen: true } });
      if (!trade) throw new Error("TRADE_NOT_FOUND_OR_ALREADY_CLOSED");

      const updatedTrade = await tx.trade.update({
        where: { id },
        data:  {
          exitPrice:    input.exitPrice,
          currentPrice: input.exitPrice,
          grossPnl:     input.grossPnl,
          commission:   input.commission,
          netPnl:       input.netPnl,
          closeReason:  input.closeReason,
          result:       input.result,
          closedAt:     input.closedAt,
          durationMs:   input.durationMs,
          session:      input.session ?? null,
          isOpen:       false,
        },
      });

      const journalEntry = await tx.journalEntry.create({
        data: {
          userId,
          tradeId:     trade.id,
          symbol:      trade.symbol,
          displayName: trade.displayName,
          category:    trade.category ?? "crypto",
          emoji:       trade.emoji    ?? null,
          side:        trade.side,
          lotSize:     trade.lotSize,
          entryPrice:  trade.entryPrice,
          exitPrice:   input.exitPrice,
          grossPnl:    input.grossPnl,
          commission:  input.commission,
          netPnl:      input.netPnl,
          result:      input.result,
          openedAt:    trade.openedAt,
          closedAt:    input.closedAt,
          durationMs:  input.durationMs,
          closeReason: input.closeReason,
          sl:          trade.sl,
          tp:          trade.tp,
          session:     input.session ?? "unknown",
        },
      });

      return { trade: updatedTrade, journalEntry };
    });
  },

  async delete(id: string, userId: string) {
    const trade = await db.trade.findFirst({ where: { id, userId, isOpen: true } });
    if (!trade) throw new Error("TRADE_NOT_FOUND_OR_ALREADY_CLOSED");
    return db.trade.delete({ where: { id } });
  },

  getLatestSnapshot(userId: string) {
    return db.accountSnapshot.findFirst({
      where:   { userId },
      orderBy: { snapshotAt: "desc" },
    });
  },

  saveSnapshot(userId: string, data: {
    balance:      number;
    equity:       number;
    floatingPnl:  number;
    marginUsed:   number;
    freeMargin:   number;
    marginLevel?: number | null;
  }) {
    return db.accountSnapshot.create({ data: { userId, ...data } });
  },

  async sumClosedNetPnl(userId: string): Promise<number> {
    const result = await db.trade.aggregate({
      where: { userId, isOpen: false },
      _sum:  { netPnl: true },
    });
    return result._sum.netPnl ?? 0;
  },
};