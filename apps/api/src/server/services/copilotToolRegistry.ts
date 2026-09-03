/**
 * Copilot Tool Registry
 *
 * The ONLY way the agent loop (copilotAgentService.ts) can touch TCC data.
 * The model never gets database access, never generates SQL, and never
 * calls a TCC service directly — it can only request one of the tools
 * registered here by name, with arguments that get Zod-validated before
 * anything runs.
 *
 * Security boundary (non-negotiable, per the Copilot spec):
 *   - `userId` is never a tool parameter. It always comes from the
 *     authenticated request's AuthRequest.userId, injected by the agent
 *     loop at execute() time — never from the model's arguments object.
 *   - Same treatment for `riskLevel`, `permission(s)`, and any ownership-
 *     scope-shaped key (`ownerId`/`ownerUserId`) — a tool's risk level is
 *     fixed on its ToolDefinition at registration time and its permissions
 *     are whatever the underlying TCC service already enforces; neither is
 *     ever something the model gets to negotiate via arguments. `registerTool()`
 *     enforces all of this: if a tool's own Zod schema declares any of
 *     these keys, registration throws immediately (Phase 9).
 *   - Every tool calls into an existing TCC service (tradeService,
 *     journalService, ...), which already scopes every query to the given
 *     userId — the same ownership model every existing route uses. Tools
 *     add no new authorization logic; they inherit it.
 *   - Unknown tool names, and arguments that fail Zod validation, are
 *     rejected before any service is touched.
 *
 * Phase 9: `capability` and `readOnly` are optional organizational metadata
 * — see COPILOT_CAPABILITY_MAP.md for the full module/capability breakdown.
 * They exist for documentation, registry introspection, and observability
 * only; they carry zero authorization weight (that's `riskLevel` alone, as
 * always) and every tool written before Phase 9 compiles unchanged without
 * them.
 */
import type { ZodType, ZodTypeDef } from "zod";
import type { AIToolSpec } from "./copilotAiProvider";

export type CopilotRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ToolExecutionContext {
  userId: string;
}

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  name:        string;
  description: string;
  /** Validates model-supplied arguments before execute() ever runs.
   *  Input type is left loose (not pinned to TArgs) so schemas using
   *  `.default(...)` — whose pre-parse input is more permissive than their
   *  post-parse output — type-check normally; `safeParse()` still enforces
   *  the real shape at runtime regardless. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters:  ZodType<TArgs, ZodTypeDef, any>;
  /** JSON Schema shown to the model — kept separate from `parameters`
   *  (rather than derived from it) so tool schemas stay simple, explicit,
   *  and dependency-free; every current tool's shape is small enough that
   *  writing both by hand is trivial and there's no drift risk worth
   *  pulling in a zod-to-json-schema dependency for. */
  jsonSchema:  Record<string, unknown>;
  /** LOW = safe to auto-execute. MEDIUM/HIGH = must go through the
   *  confirmation flow (copilotActionService.ts) before executing — the
   *  agent loop never runs a non-LOW tool directly, no matter what the
   *  model requests. */
  riskLevel:   CopilotRiskLevel;
  execute: (args: TArgs, ctx: ToolExecutionContext) => Promise<TResult>;
  /** Required for MEDIUM/HIGH tools: a human-readable, app-authored
   *  description of the action for the confirmation prompt — e.g. "Add
   *  XAUUSD to your watchlist?". Built from validated args only, never
   *  model-authored text, so a compromised model can't smuggle arbitrary
   *  copy into what the user is asked to confirm. Ignored for LOW tools. */
  describeAction?: (args: TArgs) => string;
  /** Optional: a human-readable summary of the result after a confirmed
   *  action executes — e.g. "Added XAUUSD to your watchlist." Falls back to
   *  a generic message if omitted. */
  describeResult?: (result: TResult, args: TArgs) => string;
  /** Organizational metadata only (Phase 9) — a short dotted path grouping
   *  this tool with its TCC capability area, e.g. "trading.trades",
   *  "community.posts", "copy_trading.relationships". See
   *  COPILOT_CAPABILITY_MAP.md. Never used for any authorization decision. */
  capability?: string;
  /** Organizational metadata only (Phase 9) — true if this tool never
   *  mutates TCC data. Documentation/observability convenience; the actual
   *  auto-execute-vs-confirm decision is always `riskLevel` alone, exactly
   *  as before this field existed. */
  readOnly?: boolean;
}

/** Keys the model must never be able to supply as a tool argument — each
 *  one is either an authorization primitive (userId, ownership scope) or a
 *  security decision (risk level, permission) that belongs solely to the
 *  application, never to the model's request. Checked against every tool's
 *  own Zod schema at registration time, below. */
const FORBIDDEN_ARG_KEYS = ["userId", "riskLevel", "permission", "permissions", "ownerId", "ownerUserId"] as const;

const registry = new Map<string, ToolDefinition>();

export function registerTool<TArgs, TResult>(tool: ToolDefinition<TArgs, TResult>): void {
  const shape = (tool.parameters as unknown as { shape?: Record<string, unknown> }).shape;
  if (shape) {
    const forbidden = FORBIDDEN_ARG_KEYS.filter((key) => key in shape);
    if (forbidden.length > 0) {
      throw new Error(
        `[copilotToolRegistry] Tool "${tool.name}" declares forbidden parameter(s): ${forbidden.join(", ")}. ` +
        `userId, riskLevel, and permission/ownership scope must never be model-supplied arguments — ` +
        `userId is injected from the authenticated request context, and risk level/permissions are fixed ` +
        `on the tool definition itself, never negotiated via arguments.`
      );
    }
  }
  if (registry.has(tool.name)) {
    throw new Error(`[copilotToolRegistry] Tool "${tool.name}" is already registered.`);
  }
  if (tool.riskLevel !== "LOW" && !tool.describeAction) {
    throw new Error(
      `[copilotToolRegistry] Tool "${tool.name}" is ${tool.riskLevel}-risk but has no ` +
      `describeAction() — a confirmation prompt cannot be generated for it.`
    );
  }
  registry.set(tool.name, tool as ToolDefinition);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function listTools(): ToolDefinition[] {
  return Array.from(registry.values());
}

/** Tool specs in the shape AIProvider.complete() expects. */
export function listToolSpecsForProvider(): AIToolSpec[] {
  return listTools().map((t) => ({
    name:        t.name,
    description: t.description,
    parameters:  t.jsonSchema,
  }));
}

/** Test-only escape hatch — production code never needs to clear the registry. */
export function __resetRegistryForTests(): void {
  registry.clear();
}
