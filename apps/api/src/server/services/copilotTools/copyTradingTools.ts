/**
 * Copilot Copy Trading Tools — Phase 9
 * Thin wrappers over copyTradingService — no new business logic. See
 * COPILOT_CAPABILITY_MAP.md for the full audit.
 *
 * Deliberately excluded: master-trader application tools (apply/edit/
 * submit) — a KYC-flavored onboarding flow with legal-disclosure
 * checkboxes better handled in the dedicated UI than a chat action — and
 * every admin moderation function (review/approve/reject applications,
 * suspend/remove masters). None of the tools below ever accept or produce
 * a `mode` argument: every relationship copyTradingService creates is
 * PAPER_COPY only (the service itself never passes `mode: "LIVE_COPY"`
 * anywhere), consistent with this being a paper-trading platform.
 */
import { z } from "zod";
import { copyTradingService } from "../copyTradingService";
import { optionalNullable, optionalNullableDefault, nullableJsonSchema } from "./zodHelpers";
import type { ToolDefinition } from "../copilotToolRegistry";

const COPY_LOT_MODES = ["FIXED_LOT", "RISK_MULTIPLIER", "EQUITY_RATIO"] as const;

const RiskSettingsShape = {
  maxRiskPerTradePercent:  optionalNullable(z.number().min(0).max(100)),
  maxDailyLossPercent:     optionalNullable(z.number().min(0).max(100)),
  maxTotalDrawdownPercent: optionalNullable(z.number().min(0).max(100)),
  maxOpenCopiedTrades:     optionalNullable(z.number().int().min(1).max(50)),
  copyLotMode:             optionalNullable(z.enum(COPY_LOT_MODES)),
  fixedLotSize:            optionalNullable(z.number().min(0.01)),
  riskMultiplier:          optionalNullable(z.number().min(0)),
  maxSlippagePoints:       optionalNullable(z.number().min(0)),
  requireStopLoss:         optionalNullable(z.boolean()),
  newsFilterEnabled:       optionalNullable(z.boolean()),
};

const riskSettingsProperties = {
  maxRiskPerTradePercent:  nullableJsonSchema({ type: "number", description: "Max % of equity risked per copied trade (0-100)." }),
  maxDailyLossPercent:     nullableJsonSchema({ type: "number", description: "Max % daily loss before copying pauses (0-100)." }),
  maxTotalDrawdownPercent: nullableJsonSchema({ type: "number", description: "Max % total drawdown before copying pauses (0-100)." }),
  maxOpenCopiedTrades:     nullableJsonSchema({ type: "integer", minimum: 1, maximum: 50, description: "Max simultaneously open copied trades." }),
  copyLotMode:             nullableJsonSchema({ type: "string", enum: [...COPY_LOT_MODES], description: "How copied lot size is calculated." }),
  fixedLotSize:            nullableJsonSchema({ type: "number", description: "Fixed lot size, if copyLotMode is FIXED_LOT." }),
  riskMultiplier:          nullableJsonSchema({ type: "number", description: "Risk multiplier, if copyLotMode is RISK_MULTIPLIER." }),
  maxSlippagePoints:       nullableJsonSchema({ type: "number", description: "Max acceptable slippage in points." }),
  requireStopLoss:         nullableJsonSchema({ type: "boolean", description: "Require every copied trade to carry a stop loss." }),
  newsFilterEnabled:       nullableJsonSchema({ type: "boolean", description: "Skip copying trades opened around major news events." }),
};

function pickRiskSettings(args: Record<string, unknown>) {
  const settings: Record<string, unknown> = {};
  for (const key of Object.keys(RiskSettingsShape)) {
    if (args[key] !== undefined) settings[key] = args[key];
  }
  return settings;
}

// ── Reads ────────────────────────────────────────────────────────────────

const GetMasterTradersArgs = z.object({ limit: optionalNullableDefault(z.number().int().min(1).max(20), 10) });

const getMasterTraders: ToolDefinition<z.infer<typeof GetMasterTradersArgs>> = {
  name:        "get_master_traders",
  description: "Browse active TCC master traders available to copy — public profile stats only.",
  parameters:  GetMasterTradersArgs,
  jsonSchema: {
    type: "object",
    properties: { limit: nullableJsonSchema({ type: "integer", minimum: 1, maximum: 20, description: "Max results. Defaults to 10." }) },
    additionalProperties: false,
  },
  riskLevel: "LOW", capability: "copy_trading.masters", readOnly: true,
  async execute(args) {
    const result = await copyTradingService.getAllMasters({ page: 1, pageSize: args.limit });
    return { total: result.total, masters: result.items };
  },
};

const GetCopyRelationshipsArgs = z.object({ limit: optionalNullableDefault(z.number().int().min(1).max(20), 10) });

const getCopyRelationships: ToolDefinition<z.infer<typeof GetCopyRelationshipsArgs>> = {
  name:        "get_copy_relationships",
  description: "Get the authenticated user's own active copy-trading relationships (which master traders they're currently copying, and the risk settings on each).",
  parameters:  GetCopyRelationshipsArgs,
  jsonSchema: {
    type: "object",
    properties: { limit: nullableJsonSchema({ type: "integer", minimum: 1, maximum: 20, description: "Max results. Defaults to 10." }) },
    additionalProperties: false,
  },
  riskLevel: "LOW", capability: "copy_trading.relationships", readOnly: true,
  async execute(args, ctx) {
    const result = await copyTradingService.getMyRelationships(ctx.userId, { page: 1, pageSize: args.limit });
    return { total: result.total, relationships: result.items };
  },
};

const GetCopyHistoryArgs = z.object({ limit: optionalNullableDefault(z.number().int().min(1).max(30), 15) });

const getCopyHistory: ToolDefinition<z.infer<typeof GetCopyHistoryArgs>> = {
  name:        "get_copy_history",
  description: "Get the authenticated user's own copy-trade history — trades copied (or skipped/blocked, with why) from master traders.",
  parameters:  GetCopyHistoryArgs,
  jsonSchema: {
    type: "object",
    properties: { limit: nullableJsonSchema({ type: "integer", minimum: 1, maximum: 30, description: "Max results. Defaults to 15." }) },
    additionalProperties: false,
  },
  riskLevel: "LOW", capability: "copy_trading.relationships", readOnly: true,
  async execute(args, ctx) {
    // followerUserId is hardcoded to ctx.userId here, never model-supplied —
    // copyTradingRepository.findCopyHistory() itself has no built-in
    // scoping guarantee if this filter were omitted (see the Phase 9
    // capability-map audit), so this tool is the enforcement point.
    const result = await copyTradingService.getCopyHistory({ page: 1, pageSize: args.limit, followerUserId: ctx.userId });
    return { total: result.total, history: result.items };
  },
};

// ── Writes ───────────────────────────────────────────────────────────────

const StartCopyingArgs = z.object({ masterTraderId: z.string().min(1), ...RiskSettingsShape });

const startCopying: ToolDefinition<z.infer<typeof StartCopyingArgs>> = {
  name:        "start_copying",
  description: "Start (paper-)copying a master trader's trades, with optional risk settings. Get masterTraderId from get_master_traders. Requires the user's confirmation.",
  parameters:  StartCopyingArgs,
  jsonSchema: {
    type: "object",
    properties: { masterTraderId: { type: "string", description: "The master trader's id, from get_master_traders." }, ...riskSettingsProperties },
    required: ["masterTraderId"], additionalProperties: false,
  },
  riskLevel: "MEDIUM", capability: "copy_trading.relationships", readOnly: false,
  describeAction: (args) => `Start copying master trader ${args.masterTraderId}?`,
  describeResult: () => "Started copying.",
  async execute(args, ctx) {
    const relationship = await copyTradingService.startCopying(ctx.userId, args.masterTraderId, pickRiskSettings(args));
    return { id: relationship.id, status: relationship.status };
  },
};

const RelationshipIdArgs = z.object({ relationshipId: z.string().min(1) });
const relationshipIdProperty = { relationshipId: { type: "string", description: "The copy relationship's id, from get_copy_relationships." } };

const stopCopying: ToolDefinition<z.infer<typeof RelationshipIdArgs>> = {
  name:        "stop_copying",
  description: "Stop one of the authenticated user's copy-trading relationships. Requires the user's confirmation.",
  parameters:  RelationshipIdArgs,
  jsonSchema:  { type: "object", properties: relationshipIdProperty, required: ["relationshipId"], additionalProperties: false },
  riskLevel:   "MEDIUM", capability: "copy_trading.relationships", readOnly: false,
  describeAction: () => "Stop this copy-trading relationship?",
  describeResult: () => "Stopped copying.",
  async execute(args, ctx) {
    const relationship = await copyTradingService.stopCopying(ctx.userId, args.relationshipId);
    return { id: relationship.id, status: relationship.status };
  },
};

const pauseCopying: ToolDefinition<z.infer<typeof RelationshipIdArgs>> = {
  name:        "pause_copying",
  description: "Pause one of the authenticated user's active copy-trading relationships (can be resumed later). Requires the user's confirmation.",
  parameters:  RelationshipIdArgs,
  jsonSchema:  { type: "object", properties: relationshipIdProperty, required: ["relationshipId"], additionalProperties: false },
  riskLevel:   "MEDIUM", capability: "copy_trading.relationships", readOnly: false,
  describeAction: () => "Pause this copy-trading relationship?",
  describeResult: () => "Paused.",
  async execute(args, ctx) {
    const relationship = await copyTradingService.pauseCopying(ctx.userId, args.relationshipId);
    return { id: relationship.id, status: relationship.status };
  },
};

const resumeCopying: ToolDefinition<z.infer<typeof RelationshipIdArgs>> = {
  name:        "resume_copying",
  description: "Resume one of the authenticated user's paused copy-trading relationships. Requires the user's confirmation.",
  parameters:  RelationshipIdArgs,
  jsonSchema:  { type: "object", properties: relationshipIdProperty, required: ["relationshipId"], additionalProperties: false },
  riskLevel:   "MEDIUM", capability: "copy_trading.relationships", readOnly: false,
  describeAction: () => "Resume this copy-trading relationship?",
  describeResult: () => "Resumed.",
  async execute(args, ctx) {
    const relationship = await copyTradingService.resumeCopying(ctx.userId, args.relationshipId);
    return { id: relationship.id, status: relationship.status };
  },
};

const UpdateCopyRiskSettingsArgs = z.object({ relationshipId: z.string().min(1), ...RiskSettingsShape });

const updateCopyRiskSettings: ToolDefinition<z.infer<typeof UpdateCopyRiskSettingsArgs>> = {
  name:        "update_copy_risk_settings",
  description: "Update risk settings on one of the authenticated user's copy-trading relationships. Provide only the fields being changed. Requires the user's confirmation.",
  parameters:  UpdateCopyRiskSettingsArgs,
  jsonSchema: {
    type: "object",
    properties: { ...relationshipIdProperty, ...riskSettingsProperties },
    required: ["relationshipId"], additionalProperties: false,
  },
  riskLevel: "MEDIUM", capability: "copy_trading.relationships", readOnly: false,
  describeAction: (args) => {
    const fields = Object.keys(pickRiskSettings(args));
    return fields.length > 0 ? `Update this copy relationship's ${fields.join(", ")}?` : "Update this copy relationship's risk settings?";
  },
  describeResult: () => "Updated risk settings.",
  async execute(args, ctx) {
    const settings = pickRiskSettings(args);
    if (Object.keys(settings).length === 0) throw new Error("No risk-setting fields were provided to update.");
    const relationship = await copyTradingService.updateRiskSettings(ctx.userId, args.relationshipId, settings);
    return { id: relationship.id, updatedFields: Object.keys(settings) };
  },
};

export const copyTradingTools: ToolDefinition[] = [
  getMasterTraders as ToolDefinition,
  getCopyRelationships as ToolDefinition,
  getCopyHistory as ToolDefinition,
  startCopying as ToolDefinition,
  stopCopying as ToolDefinition,
  pauseCopying as ToolDefinition,
  resumeCopying as ToolDefinition,
  updateCopyRiskSettings as ToolDefinition,
];
