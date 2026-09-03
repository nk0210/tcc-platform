/**
 * Copilot Watchlist Tools
 * Thin wrappers over watchlistService — no new business logic.
 *
 * add_watchlist_item / remove_watchlist_item are MEDIUM risk: they modify
 * the user's data, so the agent loop (copilotAgentService.ts) never runs
 * them directly — it creates a pending action and stops. Only
 * copilotActionService.confirmAction(), after the user explicitly
 * confirms, ever calls their execute().
 */
import { z } from "zod";
import { watchlistService } from "../watchlistService";
import { optionalNullable, nullableJsonSchema } from "./zodHelpers";
import type { ToolDefinition } from "../copilotToolRegistry";

const GetWatchlistArgs = z.object({});

const getWatchlist: ToolDefinition<z.infer<typeof GetWatchlistArgs>> = {
  name:        "get_watchlist",
  description: "Get the authenticated user's watchlist — the instruments they're tracking.",
  parameters:  GetWatchlistArgs,
  jsonSchema:  { type: "object", properties: {}, additionalProperties: false },
  riskLevel:   "LOW",
  capability:  "trading.watchlist",
  readOnly:    true,
  async execute(_args, ctx) {
    const watchlist = await watchlistService.getWatchlist(ctx.userId);
    return {
      items: watchlist.items.map((i) => ({
        symbol:      i.symbol,
        displayName: i.displayName,
        category:    i.category,
        addedAt:     i.addedAt,
      })),
    };
  },
};

const AddWatchlistItemArgs = z.object({
  symbol:      z.string().min(1).max(20),
  displayName: z.string().min(1).max(100),
  category:    z.string().min(1).max(50),
  emoji:       optionalNullable(z.string().max(10)),
});

const addWatchlistItem: ToolDefinition<z.infer<typeof AddWatchlistItemArgs>> = {
  name:        "add_watchlist_item",
  description: "Add an instrument to the authenticated user's watchlist. Requires the symbol (e.g. \"XAUUSD\"), a display name (e.g. \"Gold\"), and a category (e.g. \"Commodities\", \"Forex\", \"Crypto\", \"Indices\").",
  parameters:  AddWatchlistItemArgs,
  jsonSchema: {
    type: "object",
    properties: {
      symbol:      { type: "string", description: "Instrument symbol, e.g. XAUUSD, BTCUSDT, EURUSD." },
      displayName: { type: "string", description: "Human-readable name, e.g. Gold, Bitcoin, Euro/US Dollar." },
      category:    { type: "string", description: "Instrument category, e.g. Commodities, Crypto, Forex, Indices." },
      emoji:       nullableJsonSchema({ type: "string", description: "Optional emoji to represent the instrument." }),
    },
    required: ["symbol", "displayName", "category"],
    additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "trading.watchlist",
  readOnly:  false,
  describeAction: (args) => `Add ${args.symbol} (${args.displayName}) to your watchlist?`,
  describeResult: (_result, args) => `Added ${args.symbol} to your watchlist.`,
  async execute(args, ctx) {
    const item = await watchlistService.addSymbol(ctx.userId, {
      symbol:      args.symbol,
      displayName: args.displayName,
      category:    args.category,
      emoji:       args.emoji ?? null,
    });
    return {
      item: {
        symbol:      item.symbol,
        displayName: item.displayName,
        category:    item.category,
        addedAt:     item.addedAt,
      },
    };
  },
};

const RemoveWatchlistItemArgs = z.object({
  symbol: z.string().min(1).max(20),
});

const removeWatchlistItem: ToolDefinition<z.infer<typeof RemoveWatchlistItemArgs>> = {
  name:        "remove_watchlist_item",
  description: "Remove an instrument from the authenticated user's watchlist by symbol.",
  parameters:  RemoveWatchlistItemArgs,
  jsonSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Instrument symbol to remove, e.g. XAUUSD." },
    },
    required: ["symbol"],
    additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "trading.watchlist",
  readOnly:  false,
  describeAction: (args) => `Remove ${args.symbol} from your watchlist?`,
  describeResult: (result, args) =>
    (result as { wasPresent: boolean }).wasPresent
      ? `Removed ${args.symbol} from your watchlist.`
      : `${args.symbol} wasn't on your watchlist — nothing to remove.`,
  async execute(args, ctx) {
    // Re-check current state at execution time rather than trusting
    // whatever was true when the action was proposed (state may have
    // changed while the confirmation was pending) — reports back plainly
    // instead of pretending a no-op removal was a real change.
    const wasPresent = await watchlistService.isInWatchlist(ctx.userId, args.symbol);
    await watchlistService.removeSymbol(ctx.userId, args.symbol);
    return { symbol: args.symbol, wasPresent };
  },
};

export const watchlistTools: ToolDefinition[] = [
  getWatchlist as ToolDefinition,
  addWatchlistItem as ToolDefinition,
  removeWatchlistItem as ToolDefinition,
];
