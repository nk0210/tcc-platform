/**
 * Copilot Action Service — confirmation flow for MEDIUM/HIGH-risk tools.
 *
 * This is the ONLY place a proposed (PENDING_CONFIRMATION) tool call can
 * turn into an actual execution. The agent loop (copilotAgentService.ts)
 * never executes a non-LOW tool itself — it only creates the pending
 * CopilotToolExecution row and stops. Getting from "proposed" to "executed"
 * requires a separate, explicitly authenticated, ownership-scoped call to
 * confirmAction() below. A model requesting a tool is a proposal, never an
 * authorization.
 *
 * Race safety: confirmAction()/cancelAction() do not "check then update" —
 * they attempt a single conditional UPDATE (copilotRepository.
 * claimPendingToolExecution / cancelPendingToolExecution) that only
 * succeeds if the row is still owned by the caller, still
 * PENDING_CONFIRMATION, and (for confirm) not expired. Postgres serializes
 * concurrent UPDATEs to the same row, so of two simultaneous confirms at
 * most one can win the claim — the other observes the row already changed
 * and fails closed. There is no separate "read the current state, then
 * decide" step that a race could slip through. Continuation (below) only
 * ever runs after that same successful claim, so it inherits the same
 * exactly-once guarantee — there is no separate path that could resume a
 * task without having first won the claim on its interrupting action.
 *
 * Continuation (Phase 3): confirming/cancelling authorizes ONLY the one
 * claimed action. If the turn that proposed it had more to do (e.g. "add
 * XAUUSD and analyze it"), resuming that turn is a SEPARATE call to
 * runAndPersistTurn() below, which goes through the exact same agent loop,
 * tool registry, and risk gate as any fresh message — a further MEDIUM/HIGH
 * tool the resumed turn wants still pauses for its own confirmation. This
 * is what makes "confirm the watchlist add" structurally unable to also
 * authorize an unrelated "remove everything" the model might have floated:
 * that second action is gated exactly like the first ever was, never
 * inherited from it.
 */
import type { Prisma } from "@prisma/client";
import { copilotRepository } from "../repositories/copilotRepository";
import { getTool } from "./copilotToolRegistry";
import { runAndPersistTurn, type ChatResult, type ContinuationState } from "./copilotService";
import type { AIMessage } from "./copilotAiProvider";
import { recordActionOutcome, recordContinuationResumed } from "./copilotObservability";

export class PendingActionNotFoundError extends Error {
  constructor() { super("PENDING_ACTION_NOT_FOUND"); }
}

/** Thrown when the action exists and is owned by the caller, but is no
 *  longer in a state that can be confirmed/cancelled (already executed,
 *  already cancelled, expired, etc). `currentStatus` lets the route report
 *  something more useful than a generic conflict. */
export class PendingActionNotAvailableError extends Error {
  constructor(public readonly currentStatus: string) {
    super(`PENDING_ACTION_NOT_AVAILABLE: ${currentStatus}`);
  }
}

export interface ActionOutcome {
  id:             string;
  toolName:       string;
  status:         "EXECUTED" | "FAILED" | "CANCELLED";
  /** Human-friendly, app-authored summary of the confirmed/cancelled action
   *  itself — never raw tool arguments or provider output shown as-is. */
  message:        string;
  conversationId: string;
  /** Present only when the action was part of a multi-step request (e.g.
   *  "add XAUUSD and analyze it") — the resumed agent turn's own result.
   *  `message` above is always accurate on its own regardless of whether
   *  this is present or how it turned out. */
  continuation?: {
    message:        string;
    toolCalls:      Array<{ name: string; status: string }>;
    pendingAction?: ChatResult["pendingAction"];
  };
}

/** Looks up the current state of a pending action the caller doesn't
 *  already know is claimable, to produce an accurate error. Never
 *  distinguishes "doesn't exist" from "exists but isn't yours" — both
 *  surface as PendingActionNotFoundError. */
async function diagnoseClaimFailure(actionId: string, userId: string): Promise<never> {
  const existing = await copilotRepository.findToolExecutionOwnedBy(actionId, userId);
  if (!existing) throw new PendingActionNotFoundError();

  if (existing.status === "PENDING_CONFIRMATION") {
    // Ownership and status both matched the claim query — the only
    // remaining condition it could have failed is expiry.
    await copilotRepository.markToolExecutionExpired(actionId).catch(() => {});
    recordActionOutcome("EXPIRED", { actionId, userId, toolName: existing.toolName });
    throw new PendingActionNotAvailableError("EXPIRED");
  }

  throw new PendingActionNotAvailableError(existing.status);
}

/** Confirms and executes a pending MEDIUM/HIGH-risk action.
 *
 *  `userId` MUST be the authenticated caller's id (from AuthRequest) — it
 *  is both the ownership filter for the claim and the ONLY userId ever
 *  passed into the tool's execute(), exactly like the agent loop's LOW-risk
 *  path. Nothing about the original proposal (who created it, what user it
 *  was scoped to) is trusted for authorization at this point; ownership is
 *  re-verified against the current authenticated caller right here. */
export async function confirmAction(actionId: string, userId: string): Promise<ActionOutcome> {
  const claimed = await copilotRepository.claimPendingToolExecution(actionId, userId);
  if (!claimed) await diagnoseClaimFailure(actionId, userId);

  const action = await copilotRepository.findToolExecutionOwnedBy(actionId, userId);
  // Can't be null: we hold the claim we just won, and rows are never
  // deleted out from under a CONFIRMED status.
  const conversationId = action!.message.conversationId;
  const continuationStateRaw = action!.continuationState;

  const tool = getTool(action!.toolName);
  if (!tool) {
    // The registry changed between proposal and confirmation (e.g. a
    // deploy removed the tool) — fail closed, never silently no-op.
    const errorMessage = `"${action!.toolName}" is no longer available.`;
    await copilotRepository.markToolExecutionFailed(actionId, errorMessage);
    return finishAction({
      actionId, userId, conversationId, continuationStateRaw,
      toolName: action!.toolName, toolInput: action!.input, status: "FAILED",
      outcomeMessage: `I couldn't complete that: ${errorMessage}`,
      resultForModel: { error: errorMessage },
    });
  }

  try {
    // action.input was already Zod-validated at proposal time by the agent
    // loop (copilotToolRegistry's parameters.safeParse) — never re-parsed
    // from anything model- or client-supplied here.
    const output = await tool.execute(action!.input, { userId });
    await copilotRepository.markToolExecutionExecuted(actionId, output as Prisma.InputJsonValue);

    const outcomeMessage = tool.describeResult ? tool.describeResult(output, action!.input) : "Done.";
    return finishAction({
      actionId, userId, conversationId, continuationStateRaw,
      toolName: tool.name, toolInput: action!.input, status: "EXECUTED", outcomeMessage, resultForModel: output,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Execution failed.";
    console.error(`[copilotActionService] confirmed tool "${tool.name}" failed to execute:`, err);
    await copilotRepository.markToolExecutionFailed(actionId, errorMessage);

    return finishAction({
      actionId, userId, conversationId, continuationStateRaw,
      toolName: tool.name, toolInput: action!.input, status: "FAILED",
      outcomeMessage: `I couldn't complete that: ${errorMessage}`,
      resultForModel: { error: errorMessage },
    });
  }
}

export async function cancelAction(actionId: string, userId: string): Promise<ActionOutcome> {
  const cancelled = await copilotRepository.cancelPendingToolExecution(actionId, userId);
  if (!cancelled) await diagnoseClaimFailure(actionId, userId);

  const action = await copilotRepository.findToolExecutionOwnedBy(actionId, userId);
  const conversationId = action!.message.conversationId;
  const outcomeMessage = "Okay, I won't do that.";

  return finishAction({
    actionId, userId, conversationId,
    continuationStateRaw: action!.continuationState,
    toolName: action!.toolName, toolInput: action!.input, status: "CANCELLED", outcomeMessage,
    // The model must not be told this executed — it didn't. A distinct
    // shape (no output-like fields) makes that unambiguous.
    resultForModel: { status: "cancelled", message: outcomeMessage },
  });
}

// ── Shared confirm/cancel tail: persist the outcome, resume if needed ─────

function parseContinuationState(raw: Prisma.JsonValue | null): ContinuationState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.originalUserMessage !== "string" || typeof obj.stepsUsed !== "number") return null;
  return { originalUserMessage: obj.originalUserMessage, stepsUsed: obj.stepsUsed };
}

/** App-authored, not model-authored — the model never sees or writes this
 *  text; it only ever reads it as an incoming "user" message for the
 *  resumed turn, same as any other instruction. Deliberately does NOT
 *  restate the action's outcome — buildReplayHistory() below gives the
 *  model a real tool-call/tool-result pair for that, which is what let it
 *  correctly recognize the action as already done instead of proposing it
 *  again (see the live-verification note in the Phase 3 report). */
function buildContinuationPrompt(originalUserMessage: string): string {
  return (
    `[The user's original request was: "${originalUserMessage}". ` +
    `If anything from it still needs doing, use your tools to do it now — do not repeat a tool call you already have a result for above. ` +
    `If nothing remains, reply with a brief acknowledgement only.]`
  );
}

/** A synthetic assistant tool-call + tool-result pair representing the
 *  action that was just confirmed/cancelled, appended to history so the
 *  resumed model sees a normal, complete tool exchange — the same shape it
 *  would see mid-turn if confirmation didn't exist — rather than being told
 *  about the outcome secondhand in a plain-text note (which a small model
 *  reliably fails to treat as equivalent to "you already did this"). Never
 *  persisted to the DB; built fresh for this one resumed call. */
function buildReplayHistory(actionId: string, toolName: string, toolInput: unknown, resultForModel: unknown): AIMessage[] {
  const toolCallId = `resumed_${actionId}`;
  return [
    { role: "assistant", content: null, toolCalls: [{ id: toolCallId, name: toolName, arguments: JSON.stringify(toolInput) }] },
    { role: "tool", toolCallId, content: JSON.stringify(resultForModel) },
  ];
}

/** Persists the confirm/cancel outcome and, only when the interrupted turn
 *  had more to do (continuationStateRaw parses), resumes it through the
 *  exact same runAndPersistTurn() chat() itself uses — same agent loop,
 *  same tool registry, same risk gate. A further MEDIUM/HIGH tool the
 *  resumption wants creates its own new pending action and pauses again;
 *  it is never auto-executed just because a prior action in this task was
 *  just confirmed. If no continuation state is present, behavior is
 *  unchanged from Phase 2: a single plain outcome message, no extra model
 *  call. */
async function finishAction(params: {
  actionId:             string;
  userId:               string;
  conversationId:       string;
  continuationStateRaw: Prisma.JsonValue | null;
  toolName:             string;
  toolInput:            unknown;
  status:               "EXECUTED" | "FAILED" | "CANCELLED";
  outcomeMessage:       string;
  /** What the model is told this tool call "returned" — real output for
   *  EXECUTED, an {error} shape for FAILED, a distinct {status:
   *  "cancelled"} shape for CANCELLED (never implying it ran). */
  resultForModel:       unknown;
}): Promise<ActionOutcome> {
  const { actionId, toolName, status, outcomeMessage, conversationId } = params;
  const bareOutcome: ActionOutcome = { id: actionId, toolName, status, message: outcomeMessage, conversationId };
  recordActionOutcome(status, { actionId, userId: params.userId, toolName });

  const continuationState = parseContinuationState(params.continuationStateRaw);
  if (!continuationState) {
    await copilotRepository.createMessage({ conversationId, role: "ASSISTANT", content: outcomeMessage });
    await copilotRepository.touchConversation(conversationId);
    return bareOutcome;
  }

  recordContinuationResumed({ conversationId, userId: params.userId });

  try {
    const turn = await runAndPersistTurn({
      conversationId,
      userId:               params.userId,
      modelUserMessage:     buildContinuationPrompt(continuationState.originalUserMessage),
      originalUserMessage:  continuationState.originalUserMessage,
      startStep:            continuationState.stepsUsed,
      persistAsUserMessage: null,
      messagePrefix:        outcomeMessage,
      extraHistory:         buildReplayHistory(actionId, toolName, params.toolInput, params.resultForModel),
    });

    return {
      ...bareOutcome,
      continuation: { message: turn.message, toolCalls: turn.toolCalls, pendingAction: turn.pendingAction },
    };
  } catch (err) {
    // The action itself already executed/failed/cancelled and is already
    // persisted — a broken continuation (provider down or unconfigured)
    // must not turn a real, already-committed outcome into an error
    // response. Degrade to the plain outcome message instead.
    console.error(`[copilotActionService] continuation failed for action ${actionId}:`, err);
    await copilotRepository.createMessage({ conversationId, role: "ASSISTANT", content: outcomeMessage });
    await copilotRepository.touchConversation(conversationId);
    return bareOutcome;
  }
}
