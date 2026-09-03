/**
 * Copilot Agent Service
 *
 * The bounded tool-calling loop: ask the model for a response, and if it
 * requests tools, validate + execute them (LOW risk only — see
 * copilotToolRegistry.ts) and feed the results back, repeating until the
 * model gives a final answer or MAX_AGENT_STEPS is hit. The model never
 * touches TCC data directly; every tool call passes through Zod validation
 * and an authenticated userId injected by this loop, never supplied by the
 * model (see copilotToolRegistry.ts's registerTool()).
 *
 * Phase 5: provider retry/backoff/timeout now lives entirely inside
 * getAIProvider()'s ReliableAIProvider (copilotAiProvider.ts) — this loop
 * calls provider.complete() exactly once per iteration and simply reacts to
 * whatever it resolves or throws. That single call boundary is also what
 * guarantees a provider retry can never execute a tool twice: retries only
 * ever happen before a tool-call decision exists, never after (see
 * ReliableAIProvider's doc comment for the full argument).
 */
import { randomUUID } from "crypto";
import { getEnv } from "../../config/env";
import { getAIProvider, AIProviderNotConfiguredError, type AIMessage } from "./copilotAiProvider";
import { getTool, listToolSpecsForProvider, type CopilotRiskLevel } from "./copilotToolRegistry";
import { registerAllCopilotTools } from "./copilotTools";
import { withTimeout } from "./copilotUtil";
import { recordAgentTurn, type AgentTurnLogEntry } from "./copilotObservability";

registerAllCopilotTools();

/** Hard ceiling on model↔tool round-trips for a single user message. Keeps
 *  cost bounded and makes an infinite tool loop structurally impossible —
 *  the loop always terminates within this many iterations regardless of
 *  what the model does. Configurable via COPILOT_MAX_AGENT_STEPS (see
 *  config/env.ts); read lazily so tests can rely on the env-parsed default
 *  without needing a real Groq key to import this module. */
export function getMaxAgentSteps(): number {
  return Number(getEnv().COPILOT_MAX_AGENT_STEPS);
}

// Frozen at import time for the existing tests/call sites that reference it
// as a constant; getMaxAgentSteps() above is the source of truth the loop
// itself uses on every run.
export const MAX_AGENT_STEPS = getMaxAgentSteps();

function toolTimeoutMs(): number {
  return Number(getEnv().COPILOT_TOOL_TIMEOUT_MS);
}

export type AgentStepStatus = "EXECUTED" | "FAILED" | "REJECTED" | "PENDING_CONFIRMATION";

export interface AgentStepLog {
  toolName:     string;
  input:        unknown;
  output?:      unknown;
  status:       AgentStepStatus;
  errorMessage?: string;
  durationMs:   number;
  riskLevel:    CopilotRiskLevel;
  /** Only set when status is PENDING_CONFIRMATION — see
   *  copilotActionService.ts for what happens after this expires. */
  expiresAt?:   Date;
}

export interface AgentResult {
  finalMessage: string;
  steps:        AgentStepLog[];
  tokensUsed:   number;
  model:        string | null;
  /** How many agent-loop iterations this call consumed, counting from
   *  `startStep`. copilotActionService.ts threads this back in as the next
   *  call's `startStep` when resuming after a confirmation, so the overall
   *  step budget for one logical task is never reset just because it was
   *  paused for confirmation partway through. */
  stepsUsedSoFar: number;
}

export async function runAgent(params: {
  userId:       string;
  systemPrompt: string;
  /** Prior conversation turns (user/assistant text only — tool-call
   *  internals from past turns aren't replayed into a new turn). */
  history:      AIMessage[];
  userMessage:  string;
  /** Iteration count already consumed by an earlier, paused-for-
   *  confirmation call for the SAME logical task (see AgentResult.
   *  stepsUsedSoFar). Defaults to 0 for a fresh user message. This is the
   *  only thing that makes a "resumed" call different from a fresh one —
   *  everything else about the loop is identical, including the risk gate:
   *  a resumed call proposing another MEDIUM/HIGH tool pauses again exactly
   *  like a fresh one would. */
  startStep?:   number;
  /** Observability correlation only — never used for authorization or
   *  sent to the provider as anything but a log field. Optional so
   *  existing/test call sites keep compiling unchanged. */
  conversationId?: string;
}): Promise<AgentResult> {
  const provider = getAIProvider();
  const tools    = listToolSpecsForProvider();
  const steps: AgentStepLog[] = [];
  let tokensUsed = 0;
  let model: string | null = null;
  let providerCalls   = 0;
  let providerRetries = 0;
  const turnRequestId = randomUUID();
  const turnStart      = Date.now();

  const messages: AIMessage[] = [
    ...params.history,
    { role: "user", content: params.userMessage },
  ];

  const maxSteps = getMaxAgentSteps();

  /** Every return path goes through here so the turn-level observability
   *  line always gets written exactly once, regardless of which branch the
   *  loop exits from. */
  function finish(result: AgentResult, outcome: AgentTurnLogEntry["outcome"]): AgentResult {
    if (params.conversationId) {
      recordAgentTurn({
        requestId: turnRequestId, conversationId: params.conversationId, userId: params.userId,
        steps: result.steps.length, toolCalls: result.steps.length,
        providerCalls, providerRetries, tokensUsed: result.tokensUsed,
        durationMs: Date.now() - turnStart, outcome,
        // Names only, deduplicated — never arguments/results/reasoning.
        toolNames: Array.from(new Set(result.steps.map((s) => s.toolName))),
      });
    }
    return result;
  }

  for (let step = params.startStep ?? 0; step < maxSteps; step++) {
    let completion;
    try {
      completion = await provider.complete({
        systemPrompt: params.systemPrompt, messages, tools,
        metadata: { conversationId: params.conversationId, userId: params.userId },
      });
      providerCalls   += 1;
      providerRetries += completion.retries ?? 0;
    } catch (err) {
      providerCalls += 1;
      if (err instanceof AIProviderNotConfiguredError) throw err; // let the route return 503, same as today
      console.error("[copilotAgentService] provider failure:", err);
      return finish({
        finalMessage: "TCC Copilot is temporarily busy. Please try again in a moment.",
        steps,
        tokensUsed,
        model,
        stepsUsedSoFar: step + 1,
      }, "provider_unavailable");
    }

    tokensUsed += completion.tokensUsed;
    model = completion.model;

    if (!completion.toolCalls || completion.toolCalls.length === 0) {
      return finish({
        finalMessage: completion.content ?? "I don't have a response for that.",
        steps, tokensUsed, model, stepsUsedSoFar: step + 1,
      }, "completed");
    }

    messages.push({ role: "assistant", content: completion.content, toolCalls: completion.toolCalls });

    // Set the moment this turn proposes a MEDIUM/HIGH-risk action — the
    // model gets NO further say once that happens (no more provider calls
    // this turn, remaining tool calls in the same batch are skipped, not
    // executed). Only one pending action can come out of a single message;
    // this is a deliberate simplicity limit, not a structural one.
    let pendingConfirmationPrompt: string | null = null;

    for (const call of completion.toolCalls) {
      const start = Date.now();
      const tool  = getTool(call.name);

      if (pendingConfirmationPrompt) {
        // A previous call in this same batch already proposed an action
        // that needs confirmation — the turn is ending now, so any further
        // tool calls the model asked for this round are simply skipped
        // (never executed, never fed back to the model).
        steps.push({
          toolName: call.name, input: call.arguments, status: "REJECTED",
          errorMessage: "Skipped: a previous action in this message already requires confirmation.",
          durationMs: 0, riskLevel: tool?.riskLevel ?? "LOW",
        });
        continue;
      }

      if (!tool) {
        const errorMessage = `Unknown tool "${call.name}".`;
        steps.push({ toolName: call.name, input: call.arguments, status: "FAILED", errorMessage, durationMs: 0, riskLevel: "LOW" });
        messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify({ error: errorMessage }) });
        continue;
      }

      let rawArgs: unknown;
      try {
        rawArgs = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {
        const errorMessage = "Arguments were not valid JSON.";
        steps.push({ toolName: tool.name, input: call.arguments, status: "FAILED", errorMessage, durationMs: Date.now() - start, riskLevel: tool.riskLevel });
        messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify({ error: errorMessage }) });
        continue;
      }

      const validated = tool.parameters.safeParse(rawArgs);
      if (!validated.success) {
        const errorMessage = `Invalid arguments for "${tool.name}": ${validated.error.issues.map((i) => i.message).join("; ")}`;
        steps.push({ toolName: tool.name, input: rawArgs, status: "FAILED", errorMessage, durationMs: Date.now() - start, riskLevel: tool.riskLevel });
        messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify({ error: errorMessage }) });
        continue;
      }

      // Defense in depth: a model-supplied userId is never honored (see
      // copilotToolRegistry.registerTool, which also refuses to register
      // any tool whose schema even declares one). ctx.userId below is the
      // ONLY source of truth, always the authenticated caller. The model
      // also never chooses the risk level — it's fixed on the tool
      // definition and read here, never from the model's arguments.
      if (tool.riskLevel !== "LOW") {
        // Proposal, not execution: the tool has NOT run. The application —
        // not the model — decides this needs a human's explicit
        // confirmation (copilotActionService.ts) before anything happens.
        const confirmationPrompt = tool.describeAction
          ? tool.describeAction(validated.data)
          : `I'd like to run "${tool.name}". Should I proceed?`;
        const expiresAt = new Date(Date.now() + Number(getEnv().COPILOT_PENDING_ACTION_TTL_MS));

        steps.push({
          toolName: tool.name, input: validated.data, status: "PENDING_CONFIRMATION",
          durationMs: Date.now() - start, riskLevel: tool.riskLevel, expiresAt,
        });
        pendingConfirmationPrompt = confirmationPrompt;
        // No `tool` role message pushed — the model doesn't get to react to
        // this within the same turn; the turn is ending right here.
        continue;
      }

      try {
        const output = await withTimeout(
          tool.execute(validated.data, { userId: params.userId }),
          toolTimeoutMs(),
          `Tool "${tool.name}"`
        );
        steps.push({ toolName: tool.name, input: validated.data, output, status: "EXECUTED", durationMs: Date.now() - start, riskLevel: tool.riskLevel });
        messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify(output) });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Tool execution failed.";
        console.error(`[copilotAgentService] tool "${tool.name}" failed:`, err);
        steps.push({ toolName: tool.name, input: validated.data, status: "FAILED", errorMessage, durationMs: Date.now() - start, riskLevel: tool.riskLevel });
        messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify({ error: errorMessage }) });
      }
    }

    if (pendingConfirmationPrompt) {
      // Stop here — do not call the provider again this turn. Confirming
      // or cancelling happens out of band via copilotActionService.ts,
      // which resumes this exact task (copilotService.runAndPersistTurn())
      // with startStep carried forward, rather than granting it a fresh
      // budget.
      return finish({ finalMessage: pendingConfirmationPrompt, steps, tokensUsed, model, stepsUsedSoFar: step + 1 }, "pending_confirmation");
    }
    // Loop again — the model sees the tool results and either answers or asks for more tools.
  }

  return finish({
    finalMessage: "I gathered some information but couldn't finish putting it together in time. Could you narrow your question a bit?",
    steps,
    tokensUsed,
    model,
    stepsUsedSoFar: maxSteps,
  }, "step_limit_exhausted");
}
