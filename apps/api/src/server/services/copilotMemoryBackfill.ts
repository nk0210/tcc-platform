/**
 * Copilot Embedding Backfill — Phase 10
 *
 * Existing CopilotMemory/CopilotMessage rows created before Phase 10 (or
 * whose background embedding attempt failed/was skipped when semantic
 * retrieval was disabled) have no embedding. This is the bounded, resumable
 * batch job that catches them up — reusing the exact same embedding calls
 * (embedMemoryInBackground/embedMessageInBackground) the live create/write
 * paths already use, so there is exactly one implementation of "how a
 * memory or message gets embedded" in the codebase, not a second one here.
 *
 * No migration/job framework exists in this repository (confirmed by
 * audit — apps/api has no scripts/ directory, no queue, no scheduler), so
 * per the Phase 10 spec's own guidance this is the smallest practical
 * admin command rather than a new workflow engine: a plain async function,
 * safe to invoke from a one-off script (see
 * apps/api/src/scripts/backfillCopilotEmbeddings.ts) or a test.
 *
 * Resumable/idempotent/safe to rerun by construction: each call processes
 * one bounded batch of rows that still have NO embedding
 * (copilotMemoryRepository.findActiveMissingEmbedding /
 * copilotRepository.findMessagesMissingEmbedding — both `isEmpty: true`
 * queries), oldest first. A row that succeeds this run is never picked up
 * again; a row that fails simply stays eligible for the next run — nothing
 * here needs its own retry/checkpoint bookkeeping. Never touches deleted/
 * superseded memories (findActiveMissingEmbedding is ACTIVE-only, matching
 * every other memory read path) or embeds anything not already governed
 * by copilotMemoryService.persistMemory() — this only adds an embedding
 * column value to a row that already exists; it cannot create, edit, or
 * delete a memory.
 */
import { copilotMemoryRepository } from "../repositories/copilotMemoryRepository";
import { copilotRepository } from "../repositories/copilotRepository";
import { embedMemoryInBackground, embedMessageInBackground } from "./copilotSemanticRetrieval";

export interface BackfillBatchResult {
  /** Rows examined this batch (bounded by `batchSize`). */
  processed: number;
  /** Rows that now have a real embedding (or the deliberate
   *  EMBEDDING_SKIPPED_MARKER, for a message too short to embed). */
  succeeded: number;
  /** Rows still missing an embedding after this attempt — provider
   *  unavailable/timed out/errored. Eligible again on the next run. */
  failed: number;
}

const DEFAULT_BATCH_SIZE = 25;

async function runBatch<T extends { id: string; content: string }>(
  rows: T[],
  embed: (id: string, content: string) => Promise<void>,
  hasEmbedding: (id: string) => Promise<boolean>
): Promise<BackfillBatchResult> {
  let succeeded = 0;
  let failed = 0;

  // Sequential, not parallel — this is a background/operator job, not a
  // user-facing hot path, so there's no latency pressure to batch or
  // parallelize; keeping it simple and easy to reason about is worth more
  // here (see the module doc comment on avoiding unneeded complexity).
  for (const row of rows) {
    await embed(row.id, row.content); // never throws — see embedMemoryInBackground/embedMessageInBackground
    if (await hasEmbedding(row.id)) succeeded++;
    else failed++;
  }

  return { processed: rows.length, succeeded, failed };
}

/** One bounded batch of ACTIVE memories with no embedding yet. Call
 *  repeatedly (e.g. in a loop until `processed === 0`) to work through a
 *  large backlog without ever loading more than `batchSize` rows at once. */
export async function backfillMemoryEmbeddings(batchSize = DEFAULT_BATCH_SIZE): Promise<BackfillBatchResult> {
  const pending = await copilotMemoryRepository.findActiveMissingEmbedding(batchSize);
  return runBatch(pending, embedMemoryInBackground, async (id) => {
    const row = await copilotMemoryRepository.findById(id);
    return !!row && row.embedding.length > 0;
  });
}

/** Same shape, for CopilotMessage. A message that was too short to be
 *  worth embedding (see MIN_EMBEDDABLE_MESSAGE_LENGTH in
 *  copilotSemanticRetrieval.ts) still counts as "succeeded" — it correctly
 *  received the deliberate skip marker and will not be re-examined by a
 *  future run either. */
export async function backfillMessageEmbeddings(batchSize = DEFAULT_BATCH_SIZE): Promise<BackfillBatchResult> {
  const pending = await copilotRepository.findMessagesMissingEmbedding(batchSize);
  return runBatch(
    pending,
    embedMessageInBackground,
    async (id) => {
      const fresh = await copilotRepository.findMessageById(id);
      return !!fresh && fresh.embedding.length > 0;
    }
  );
}
