/**
 * Copilot Repository
 * Sole Prisma layer for CopilotConversation / CopilotMessage /
 * CopilotToolExecution. No business logic.
 */
import db from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import type { CopilotMessageRole, CopilotToolStatus, CopilotRiskLevel } from "@prisma/client";

export interface CreateMessageInput {
  conversationId: string;
  role:           CopilotMessageRole;
  content:        string;
}

export interface CreateToolExecutionInput {
  messageId:    string;
  toolName:     string;
  input:        Prisma.InputJsonValue;
  output?:      Prisma.InputJsonValue;
  status:       CopilotToolStatus;
  riskLevel:    CopilotRiskLevel;
  errorMessage?: string;
  durationMs?:  number;
  /** Only meaningful when status is PENDING_CONFIRMATION. */
  expiresAt?:   Date;
  /** Only meaningful when status is PENDING_CONFIRMATION — see the schema
   *  comment on CopilotToolExecution.continuationState. */
  continuationState?: Prisma.InputJsonValue;
}

export const copilotRepository = {
  createConversation(userId: string, title?: string) {
    return db.copilotConversation.create({
      data: { userId, title: title ?? null },
    });
  },

  /** Returns null if the conversation doesn't exist OR isn't owned by userId —
   *  callers must treat both cases identically (not-found, never leak
   *  existence of another user's conversation). */
  findConversationById(id: string, userId: string) {
    return db.copilotConversation.findFirst({
      where: { id, userId },
    });
  },

  touchConversation(id: string) {
    return db.copilotConversation.update({
      where: { id },
      data:  { updatedAt: new Date() },
    });
  },

  /** Ownership-scoped conditional delete — same count===1 pattern as every
   *  other claim/mutation in this codebase (see copilotMemoryRepository.
   *  softDelete), rather than a separate exists-check followed by an
   *  unconditional delete. CopilotMessage.conversationId and
   *  CopilotToolExecution.messageId both cascade (onDelete: Cascade in
   *  schema.prisma), so this one call safely removes every message and
   *  tool-execution/pending-action row that belonged to the conversation —
   *  no separate cleanup step needed, and no orphaned pending action can
   *  ever survive its parent conversation. */
  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const { count } = await db.copilotConversation.deleteMany({ where: { id, userId } });
    return count === 1;
  },

  getRecentMessages(conversationId: string, limit: number) {
    return db.copilotMessage.findMany({
      where:   { conversationId },
      // id (cuid, monotonically increasing) breaks a same-millisecond tie
      // between a user/assistant pair written back-to-back — createdAt
      // alone isn't always enough to keep them in true insertion order.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take:    limit,
    });
  },

  /** Same as getRecentMessages but with each message's tool executions —
   *  only what the conversation-detail view needs (copilotService.
   *  getConversation()). Kept separate from getRecentMessages, which the
   *  agent loop's history builder calls every turn and has no use for tool
   *  execution rows — no reason to pay that join on the hot path. */
  getRecentMessagesWithToolCalls(conversationId: string, limit: number) {
    return db.copilotMessage.findMany({
      where:   { conversationId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take:    limit,
      include: { toolCalls: { orderBy: { createdAt: "asc" } } },
    });
  },

  /** Ownership-scoped, most-recently-updated first. The last-message
   *  preview uses a nested `take: 1` per conversation rather than a
   *  separate query per row — Prisma still issues a small, fixed number of
   *  queries for this regardless of how many conversations are returned
   *  (not O(n)). */
  async listConversationsForUser(userId: string, params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const where = { userId };
    const [items, total] = await Promise.all([
      db.copilotConversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: {
          messages: {
            // createdAt alone can tie at millisecond resolution when a
            // user/assistant pair is written back-to-back — id (cuid,
            // monotonically increasing) breaks the tie in true insertion
            // order so this reliably picks the LAST message, not either one.
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take:    1,
            select:  { role: true, content: true },
          },
        },
      }),
      db.copilotConversation.count({ where }),
    ]);
    return { items, total };
  },

  createMessage(input: CreateMessageInput) {
    return db.copilotMessage.create({
      data: {
        conversationId: input.conversationId,
        role:           input.role,
        content:        input.content,
      },
    });
  },

  createToolExecution(input: CreateToolExecutionInput) {
    return db.copilotToolExecution.create({
      data: {
        messageId:    input.messageId,
        toolName:     input.toolName,
        input:        input.input,
        output:       input.output ?? Prisma.JsonNull,
        status:       input.status,
        riskLevel:    input.riskLevel,
        errorMessage: input.errorMessage,
        durationMs:   input.durationMs,
        expiresAt:    input.expiresAt,
        continuationState: input.continuationState ?? Prisma.JsonNull,
      },
    });
  },

  // ── Pending actions (confirmation flow) ───────────────────────────────
  // A "pending action" is just a CopilotToolExecution row with status
  // PENDING_CONFIRMATION — no separate table. It's already attached to the
  // assistant message that proposed it, which gives it a conversation and
  // (via the conversation) an owning user for free, with the exact same
  // ownership-scoping pattern findConversationById uses elsewhere in this
  // file: every lookup/mutation here is scoped to `userId` in the WHERE
  // clause itself, never checked after the fact.

  /** Ownership-scoped lookup, any status. Returns null if the row doesn't
   *  exist OR isn't owned by userId — callers must treat both identically
   *  (never leak existence of another user's pending action). */
  findToolExecutionOwnedBy(id: string, userId: string) {
    return db.copilotToolExecution.findFirst({
      where: { id, message: { conversation: { userId } } },
      include: { message: { select: { conversationId: true } } },
    });
  },

  /** Atomically claims a pending action for confirmation: flips
   *  PENDING_CONFIRMATION → CONFIRMED in a single conditional UPDATE, only
   *  when still owned by userId, still pending, and not expired. Postgres
   *  serializes concurrent UPDATEs to the same row, so of two simultaneous
   *  confirms, at most one sees count === 1 — the other sees count === 0
   *  because by the time its UPDATE re-checks the WHERE clause the status
   *  is no longer PENDING_CONFIRMATION. This is the sole mechanism
   *  preventing a double-confirm from executing a tool twice. */
  async claimPendingToolExecution(id: string, userId: string): Promise<boolean> {
    const { count } = await db.copilotToolExecution.updateMany({
      where: {
        id,
        status: "PENDING_CONFIRMATION",
        message: { conversation: { userId } },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    return count === 1;
  },

  /** Same atomicity as claimPendingToolExecution, for cancellation. Does
   *  NOT require the action to be unexpired — an already-stale action can
   *  still be explicitly cancelled, that's harmless. */
  async cancelPendingToolExecution(id: string, userId: string): Promise<boolean> {
    const { count } = await db.copilotToolExecution.updateMany({
      where: { id, status: "PENDING_CONFIRMATION", message: { conversation: { userId } } },
      data: { status: "CANCELLED" },
    });
    return count === 1;
  },

  /** Best-effort: marks a stale PENDING_CONFIRMATION row EXPIRED once a
   *  confirm attempt discovers its expiresAt has passed. Not load-bearing
   *  for security (the claim query above already refuses to confirm an
   *  expired row regardless of what its stored status says) — this just
   *  keeps the persisted state honest for anyone reading it later. */
  markToolExecutionExpired(id: string) {
    return db.copilotToolExecution.updateMany({
      where: { id, status: "PENDING_CONFIRMATION" },
      data: { status: "EXPIRED" },
    });
  },

  markToolExecutionExecuted(id: string, output: Prisma.InputJsonValue) {
    return db.copilotToolExecution.update({
      where: { id },
      data: { status: "EXECUTED", output, executedAt: new Date() },
    });
  },

  markToolExecutionFailed(id: string, errorMessage: string) {
    return db.copilotToolExecution.update({
      where: { id },
      data: { status: "FAILED", errorMessage, executedAt: new Date() },
    });
  },

  // ── Phase 10: semantic retrieval ────────────────────────────────────────

  /** Unscoped single lookup — used only by the backfill job
   *  (copilotMemoryBackfill.ts) to confirm whether an embedding attempt
   *  succeeded. Not exposed to any user-facing tool/route. */
  findMessageById(id: string) {
    return db.copilotMessage.findUnique({ where: { id } });
  },

  /** Best-effort — see copilotSemanticRetrieval.embedMessageInBackground().
   *  Not ownership-scoped: only ever called for a row this process itself
   *  just created. */
  setMessageEmbedding(id: string, embedding: number[]) {
    return db.copilotMessage.update({ where: { id }, data: { embedding } });
  },

  /** Ownership enforced by the query itself — `conversation: { userId }`,
   *  never a broader fetch filtered afterward. Excludes
   *  `excludeConversationId` (the current conversation, whose recent
   *  messages already reach the model via the normal bounded history load
   *  — see copilotContextOrchestrator.ts) and rows with no real embedding
   *  yet (`isEmpty: false` also excludes the EMBEDDING_SKIPPED_MARKER
   *  sentinel by construction, since that marker is never an empty array).
   *  Bounded by `limit`, most recent first — never a full-table scan. */
  findHistoricalMessagesWithEmbedding(userId: string, excludeConversationId: string, limit: number) {
    return db.copilotMessage.findMany({
      where: {
        conversation:   { userId },
        conversationId: { not: excludeConversationId },
        embedding:      { isEmpty: false },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take:    limit,
    });
  },

  /** For the backfill job (copilotMemoryBackfill.ts) — messages with no
   *  embedding attempt recorded yet, oldest first for steady, resumable
   *  forward progress. Not ownership-scoped: this is an operator/admin
   *  batch job over the whole table, not a per-request user-facing path. */
  findMessagesMissingEmbedding(limit: number) {
    return db.copilotMessage.findMany({
      where:   { embedding: { isEmpty: true } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take:    limit,
    });
  },
};
