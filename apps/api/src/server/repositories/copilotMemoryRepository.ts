/**
 * Copilot Memory Repository — Phase 7
 * Sole Prisma layer for CopilotMemory. No business logic (classification,
 * dedup, conflict resolution) here — that lives in copilotMemoryService.ts,
 * same split as copilotRepository.ts / copilotService.ts.
 */
import db from "../../lib/prisma";
import type { CopilotMemoryType, CopilotMemorySource } from "@prisma/client";

export interface CreateMemoryInput {
  userId:            string;
  type:              CopilotMemoryType;
  content:           string;
  normalizedContent: string;
  source:            CopilotMemorySource;
}

export const copilotMemoryRepository = {
  createMemory(input: CreateMemoryInput) {
    return db.copilotMemory.create({ data: input });
  },

  /** Every ACTIVE memory of one type for one user — the dedup/conflict scan
   *  set. Bounded implicitly: governance keeps per-user, per-type volume
   *  small (dedup prevents unlimited restatement of the same fact), so this
   *  never needs its own `take`. */
  findActiveByUserAndType(userId: string, type: CopilotMemoryType) {
    return db.copilotMemory.findMany({
      where:   { userId, type, status: "ACTIVE" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  },

  /** Every ACTIVE memory for a user, any type — used only by the explicit
   *  "forget" resolver, which needs to compare a free-text subject against
   *  everything the user has saved, not just one type. */
  findAllActiveForUser(userId: string) {
    return db.copilotMemory.findMany({
      where:   { userId, status: "ACTIVE" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  },

  /** Bounded, ownership-scoped retrieval for prompt injection — see
   *  copilotMemoryService.buildMemoryContext(). `limit` is the hard cap on
   *  how many memories can ever reach the model in one turn. */
  findActiveByUserAndTypes(userId: string, types: CopilotMemoryType[], limit: number) {
    return db.copilotMemory.findMany({
      where:   { userId, type: { in: types }, status: "ACTIVE" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take:    limit,
    });
  },

  /** Ownership-scoped lookup, ACTIVE or SUPERSEDED (never DELETED) — used
   *  by the agent's delete_memory tool, which should still be able to
   *  resolve a memory it saw via get_memories a moment ago even if it was
   *  superseded in between, but never one already forgotten. */
  findMemoryOwnedBy(id: string, userId: string) {
    return db.copilotMemory.findFirst({
      where: { id, userId, status: { not: "DELETED" } },
    });
  },

  /** Ownership-scoped, ACTIVE only, optionally filtered by type — what the
   *  user sees in the memory-management UI and via GET /copilot/memories. */
  async listActiveForUser(
    userId: string,
    params: { type?: CopilotMemoryType; page: number; pageSize: number }
  ) {
    const where = { userId, status: "ACTIVE" as const, ...(params.type ? { type: params.type } : {}) };
    const [items, total] = await Promise.all([
      db.copilotMemory.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip:    (params.page - 1) * params.pageSize,
        take:    params.pageSize,
      }),
      db.copilotMemory.count({ where }),
    ]);
    return { items, total };
  },

  /** Flips ACTIVE → SUPERSEDED. Conditional on still being ACTIVE so two
   *  concurrent supersede attempts on the same row are harmless (the second
   *  is a no-op). Not ownership-scoped by userId because it's only ever
   *  called internally, for a row already loaded via a userId-scoped query
   *  (see persistMemory()'s conflict-resolution loop). */
  supersede(id: string) {
    return db.copilotMemory.updateMany({
      where: { id, status: "ACTIVE" },
      data:  { status: "SUPERSEDED" },
    });
  },

  /** Best-effort freshness marker for memories actually injected into a
   *  prompt — never load-bearing, failures are swallowed by the caller. */
  touchUsedMany(ids: string[]) {
    if (ids.length === 0) return Promise.resolve();
    return db.copilotMemory.updateMany({
      where: { id: { in: ids } },
      data:  { lastUsedAt: new Date() },
    });
  },

  /** Atomically claims ACTIVE → DELETED, scoped to the caller's own row —
   *  same conditional-UPDATE pattern as copilotRepository's
   *  cancelPendingToolExecution: no separate check-then-update step, so a
   *  double-delete race just makes the second call a no-op (count === 0)
   *  rather than an error. */
  async softDelete(id: string, userId: string): Promise<boolean> {
    const { count } = await db.copilotMemory.updateMany({
      where: { id, userId, status: "ACTIVE" },
      data:  { status: "DELETED" },
    });
    return count === 1;
  },

  /** Atomically edits an ACTIVE row's content, scoped to the caller's own
   *  row — same conditional-UPDATE pattern as softDelete (count === 1 means
   *  it was ours and still ACTIVE; count === 0 covers not-found, not-owned,
   *  and already-superseded/deleted alike). Also clears any existing
   *  embedding: edited content invalidates whatever vector was stored for
   *  the old content, so the row is correctly absent from semantic search
   *  until copilotMemoryService.updateMemory()'s async re-embed lands —
   *  same "briefly absent rather than stale" behavior as a newly created memory. */
  async updateContentIfActive(
    id: string,
    userId: string,
    data: { content: string; normalizedContent: string }
  ): Promise<boolean> {
    const { count } = await db.copilotMemory.updateMany({
      where: { id, userId, status: "ACTIVE" },
      data:  { content: data.content, normalizedContent: data.normalizedContent, embedding: [], embeddingModel: null, embeddingUpdatedAt: null },
    });
    return count === 1;
  },

  // ── Phase 10: semantic retrieval ────────────────────────────────────────

  /** Unscoped single lookup, any status — used only by the backfill job
   *  (copilotMemoryBackfill.ts) to confirm whether an embedding attempt
   *  succeeded. Not exposed to any user-facing tool/route: this is an
   *  operator/admin batch job's own bookkeeping, not a request-time path
   *  that needs ownership scoping. */
  findById(id: string) {
    return db.copilotMemory.findUnique({ where: { id } });
  },

  /** Best-effort — never load-bearing (see copilotMemoryService's
   *  embedMemoryInBackground()). Not ownership-scoped by userId for the
   *  same reason supersede() isn't: only ever called for a row this
   *  process itself just created under a known userId. */
  setEmbedding(id: string, embedding: number[], model: string) {
    return db.copilotMemory.update({
      where: { id },
      data:  { embedding, embeddingModel: model, embeddingUpdatedAt: new Date() },
    });
  },

  /** Ownership-scoped, ACTIVE-only, embedding-bearing candidates for
   *  semantic search — see copilotSemanticRetrieval.ts. `isEmpty: false`
   *  means "has ever been embedded"; a memory whose background embedding
   *  job hasn't run yet (or failed) is correctly absent here, and simply
   *  isn't a semantic candidate this turn — deterministic retrieval is
   *  unaffected either way. Bounded by `limit` — never the user's entire
   *  memory history, no matter how large it grows. */
  findActiveWithEmbeddingForUser(userId: string, limit: number) {
    return db.copilotMemory.findMany({
      where:   { userId, status: "ACTIVE", embedding: { isEmpty: false } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take:    limit,
    });
  },

  /** For the backfill job (copilotMemoryBackfill.ts) — ACTIVE memories with
   *  no embedding yet, oldest first so a resumed/rerun batch job makes
   *  steady forward progress rather than re-scanning the same recent rows
   *  every time. */
  findActiveMissingEmbedding(limit: number) {
    return db.copilotMemory.findMany({
      where:   { status: "ACTIVE", embedding: { isEmpty: true } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take:    limit,
    });
  },
};
