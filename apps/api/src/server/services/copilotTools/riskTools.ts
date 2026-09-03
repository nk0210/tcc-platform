/**
 * Copilot Risk Tools
 * Thin wrapper over riskScoreService — no new business logic.
 *
 * This is the backend behavioral risk score (drawdown/consistency/
 * position-size/emotional/over-trading risk from closed-trade history) —
 * not the same thing as the frontend's separate live-exposure gauge
 * (store/riskStore.ts, based on currently open positions). Confirmed not a
 * duplicate in an earlier audit this session; this tool only ever touches
 * the backend service.
 */
import { z } from "zod";
import { riskScoreService } from "../riskScoreService";
import type { ToolDefinition } from "../copilotToolRegistry";

const GetRiskScoreArgs = z.object({});

const getRiskScore: ToolDefinition<z.infer<typeof GetRiskScoreArgs>> = {
  name:        "get_risk_score",
  description: "Get the authenticated user's TCC risk score (0-100, graded A-F): a behavioral analysis of their trading history covering drawdown risk, consistency, position sizing, emotional trading, and over-trading, with insights and recommendations. Requires at least 10 trades to be meaningful.",
  parameters:  GetRiskScoreArgs,
  jsonSchema:  { type: "object", properties: {}, additionalProperties: false },
  riskLevel:   "LOW",
  capability:  "trading.risk",
  readOnly:    true,
  async execute(_args, ctx) {
    return riskScoreService.calculateRiskScore(ctx.userId);
  },
};

export const riskTools: ToolDefinition[] = [getRiskScore as ToolDefinition];
