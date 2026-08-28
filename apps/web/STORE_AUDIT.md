# Frontend Store Audit — Phase Alpha.1
Date: 2026-08-28

All 11 API-backed stores share one common shape, wired identically: `isLoading` / `isSyncing` / `isInitialized` (`isInitialised` in `authStore` only — pre-existing British spelling, left as-is since it's load-bearing across every consumer already) / `error`, plus an auto-init/reset block at the bottom of every file that subscribes to `useAuthStore` and calls `init()` on login / `reset()` on logout. `reportStore.ts` is intentionally excluded — it's local-only UI state (report-builder scratch state), never talks to the API, and has no `init`/`reset` lifecycle to audit.

## authStore.ts
✅ Root store — no auto-init subscribe needed (it *is* the auth signal every other store subscribes to)
✅ `initialise()` guards on `isInitialised`, always resolves to a final `{user, isInitialised:true}` state on every branch (token present + valid, token present + invalid, no token)
✅ `isLoading` resets on all paths
✅ Error handling present (`error`, `clearError()`)
✅ No optimistic mutations to revert (login/register/logout are all request-then-commit)

## tradeStore.ts
✅ `init()` called on login (via subscribe block)
✅ `reset()` called on logout
✅ `isLoading` resets correctly (success, catch — `init()` doesn't treat individual per-endpoint failures as fatal, by design, since it fetches positions/account/closed in parallel with independent fallbacks)
✅ `isInitialized` guard present
✅ Error handling present
❌ **Found and fixed**: `updateSLTP()` applied its optimistic SL/TP update but never reverted it on API failure, and never surfaced the error — a rejected SL/TP change would appear to succeed in the UI forever. Now snapshots `positions` before the optimistic write and reverts + sets `error` on both the `!res.success` and `catch` paths, matching every other mutation in this store.
❌ **Found and fixed**: `deletePosition()` didn't clear `error: null` when starting a new attempt, so a stale error from an earlier unrelated action could linger on screen through a subsequent successful delete. Now clears it at the start of the optimistic write, matching `openPosition`/`closePosition`.

## journalStore.ts
✅ init() called on login / reset() on logout
✅ isLoading resets on all 3 paths
✅ isInitialized guard present
✅ Error handling present
✅ No optimistic-revert issues found — updates are request-then-commit, not optimistic

## communityStore.ts
✅ init() / reset() wired correctly
✅ isLoading resets on all paths
✅ isInitialized guard present
✅ Error handling present
✅ Optimistic updates (`toggleLike`, `toggleBookmark`, `followUser`/`unfollowUser`, comment likes) all snapshot and revert on failure — verified by inspection

## strategyStore.ts
✅ init() / reset() wired correctly
✅ isLoading resets on all paths
✅ isInitialized guard present
✅ Error handling present
✅ Optimistic updates (save/playbook toggles) use `patchEverywhere`/`snapshot` helpers to keep `strategies`/`myStrategies`/`savedStrategies`/`playbook` in sync and revert together on failure

## academyStore.ts
✅ init() / reset() wired correctly
✅ isLoading resets on all paths
✅ isInitialized guard present
✅ Error handling present
✅ `completeLesson`/`submitQuizScore` apply an optimistic local update then reconcile with the server response (not a full revert-based pattern, but equivalent in effect since the server response is authoritative and always applied last)

## profileStore.ts
✅ init() / reset() wired correctly
✅ isLoading resets on all paths
✅ isInitialized guard present
✅ Error handling present
✅ `updateProfile`/`updateSocialLinks`/`updateTradingIdentity` are three independent optimistic-revert calls — verified each reverts its own slice on failure without clobbering the other two

## notificationStore.ts
✅ init() / reset() wired correctly
✅ isLoading resets on all paths
✅ isInitialized guard present
✅ Error handling present
✅ `unreadCount` is a plain number field (confirmed still correctly read as `s.unreadCount` in `Topbar.tsx`, not called as a function)
✅ Mark-as-read/delete are optimistic with revert on failure

## copyTradingStore.ts
✅ init() / reset() wired correctly
✅ isLoading resets on all paths
✅ isInitialized guard present
✅ Error handling present
✅ Admin moderation correctly kept out of this store (lives in `lib/api/adminCopyTrading.ts`, used only by `owner/copy-trading/page.tsx`) — no scope creep found

## analyticsStore.ts
✅ init() / reset() wired correctly (`init()` calls `refresh()` unconditionally on first load — the 60s cache guard only short-circuits *subsequent* calls, confirmed no stale-data-on-first-load bug)
✅ isLoading resets on all paths
✅ isInitialized guard present
✅ Error handling present
✅ No optimistic mutations (read-only store) — nothing to revert
✅ `selectOverview()` is a pure server-data passthrough — confirmed no client-side win-rate recalculation (see Phase 5 notes)

## watchlistStore.ts
✅ init() / reset() wired correctly
✅ isLoading resets on all paths
✅ isInitialized guard present
✅ Error handling present
✅ Add/remove are optimistic with revert on failure
✅ Live-price fields (`currentPrice`, `change24h`, alerts, etc.) are intentionally local-only and never sent to the API — documented in the file's own header comment, consistent with `tradeStore.updatePrices`' design

## Summary

- **11/11 stores** correctly wire `init()`/`reset()` to the auth lifecycle.
- **11/11 stores** reset `isLoading` on every code path (success, `!success`, `catch`).
- **11/11 stores** guard against double-init via `isInitialized`/`isInitialised`.
- **11/11 stores** set and clear `error` state.
- **2 real bugs found and fixed**, both in `tradeStore.ts`'s `updateSLTP`/`deletePosition` — see above. No other store had a missing-revert or stale-error issue.
