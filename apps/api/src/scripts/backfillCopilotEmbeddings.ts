/**
 * Copilot Embedding Backfill — CLI entry point (Phase 10)
 *
 * Run: pnpm run copilot:backfill-embeddings
 * (from apps/api — see package.json)
 *
 * Works through the memory and message backlog in bounded batches until
 * nothing is left, then exits. Safe to Ctrl+C and rerun at any time —
 * see copilotMemoryBackfill.ts for why this is resumable/idempotent by
 * construction. Prints only counts, never memory/message content.
 */
import "dotenv/config";
import { backfillMemoryEmbeddings, backfillMessageEmbeddings, type BackfillBatchResult } from "../server/services/copilotMemoryBackfill";

const MAX_BATCHES = 200; // hard ceiling — a runaway loop can never run forever, even against an unexpectedly huge backlog

async function runToCompletion(
  label: string,
  runBatch: () => Promise<BackfillBatchResult>
): Promise<void> {
  let totalSucceeded = 0;
  let totalFailed = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const result = await runBatch();
    totalSucceeded += result.succeeded;
    totalFailed += result.failed;

    if (result.processed === 0) {
      console.log(`[${label}] done — ${totalSucceeded} embedded, ${totalFailed} failed (will retry on next run)`);
      return;
    }
    console.log(`[${label}] batch ${batch + 1}: ${result.succeeded}/${result.processed} embedded`);
  }
  console.log(`[${label}] stopped after ${MAX_BATCHES} batches — rerun this command to continue`);
}

async function main() {
  await runToCompletion("memories", () => backfillMemoryEmbeddings());
  await runToCompletion("messages", () => backfillMessageEmbeddings());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[copilot:backfill-embeddings] fatal error:", err);
    process.exit(1);
  });
