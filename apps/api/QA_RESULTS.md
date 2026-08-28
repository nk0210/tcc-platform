# API QA Results — Phase Alpha.1
Date: 2026-08-28

Test account: `qa@tcc.com` / handle `qatester` (freshly registered, role `NORMAL_USER`).
All requests run against `http://localhost:4000/api` with a live Bearer token unless noted.

## ✅ Passing (68 routes)

### Auth
- GET /health → 200 ✅ (`version: alpha-7.0`, all 15 modules listed)
- POST /auth/register (dup email) → 409 ✅ `Email already in use`
- POST /auth/login (wrong password) → 401 ✅ `Invalid credentials`
- POST /auth/refresh (invalid token) → 401 ✅ `Invalid refresh token`
- GET /auth/me (no token) → 401 ✅ `Authentication required`
- GET /auth/me (valid token) → 200 ✅

### Trade
- GET /trade → 200 ✅ `[]`
- GET /trade/account → 200 ✅ `{balance, equity, floatingPnl, marginUsed, freeMargin, marginLevel}`
- GET /trade/closed → 200 ✅ paginated shape
- POST /trade (valid: symbol/displayName/category/side BUY|SELL/lotSize/entryPrice/marginUsed/notionalValue/leverage) → 201 ✅ `Position opened`
- POST /trade (missing fields) → 400 ✅ `Validation failed` with per-field details
- PUT /trade/:id/sltp → 200 ✅
- POST /trade/:id/close → 200 ✅ returns `{trade, journalEntry, newBalance}` — confirms a JournalEntry is auto-created on close
- DELETE /trade/:id (open trade) → by-design 404 once already closed (`deleteOpenTrade` only targets *open* positions — verified intentional, see route comment) ✅
- GET /trade/nonexistent → 404 ✅ `Trade not found`

### Journal
- GET /journal → 200 ✅ paginated shape
- GET /journal/:id → 200 ✅
- PUT /journal/:id → 200 ✅
- GET /journal/trade/:tradeId → 200 ✅
- GET /journal/nonexistent → 404 ✅ `Resource not found`

### Watchlist
- GET /watchlist → 200 ✅
- POST /watchlist → 200 ✅ `Added`
- GET /watchlist/check/BTCUSDT → 200 ✅ `{symbol, inWatchlist}`
- DELETE /watchlist/BTCUSDT → 200 ✅ `Removed`
- DELETE /watchlist/clear → 200 ✅ `Cleared`

### Analytics
- GET /analytics/overview → 200 ✅
- GET /analytics/full → 200 ✅ `{overview, daily, monthly, bySymbol, bySession}`
- GET /analytics/daily → 200 ✅
- GET /analytics/weekly → 200 ✅
- GET /analytics/monthly → 200 ✅
- GET /analytics/symbols → 200 ✅
- GET /analytics/sessions → 200 ✅

### Community
- GET /community/posts → 200 ✅ paginated
- POST /community/posts → 201 ✅
- POST /community/posts/:id/like → 200 ✅ `{liked, likeCount}`
- POST /community/posts/:id/bookmark → 200 ✅ `{bookmarked, bookmarkCount}`
- POST /community/posts/:id/share → 200 ✅ `{shared, shareCount}`
- POST /community/posts/:id/comments → 201 ✅
- GET /community/posts/:id/comments → 200 ✅
- POST /community/follow/qatester (self) → 400 ✅ `You cannot follow yourself`
- GET /community/followers (mine) → 200 ✅
- GET /community/following (mine) → 200 ✅
- GET /community/mutuals → 200 ✅
- GET /community/users/:handle/posts → 200 ✅

### Strategy
- GET /strategy → 200 ✅ paginated
- GET /strategy/my → 200 ✅
- POST /strategy → 201 ✅ `Strategy published`
- GET /strategy/:id → 200 ✅
- POST /strategy/:id/save → 200 ✅ `{saved:true}`
- GET /strategy/:id/reviews → 200 ✅ paginated

### Academy
- GET /academy → 200 ✅ paginated (empty — no courses seeded)
- GET /academy/my-progress → 200 ✅ `[]`

### Profile
- GET /profile/me → 200 ✅
- GET /profile/qatester → 200 ✅
- GET /profile/me/completeness → 200 ✅ `{percentage, missingFields[]}`
- GET /profile/me/stats → 200 ✅
- GET /profile/suggested → 200 ✅
- GET /profile/search?q=qa → 200 ✅ finds `qatester`

### Notifications
- GET /notifications → 200 ✅ paginated
- GET /notifications/unread-count → 200 ✅ `{count}`
- POST /notifications/read-all → 200 ✅ `All marked as read`

### Copy Trading
- GET /copy-trading/masters → 200 ✅ paginated (empty)
- GET /copy-trading/application → 200 ✅ `null` before creation
- POST /copy-trading/application → 201 ✅ creates `DRAFT` application
- GET /copy-trading/relationships → 200 ✅ paginated

### Risk
- GET /risk/score → 200 ✅ `{overall, grade, components, insights, recommendations, tradesAnalyzed, periodDays}`

### Copilot (live Groq call, model `openai/gpt-oss-20b`)
- GET /copilot/context → 200 ✅
- POST /copilot/chat → 200 ✅
- POST /copilot/analyze-journal → 200 ✅
- POST /copilot/interpret-analytics → 200 ✅

### Owner (RBAC gate)
- GET /owner/users (NORMAL_USER) → 403 ✅ `Insufficient permissions`
- GET /owner/audit-logs (NORMAL_USER) → 403 ✅
- GET /owner/settings/:key (NORMAL_USER) → 403 ✅
- Code review of `owner.ts` confirms every sub-route is gated by `requirePermission(...)` with the correct permission key (`user.suspend`, `user.ban`, `user.changeRole`, `user.viewAuditLog`, `admin.notification.broadcast`, `admin.settings.view/edit`), and the whole router is additionally gated by `router.use(authenticate, requirePermission("admin.dashboard.access"))`. The 200-for-admin path was not exercised live (would require promoting a real user to ADMIN/OWNER, which was intentionally not done against this database without explicit approval), but the gate logic itself is correct by inspection and by the verified 403 behavior above.

## ❌ Failing (0 routes)

None. Every endpoint in scope returned the expected status and shape once tested against its **actual** implemented path/schema (see Notes below for the handful of routes whose real path differs from my first-pass guess).

## ⚠️ Warnings (1)

- **Dead/legacy route module `apps/api/src/routes/user.ts`, mounted at `/users`** ⚠️ → **FIXED** (removed in Phase 2, see below).
  - It duplicated `GET/PUT /profile/*` and the follow/unfollow endpoints already properly implemented in `profile.ts` and `community/follow.ts`.
  - It queried Prisma directly from the route handler, bypassing the mandatory Repository → Service → Route layering used everywhere else in the codebase.
  - Its follow logic did not call `communityFollowService`, so a follow made through `/users/:handle/follow` would silently skip whatever side effects (e.g. notification-on-follow) the canonical path triggers — a latent data-inconsistency risk.
  - Confirmed zero references from `apps/web` (`grep` for `/users` in the frontend found nothing) and zero internal references outside `routes/index.ts`.

## Notes — test-script corrections (not API bugs)

A few endpoints initially "failed" against my first-pass test script; all were due to the script guessing the wrong path or body shape, not actual bugs. Confirmed by reading the route source:
- `/community/followers` and `/community/following` take **no `:handle` param** — they return the authenticated caller's own followers/following, not a lookup by handle. Per-handle equivalents don't exist by design (mutuals/suggested cover discovery).
- `/notifications/read-all` is a **POST**, not PUT.
- `/profile/me/completeness` (not `/profile/completeness` — the bare path falls through to the `/:handle` route and correctly 404s as "Profile not found" for a nonexistent handle "completeness", which is itself correct routing behavior, static-before-dynamic notwithstanding since `/me/completeness` *is* registered before `/:handle`).
- `POST /trade` requires `displayName`, `category`, `side: "BUY"|"SELL"` (not `"LONG"`), and `lotSize` (not `quantity`) — the validator correctly rejected my first malformed test payload with a precise `details` object.

## Database integrity (Phase 6, run in the same session — see summary)

All 6 checks clean: 0 orphaned journal entries, 0 stale open trades, 0 users missing `UserTradingIdentity`, 0 notifications >30 days old, `RolePermission` count = 60 (expected), `SystemSetting` = 3 rows with expected keys/values.

## Phase 5 — Duplicate calculation audit

- **Real bug found and fixed**: `apps/web/app/lib/trading/calculations.ts`'s `calcNetPnl()` (drives the *live* floating P&L shown while a position is open) computed commission as `notional × COMMISSION_RATE × 2`. The backend's `tradeService.closePosition()` (the authoritative, actually-settled figure) computes commission as `Math.abs(grossPnl) × COMMISSION_RATE` — a completely different basis. For a real test trade ($650 notional, $5 gross profit) this was the difference between a ~$0.0005 commission (backend, correct) and a ~$0.13 commission (frontend, what the trader was watching live) — the number a trader watched tick in real time did not match what they were actually paid out on close. Fixed the frontend formula to match the backend exactly, with a comment cross-referencing the two files so they don't drift apart again.
- **Balance**: confirmed in sync. Backend computes `balance = PAPER_INITIAL_BALANCE + SUM(netPnl of closed trades)` server-side on every close and pushes it back in the close response (`newBalance`); the frontend never recomputes balance locally — it only ever stores whatever the server last returned (`/trade/account` on init, `newBalance` after each close).
- **Win rate**: the Analytics page (`apps/web/app/analytics/page.tsx`, explicitly labeled "Paper Analytics · Local only") does perform its own client-side recalculation via `lib/analytics/performance.ts`'s `calculatePerformanceOverview()`, rather than calling `/analytics/*`. This is a deliberate, pre-existing architectural choice (instant local computation from already-fetched trade/journal data), not an oversight, so it was left as-is per "do not add new features." Its formula (`wins / totalClosedTrades × 100`) was verified to match the backend `analyticsService`'s formula exactly, so there is no numeric divergence risk despite the two code paths existing.
- **Not a duplicate**: `apps/web/app/store/riskStore.ts`'s `calculateRiskScore()` was initially flagged as a possible duplicate of the backend `/risk/score` endpoint, but on inspection they measure different things — `riskStore` is a live gauge of *current open-position exposure* (margin level, floating loss, position count), while the backend risk score is a *historical trading-behavior* score computed from closed-trade patterns. Confirmed not a bug.
