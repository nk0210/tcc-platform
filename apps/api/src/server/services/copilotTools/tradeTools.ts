/**
 * Copilot Trade Tools
 * Thin wrappers over tradeService — no new business logic.
 *
 * Phase 4 audit note: `strategy` is NOT a usable filter here even though
 * Trade.strategy exists in the schema — nothing in the app (openPosition,
 * closePosition, or their routes) ever writes to it, so every trade's
 * `strategy` is null and a filter on it would silently return nothing. The
 * real, populated strategy tag lives on JournalEntry (set via
 * update_journal_entry or the journal UI after a trade closes) — see
 * get_journal_entries and get_strategy_performance for strategy-based
 * questions instead. `side`, `result`, and date range ARE populated on
 * every closed trade and are exposed below.
 */
import { z } from "zod";
import { tradeService } from "../tradeService";
import type { ToolDefinition } from "../copilotToolRegistry";
import { optionalNullable, optionalNullableDefault, nullableJsonSchema } from "./zodHelpers";

const GetTradesArgs = z.object({
  status: optionalNullableDefault(z.enum(["open", "closed", "all"]), "all" as const),
  symbol: optionalNullable(z.string().max(20)),
  side:   optionalNullable(z.enum(["BUY", "SELL"])),
  /** Only meaningful for closed trades — an open position has no result yet. */
  result: optionalNullable(z.enum(["WIN", "LOSS", "BREAKEVEN"])),
  /** ISO 8601. Only applies to closed trades (filtered by closedAt). */
  from:   optionalNullable(z.string().datetime()),
  to:     optionalNullable(z.string().datetime()),
  limit:  optionalNullableDefault(z.number().int().min(1).max(50), 20),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trimTrade(t: any) {
  return {
    id:         t.id,
    symbol:     t.symbol,
    side:       t.side,
    lotSize:    t.lotSize,
    entryPrice: t.entryPrice,
    exitPrice:  t.exitPrice ?? null,
    netPnl:     t.netPnl ?? null,
    result:     t.result ?? null,
    strategy:   t.strategy ?? null,
    isOpen:     t.isOpen,
    openedAt:   t.openedAt,
    closedAt:   t.closedAt ?? null,
  };
}

const getTrades: ToolDefinition<z.infer<typeof GetTradesArgs>> = {
  name:        "get_trades",
  description: "Get the authenticated user's paper trades, most recent first. Use status to filter to open positions, closed trades, or both. Optionally filter by symbol, direction (side), outcome (result — closed trades only), and a closedAt date range (from/to — closed trades only, ISO 8601).",
  parameters:  GetTradesArgs,
  jsonSchema: {
    type: "object",
    properties: {
      status: nullableJsonSchema({ type: "string", enum: ["open", "closed", "all"], description: "Which trades to include. Defaults to \"all\"." }),
      symbol: nullableJsonSchema({ type: "string", description: "Filter to a specific instrument symbol, e.g. BTCUSDT." }),
      side:   nullableJsonSchema({ type: "string", enum: ["BUY", "SELL"], description: "Filter to a trade direction." }),
      result: nullableJsonSchema({ type: "string", enum: ["WIN", "LOSS", "BREAKEVEN"], description: "Filter closed trades by outcome, e.g. \"LOSS\" for losing trades." }),
      from:   nullableJsonSchema({ type: "string", format: "date-time", description: "Only closed trades on/after this closedAt timestamp." }),
      to:     nullableJsonSchema({ type: "string", format: "date-time", description: "Only closed trades on/before this closedAt timestamp." }),
      limit:  nullableJsonSchema({ type: "integer", minimum: 1, maximum: 50, description: "Max number of closed trades to return (open positions are never paginated). Defaults to 20." }),
    },
    additionalProperties: false,
  },
  riskLevel: "LOW",
  capability: "trading.trades",
  readOnly:  true,
  async execute(args, ctx) {
    const result: { open?: unknown[]; closed?: unknown[]; closedTotal?: number } = {};

    if (args.status === "open" || args.status === "all") {
      const open = await tradeService.getOpenPositions(ctx.userId);
      result.open = open
        .filter((t) => !args.symbol || t.symbol === args.symbol)
        .filter((t) => !args.side   || t.side === args.side)
        .map(trimTrade);
    }

    if (args.status === "closed" || args.status === "all") {
      const closed = await tradeService.getClosedTrades(ctx.userId, {
        page:     1,
        pageSize: args.limit,
        symbol:   args.symbol,
        side:     args.side,
        result:   args.result,
        from:     args.from ? new Date(args.from) : undefined,
        to:       args.to   ? new Date(args.to)   : undefined,
      });
      result.closed = closed.items.map(trimTrade);
      // Lets the model know when it's seeing a truncated page rather than
      // silently treating `limit` results as the whole picture.
      result.closedTotal = closed.total;
    }

    return result;
  },
};

const GetTradeArgs = z.object({
  tradeId: z.string().min(1),
});

const getTrade: ToolDefinition<z.infer<typeof GetTradeArgs>> = {
  name:        "get_trade",
  description: "Get one specific trade by its id (from get_trades) with full detail — entry/exit price, stop loss/take profit, P&L breakdown, duration, close reason. Use this to look into why a particular trade did what it did.",
  parameters:  GetTradeArgs,
  jsonSchema: {
    type: "object",
    properties: {
      tradeId: { type: "string", description: "The trade's id, from get_trades." },
    },
    required: ["tradeId"],
    additionalProperties: false,
  },
  riskLevel: "LOW",
  capability: "trading.trades",
  readOnly:  true,
  async execute(args, ctx) {
    // tradeService.getTradeById scopes by (id, userId) and throws
    // TRADE_NOT_FOUND if the trade doesn't exist OR belongs to someone
    // else — a model cannot fish for another user's trade by guessing ids.
    let trade;
    try {
      trade = await tradeService.getTradeById(args.tradeId, ctx.userId);
    } catch {
      throw new Error(`No trade found with id "${args.tradeId}".`);
    }
    return {
      id: trade.id, symbol: trade.symbol, displayName: trade.displayName, category: trade.category,
      side: trade.side, lotSize: trade.lotSize, leverage: trade.leverage,
      entryPrice: trade.entryPrice, exitPrice: trade.exitPrice, sl: trade.sl, tp: trade.tp,
      grossPnl: trade.grossPnl, commission: trade.commission, netPnl: trade.netPnl, result: trade.result,
      closeReason: trade.closeReason, session: trade.session, strategy: trade.strategy,
      isOpen: trade.isOpen, openedAt: trade.openedAt, closedAt: trade.closedAt, durationMs: trade.durationMs,
    };
  },
};

const GetAccountStateArgs = z.object({});

const getAccountState: ToolDefinition<z.infer<typeof GetAccountStateArgs>> = {
  name:        "get_account_state",
  description: "Get the authenticated user's current paper trading account state: balance, equity, floating P&L on open positions, margin used, and free margin.",
  parameters:  GetAccountStateArgs,
  jsonSchema:  { type: "object", properties: {}, additionalProperties: false },
  riskLevel:   "LOW",
  capability:  "trading.account",
  readOnly:    true,
  async execute(_args, ctx) {
    return tradeService.getAccountState(ctx.userId);
  },
};

export const tradeTools: ToolDefinition[] = [
  getTrades as ToolDefinition,
  getTrade as ToolDefinition,
  getAccountState as ToolDefinition,
];
