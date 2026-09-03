/**
 * Copilot Journal Tools
 * Thin wrappers over journalService — no new business logic.
 *
 * A `create_journal_entry` tool is intentionally NOT implemented: journal
 * entries are always auto-created as a side effect of
 * tradeService.closePosition() (there is no standalone "create a freeform
 * note" capability anywhere in the backend today — see
 * COPILOT_ASSESSMENT.md §6). Adding one requires a schema change that is
 * out of scope for this phase. update_journal_entry only edits fields the
 * existing journalService.updateEntry() already accepts — no new schema,
 * no new business logic, and it's MEDIUM risk (confirmation-protected) the
 * same way the watchlist write tools are.
 */
import { z } from "zod";
import { journalService } from "../journalService";
import type { ToolDefinition } from "../copilotToolRegistry";
import { optionalNullable, optionalNullableDefault, nullableJsonSchema } from "./zodHelpers";

const GetJournalEntriesArgs = z.object({
  limit:    optionalNullableDefault(z.number().int().min(1).max(50), 10),
  symbol:   optionalNullable(z.string().max(20)),
  strategy: optionalNullable(z.string().max(50)),
  /** Win/loss/breakeven outcome of the underlying trade. */
  result:   optionalNullable(z.enum(["WIN", "LOSS", "BREAKEVEN"])),
  emotion:  optionalNullable(z.string().max(50)),
  /** Jump straight to the journal entry for a specific trade (e.g. from a
   *  prior get_trade or get_trades call). */
  tradeId:  optionalNullable(z.string().max(50)),
  from:     optionalNullable(z.string().datetime()),
  to:       optionalNullable(z.string().datetime()),
});

const getJournalEntries: ToolDefinition<z.infer<typeof GetJournalEntriesArgs>> = {
  name:        "get_journal_entries",
  description: "Get the authenticated user's trade journal entries (auto-created when a paper trade closes) — includes the trader's recorded emotion, whether they followed their plan, notes, and lessons learned. Filter by symbol, strategy tag, outcome, emotion, a specific tradeId, or a closedAt date range (from/to, ISO 8601).",
  parameters:  GetJournalEntriesArgs,
  jsonSchema: {
    type: "object",
    properties: {
      limit:    nullableJsonSchema({ type: "integer", minimum: 1, maximum: 50, description: "Max entries to return, most recent first. Defaults to 10." }),
      symbol:   nullableJsonSchema({ type: "string", description: "Filter to a specific instrument symbol, e.g. BTCUSDT." }),
      strategy: nullableJsonSchema({ type: "string", description: "Filter to a specific strategy tag." }),
      result:   nullableJsonSchema({ type: "string", enum: ["WIN", "LOSS", "BREAKEVEN"], description: "Filter by the underlying trade's outcome, e.g. \"LOSS\" for losing trades." }),
      emotion:  nullableJsonSchema({ type: "string", description: "Filter to a specific recorded emotion, e.g. \"fearful\"." }),
      tradeId:  nullableJsonSchema({ type: "string", description: "Filter to the journal entry for one specific trade id." }),
      from:     nullableJsonSchema({ type: "string", format: "date-time", description: "Only entries closed on/after this timestamp." }),
      to:       nullableJsonSchema({ type: "string", format: "date-time", description: "Only entries closed on/before this timestamp." }),
    },
    additionalProperties: false,
  },
  riskLevel: "LOW",
  capability: "journal.entries",
  readOnly:  true,
  async execute(args, ctx) {
    const result = await journalService.getEntries(ctx.userId, {
      page:     1,
      pageSize: args.limit,
      symbol:   args.symbol,
      strategy: args.strategy,
      result:   args.result,
      emotion:  args.emotion,
      tradeId:  args.tradeId,
      from:     args.from ? new Date(args.from) : undefined,
      to:       args.to   ? new Date(args.to)   : undefined,
    });

    return {
      total: result.total,
      entries: result.items.map((e) => ({
        id:           e.id,
        tradeId:      e.tradeId,
        symbol:       e.symbol,
        side:         e.side,
        result:       e.result,
        netPnl:       e.netPnl,
        emotion:      e.emotion,
        followedPlan: e.followedPlan,
        strategy:     e.strategy,
        notes:        e.notes,
        lessonLearned: e.lessonLearned,
        closedAt:     e.closedAt,
      })),
    };
  },
};

// Only the reflective/behavioral fields a trader would plausibly ask
// Copilot to edit — deliberately narrower than journalService's full
// UpdateJournalInput (e.g. no marketStructure/session/timeframe/aiAnalysis,
// which are structural/system metadata, not something a chat request
// should be rewriting).
const UpdateJournalEntryArgs = z.object({
  entryId:         z.string().min(1),
  notes:           optionalNullable(z.string().max(2000)),
  lessonLearned:   optionalNullable(z.string().max(1000)),
  whatWentRight:   optionalNullable(z.string().max(1000)),
  whatWentWrong:   optionalNullable(z.string().max(1000)),
  emotion:         optionalNullable(z.string().max(50)),
  confidenceLevel: optionalNullable(z.number().int().min(1).max(10)),
  stressLevel:     optionalNullable(z.number().int().min(1).max(10)),
  followedPlan:    optionalNullable(z.boolean()),
  strategy:        optionalNullable(z.string().max(50)),
  entryQuality:    optionalNullable(z.string().max(50)),
  tags:            optionalNullable(z.array(z.string().max(30)).max(10)),
});

const EDITABLE_FIELDS = [
  "notes", "lessonLearned", "whatWentRight", "whatWentWrong", "emotion",
  "confidenceLevel", "stressLevel", "followedPlan", "strategy", "entryQuality", "tags",
] as const;

function pickEditedFields(args: z.infer<typeof UpdateJournalEntryArgs>) {
  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (args[key] !== undefined) updates[key] = args[key];
  }
  return updates;
}

const updateJournalEntry: ToolDefinition<z.infer<typeof UpdateJournalEntryArgs>> = {
  name:        "update_journal_entry",
  description: "Update one of the authenticated user's existing journal entries — notes, lesson learned, what went right/wrong, emotion, confidence/stress level, whether they followed their plan, strategy tag, entry quality, or tags. Get the entryId from get_journal_entries first. Provide only the fields being changed.",
  parameters:  UpdateJournalEntryArgs,
  jsonSchema: {
    type: "object",
    properties: {
      entryId:         { type: "string", description: "The id of the journal entry to update, from get_journal_entries." },
      notes:           nullableJsonSchema({ type: "string", description: "Free-text notes about the trade." }),
      lessonLearned:   nullableJsonSchema({ type: "string", description: "The key lesson learned from this trade." }),
      whatWentRight:   nullableJsonSchema({ type: "string", description: "What went right in this trade." }),
      whatWentWrong:   nullableJsonSchema({ type: "string", description: "What went wrong in this trade." }),
      emotion:         nullableJsonSchema({ type: "string", description: "The trader's emotional state during the trade." }),
      confidenceLevel: nullableJsonSchema({ type: "integer", minimum: 1, maximum: 10, description: "Confidence level, 1-10." }),
      stressLevel:     nullableJsonSchema({ type: "integer", minimum: 1, maximum: 10, description: "Stress level, 1-10." }),
      followedPlan:    nullableJsonSchema({ type: "boolean", description: "Whether the trader followed their trading plan." }),
      strategy:        nullableJsonSchema({ type: "string", description: "Strategy tag for this trade." }),
      entryQuality:    nullableJsonSchema({ type: "string", description: "Quality rating of the trade entry." }),
      tags:            nullableJsonSchema({ type: "array", items: { type: "string" }, description: "Freeform tags for this entry." }),
    },
    required: ["entryId"],
    additionalProperties: false,
  },
  riskLevel: "MEDIUM",
  capability: "journal.entries",
  readOnly:  false,
  describeAction: (args) => {
    const fields = Object.keys(pickEditedFields(args));
    return fields.length > 0
      ? `Update this journal entry's ${fields.join(", ")}?`
      : "Update this journal entry?";
  },
  describeResult: () => "Updated your journal entry.",
  async execute(args, ctx) {
    const updates = pickEditedFields(args);
    if (Object.keys(updates).length === 0) {
      throw new Error("No fields were provided to update.");
    }
    // journalService.updateEntry() re-verifies ownership (findById(id,
    // userId)) before writing — same as every other tool, it inherits
    // authorization from the existing service rather than adding its own.
    const entry = await journalService.updateEntry(args.entryId, ctx.userId, updates);
    return { id: entry.id, symbol: entry.symbol, updatedFields: Object.keys(updates) };
  },
};

export const journalTools: ToolDefinition[] = [
  getJournalEntries as ToolDefinition,
  updateJournalEntry as ToolDefinition,
];
