/**
 * Copilot Analytics Tools
 * Thin wrapper over analyticsService — no new business logic.
 */
import { z } from "zod";
import { analyticsService } from "../analyticsService";
import type { ToolDefinition } from "../copilotToolRegistry";
import { optionalNullable, nullableJsonSchema } from "./zodHelpers";

// All three tools below take the same optional date range — shared schema
// and JSON Schema properties so the three don't drift out of sync.
const DateRangeArgs = z.object({
  from: optionalNullable(z.string().datetime()),
  to:   optionalNullable(z.string().datetime()),
});

const dateRangeProperties = {
  from: nullableJsonSchema({ type: "string", format: "date-time", description: "Start of the date range (ISO 8601). Omit for all-time." }),
  to:   nullableJsonSchema({ type: "string", format: "date-time", description: "End of the date range (ISO 8601). Omit for all-time." }),
};

function toDateFilter(args: z.infer<typeof DateRangeArgs>) {
  return {
    from: args.from ? new Date(args.from) : undefined,
    to:   args.to   ? new Date(args.to)   : undefined,
  };
}

const getTradingAnalytics: ToolDefinition<z.infer<typeof DateRangeArgs>> = {
  name:        "get_trading_analytics",
  description: "Get the authenticated user's aggregate trading performance: total trades, win rate, profit factor, average win/loss, net P&L, ROI, best/worst trade, max drawdown. Optionally restrict to a date range (e.g. \"this month\") via `from`/`to` ISO 8601 timestamps; omit both for all-time performance. To compare two periods (e.g. this month vs last month), call this tool twice with different date ranges.",
  parameters:  DateRangeArgs,
  jsonSchema: {
    type: "object",
    properties: dateRangeProperties,
    additionalProperties: false,
  },
  riskLevel: "LOW",
  capability: "trading.analytics",
  readOnly:  true,
  async execute(args, ctx) {
    return analyticsService.getOverview(ctx.userId, toDateFilter(args));
  },
};

const getInstrumentPerformance: ToolDefinition<z.infer<typeof DateRangeArgs>> = {
  name:        "get_instrument_performance",
  description: "Get the authenticated user's closed-trade performance broken down by instrument/symbol (trades, win rate, net P&L, best/worst trade per symbol), sorted best net P&L first. Optionally restrict to a date range via `from`/`to` ISO 8601 timestamps.",
  parameters:  DateRangeArgs,
  jsonSchema: {
    type: "object",
    properties: dateRangeProperties,
    additionalProperties: false,
  },
  riskLevel: "LOW",
  capability: "trading.analytics",
  readOnly:  true,
  async execute(args, ctx) {
    const bySymbol = await analyticsService.getSymbolStats(ctx.userId, toDateFilter(args));
    return { instruments: bySymbol };
  },
};

const getStrategyPerformance: ToolDefinition<z.infer<typeof DateRangeArgs>> = {
  name:        "get_strategy_performance",
  description: "Get the authenticated user's performance broken down by the strategy tag recorded on their journal entries (trades, win rate, net P&L per strategy), sorted best net P&L first. Entries with no strategy tag are grouped as \"unspecified\". Optionally restrict to a date range via `from`/`to` ISO 8601 timestamps.",
  parameters:  DateRangeArgs,
  jsonSchema: {
    type: "object",
    properties: dateRangeProperties,
    additionalProperties: false,
  },
  riskLevel: "LOW",
  capability: "trading.analytics",
  readOnly:  true,
  async execute(args, ctx) {
    const byStrategy = await analyticsService.getStrategyStats(ctx.userId, toDateFilter(args));
    return { strategies: byStrategy };
  },
};

export const analyticsTools: ToolDefinition[] = [
  getTradingAnalytics as ToolDefinition,
  getInstrumentPerformance as ToolDefinition,
  getStrategyPerformance as ToolDefinition,
];
