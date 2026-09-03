# TCC Copilot — Capability Map (updated: final closure pass)

Full audit of every real TCC capability, what Copilot can safely expose for
each, and what's deliberately deferred and why. Originally compiled before
Phase 9's code, then updated again during the final production-hardening
pass (memory editing, conversation deletion, pluggable embeddings, expanded
community writes, confirmation-flow observability — see that pass's
completion report for the full list). "Production-backed" means a real
Prisma model + repository + service + route exists and is wired to the
frontend; "frontend-only" means UI/store exists with no real backend behind
it (Copilot must never be given a tool for anything frontend-only).

Tools already registered before Phase 9 are marked **(existing)**; tools
added in Phase 9 are marked **(Phase 9)**; tools added in the production-
hardening pass are marked **(Phase 11)**.

Every capability below reaches Copilot only through the one confirmation
architecture, unchanged since Phase 1: model proposes → risk level from the
tool registry (never the model or the user) → non-LOW becomes
PENDING_CONFIRMATION → user confirms → atomic ownership-scoped claim → the
real TCC service executes → an interrupted multi-step turn may resume, with
any further write needing its own fresh confirmation. Nothing documented
here is a second confirmation mechanism or a bypass of that flow.

---

## Trading — Trades

- **Frontend:** trading dashboard, trade history, `store/tradeStore.ts`
- **API routes:** `routes/trade.ts`
- **Service:** `tradeService.ts` — `getOpenPositions`, `getClosedTrades`, `getTradeById(id, userId)`, `getAccountState`, `openPosition`, `closePosition`
- **Repository:** `tradeRepository.ts` — every query scoped by `userId`
- **Prisma model:** `Trade` (`userId` ownership field)
- **Ownership:** `getTradeById(id, userId)` throws if not found *or* not owned — same-shape error either way
- **Production-backed:** yes
- **Copilot tools:**
  - `get_trades` (existing, LOW, read) — filtered list, bounded (`limit` ≤ 50)
  - `get_trade` (existing, LOW, read) — single trade by id, ownership-scoped
  - `get_account_state` (existing, LOW, read) — balance/equity/margin
- **Write tools:** none. Opening/closing a real position stays a deliberate UI-only action — Copilot never executes a trade on the user's behalf (unchanged since Phase 1).
- **Blockers:** none for what's exposed.

## Trading — Analytics

- **Frontend:** analytics dashboard
- **Service:** `analyticsService.ts` — `getOverview`, `getSymbolStats`, `getStrategyStats`
- **Production-backed:** yes
- **Copilot tools:** `get_trading_analytics`, `get_instrument_performance`, `get_strategy_performance` (all existing, LOW, read) — all accept an optional `from`/`to` date range, letting the agent compare periods with two calls rather than needing a dedicated comparison tool.
- **Write tools:** N/A (derived data, nothing to write).

## Trading — Risk

- **Service:** `riskScoreService.ts` — `calculateRiskScore(userId)`, distinct from the frontend's separate live-exposure gauge (confirmed not a duplicate in the Phase 4 audit)
- **Production-backed:** yes
- **Copilot tools:** `get_risk_score` (existing, LOW, read)
- **Write tools:** N/A — the score is derived, not editable.

## Trading — Watchlist

- **Service:** `watchlistService.ts`, keyed by `(userId, symbol)` — no standalone item id
- **Prisma models:** `Watchlist` (1:1 per user), `WatchlistItem`
- **Production-backed:** yes
- **Copilot tools:** `get_watchlist` (LOW, read), `add_watchlist_item` / `remove_watchlist_item` (MEDIUM, write) — all existing since Phase 2/4
- **Context-orchestrator entity type:** NOT added — items have no fetchable single-record id (see "Deferred entity types" below). Re-confirmed in the production-hardening pass: still no clean single-record lookup, still correctly deferred.

## Journal

- **Service:** `journalService.ts` — entries are always auto-created as a side effect of `tradeService.closePosition()`; there is no standalone "freeform note" creation path
- **Repository:** `journalRepository.findById(id, userId)`, `findByUserId`, etc. — ownership-scoped
- **Production-backed:** yes
- **Copilot tools:** `get_journal_entries` (existing, LOW, read), `update_journal_entry` (existing, MEDIUM, write — only the reflective fields: notes, lesson learned, emotion, confidence/stress, followed-plan, strategy tag, quality, tags)
- **Context-orchestrator entity type:** `"journal"` (Phase 8) — `journalRepository.findById(id, userId)`
- **Blockers:** a `create_journal_entry` tool is not implemented — no backend capability to create a standalone entry exists (would need a schema change, out of scope).

## Academy

- **Frontend:** course catalog, enrollment, lesson/quiz progress, certificates
- **Service:** `academyService.ts` — `getAllCourses`, `getCourse`, `enrollInCourse(userId, courseId)` (idempotent), `getAllUserProgress`, `getProgress`
- **Prisma models:** `Course`, `Lesson`, `AcademyProgress` (`@@unique([userId, courseId])`)
- **Production-backed:** yes (re-confirmed from the Phase 4 audit, which itself corrected an earlier assumption that Academy was frontend-only)
- **Copilot tools:**
  - `get_academy_progress` (existing, LOW, read)
  - `get_academy_courses` (Phase 9, LOW, read) — the catalog, so the model can find a `courseId` before enrolling
  - `enroll_course` (Phase 9, MEDIUM, write) — `academyService.enrollInCourse`, verifies the course exists, idempotent
- **Blockers:** lesson-level progress tools (mark lesson complete, submit quiz) not added — no compelling "ask Copilot to do this" use case identified, and it would mean exposing per-lesson write semantics not yet audited in depth. Deferred, not blocked by security.
- **Context-orchestrator entity type:** re-audited in the production-hardening pass and still NOT added. `academyService.getCourse(courseId, viewerId?)` exists but answers "course + is this viewer enrolled", not "does this user own this entity" — a course isn't user-owned, only its progress row is, which is one hop removed from the clean ownership check every other entity type uses. Adding it would mean writing new service logic, which the hardening pass's own ground rules ruled out ("never invent repository logic just to add entity types").

## Notifications

- **Service:** `notifications/notificationService.ts` — `listNotifications`, `createNotification` (internal, used by other services)
- **Production-backed:** yes
- **Copilot tools:** `get_notifications` (existing, LOW, read)
- **Write tools:** none — mark-as-read/delete deferred since Phase 4, still no compelling need identified.

## Profile

- **Service:** `profileService.ts` — `getOwnProfile`, `updateProfile(userId, input)`, `updateSocialLinks`, `updateTradingIdentity`, `getTradingStats`
- **Prisma models:** `User` (core fields), `UserSocialLinks`, `UserTradingIdentity`
- **Production-backed:** yes
- **Copilot tools:**
  - `get_user_profile` (existing, LOW, read)
  - `update_profile` (Phase 9, MEDIUM, write) — `displayName`, `bio`, `location`, `experienceLevel`, `profileVisibility`, `portfolioVisibility`. Deliberately excludes `avatarUrl` (a URL/upload concern, not conversational).
- **Blockers:** `updateSocialLinks`/`updateTradingIdentity` audited but not wrapped this phase — safe to add later (same ownership pattern), left out to control scope; `UserTradingIdentity` in particular already has a narrow overlap with Phase 7 `TRADING_PREFERENCE` memory (confirmed non-duplicative in the Phase 7 audit: one is a structured, publicly-displayed profile field, the other is private conversational memory).

## Strategies

- **Service:** `strategyService.ts` — `getStrategy(strategyId, viewerId?)` is public-read (no ownership gate); ownership for mutation is checked inline in `updateStrategy`/`deleteStrategy` (`strategy.authorId === userId`), not exposed as a reusable ownership-lookup function.
- **Production-backed:** yes
- **Copilot tools:** none. Audited in the production-hardening pass and deliberately not added this pass — no existing tool module, and no compelling identified use case for a chat-driven strategy read/write yet.
- **Context-orchestrator entity type:** audited, NOT added — there's no `getOwnedStrategy(id, userId)`-shaped function the way `copyTradingService.getOwnedRelationship()` exists for copy relationships; adding one would mean writing new service logic rather than wiring something that already exists, which the hardening pass's ground rules ruled out. A future phase could add a thin `getOwnedStrategy()` wrapper (same shape as the copy-trading one) if a real use case emerges.

## Community

- **Frontend:** feed, post detail, profile feeds
- **Services:** `communityPostService.ts`, `communityCommentService.ts`, `communityInteractionService.ts`, `communityFeedService.ts`, `communityFollowService.ts`
- **Prisma models:** `CommunityPost`, `CommunityComment`, `PostLike`, `CommentLike`, `SavedPost`, `PostShare`, `Follow`
- **Ownership pattern:** post/comment `update`/`delete` are ownership-checked at the **service** layer (`post.authorId !== userId`), not at the repository's `WHERE` clause — safe as long as every Copilot tool goes through the service, never the repository directly (every tool below does)
- **Production-backed:** yes, extensively
- **Copilot tools (all Phase 9):**
  - `get_community_feed` (LOW, read) — global or following scope
  - `get_post` (LOW, read) — single post, respects visibility
  - `get_post_comments` (LOW, read) — **hardened**: `communityCommentService.getComments()` does not itself re-check a private/followers-only post's visibility (confirmed by reading its implementation), so this tool calls `getPost()` first and fails closed — otherwise it would be a more permissive path than the REST route itself provides for reading a post
  - `get_follow_status`, `get_followers`, `get_following` (LOW, read)
  - `create_post` (MEDIUM, write) — always `type: "TEXT"`; never accepts a model-supplied `linkedTradeId`/`linkedStrategyId`/etc, so Copilot can never assert an unverified cross-reference as a real link
  - `add_comment` (MEDIUM, write) — **same visibility hardening as `get_post_comments`**: `communityCommentService.addComment()` also doesn't re-check visibility (confirmed — and neither does the existing `POST /community/posts/:postId/comments` route itself, which was found to have the same gap), so this tool independently verifies visibility via `getPost()` before commenting. This is a real, pre-existing gap in the platform's own REST API, not something Phase 9 introduced — noted here rather than fixed at the route level, which is outside this phase's remit.
- **Copilot tools (Phase 11 — production-hardening pass):**
  - `edit_post` (MEDIUM, write) — `communityPostService.updatePost()`; content only (not visibility/tags, same narrow-scope reasoning as `create_post`). Ownership enforced by the service itself (`NotPostAuthorError`), surfaced as a clear tool error rather than the raw exception.
  - `delete_post` (MEDIUM, write) — `communityPostService.deletePost()`, always called with `isAdmin: false` — Copilot can only ever delete a post as its own author, never with elevated privilege. Destructive and irreversible; `describeAction` says so explicitly in the confirmation prompt.
  - `toggle_post_like` (MEDIUM, write) — `communityInteractionService.togglePostLike()`, a toggle (not separate like/unlike endpoints) matching the backend's own shape; the model reads `get_post`'s `isLiked` field first to know which way the toggle will go. **Hardened** the same way as `add_comment`/`get_post_comments`: `togglePostLike()` itself only checks the post isn't admin-hidden, not PRIVATE/FOLLOWERS_ONLY visibility, so this tool calls `getPost()` first and fails closed.
  - `toggle_post_bookmark` (MEDIUM, write) — same shape and same visibility hardening, over `communityInteractionService.toggleBookmark()`.
  - All four kept **MEDIUM risk**, deliberately, even though like/bookmark are trivially reversible — classifying them LOW (auto-execute) would make them the first-ever auto-executing write tool in the system, breaking the unbroken "every write is confirmed" precedent every prior phase preserved. That tradeoff was re-considered, not overlooked, and decided the same way again.
- **Copilot tools (final closure pass — comments and follow):**
  - `edit_comment` / `delete_comment` (MEDIUM, write) — `communityCommentService.editComment()`/`deleteComment()`, same shape as `edit_post`/`delete_post`; ownership enforced by the service itself (`NotCommentAuthorError`). `delete_comment` always calls with `isAdmin: false`.
  - `follow_user` / `unfollow_user` (MEDIUM, write) — `communityFollowService.followUser()`/`unfollowUser()`. **This pass fixed a real bug at the source** before wiring the tool: `followUser()` declared a `PrivateProfileError` (and the REST route at `routes/community/follow.ts` already handled it) but never actually threw it — a PRIVATE-visibility profile could be followed by anyone, through the REST API too, not just a hypothetical Copilot tool. Fixed by adding the missing `if (target.profileVisibility === "PRIVATE") throw new PrivateProfileError()` check in `communityFollowService.followUser()` itself, using data (`profileVisibility`) the repository already fetched but the service never read. This is the minimal fix — it does not build out a follow-request/approval workflow for private profiles (the schema's `FollowStatus.PENDING` value remains unused, as before); it makes following a private profile fail outright, matching what the pre-existing error class and REST route already expected to happen. `unfollow_user` carries no privacy concern and isn't gated. Self-follow is rejected by the service's existing `CannotFollowSelfError`.
- **Still deliberately NOT exposed:** admin moderation (hide/unhide post or comment) — explicitly permission-gated, never reachable by a general-purpose personal-assistant tool.
- **Context-orchestrator entity type:** `"community_post"` (Phase 9) — `communityPostService.getPost(id, userId)` plus `authorId === userId` (visibility ≠ ownership; a public post someone else authored is readable but never a *verified-owned* pointer)

## Copy Trading

- **Frontend:** master trader directory, copy relationship management, `store/copyTradingStore.ts`
- **Service:** `copyTradingService.ts`
- **Prisma models:** `MasterTraderApplication`, `MasterTrader`, `CopyRelationship`, `CopyFeeModel`, `CopyTradeHistory`
- **Ownership pattern:** `getOwnedRelationshipOrThrow(relationshipId, followerUserId)` — used internally by every relationship mutation; a public `getOwnedRelationship()` wrapper was added this phase (thin, reuses the same check) specifically for the context orchestrator's entity verification
- **Production-backed:** yes
- **Real-money risk — audited and confirmed dead:** `CopyMode` has a `LIVE_COPY` value in the schema, but no route/service code path ever sets it — every relationship `copyTradingService.createRelationship`/`recordCopyTrade` creates is `PAPER_COPY` by construction. No Copilot tool below accepts or produces a `mode` argument, so there is no path through which a tool call could ever imply real-money copying.
- **Copilot tools (all Phase 9):**
  - `get_master_traders` (LOW, read) — public discovery, always filtered to `status: "ACTIVE"`
  - `get_copy_relationships` (LOW, read) — own relationships only
  - `get_copy_history` (LOW, read) — **hardened**: `copyTradingRepository.findCopyHistory()` has no built-in `followerUserId` scoping guarantee if the filter is omitted (confirmed by reading it), so this tool hardcodes `followerUserId: ctx.userId` itself rather than trusting the repository
  - `start_copying` (MEDIUM, write) — optional risk settings, same bounds as the existing REST route's Zod schema
  - `stop_copying` / `pause_copying` / `resume_copying` (MEDIUM, write)
  - `update_copy_risk_settings` (MEDIUM, write)
- **Deliberately NOT exposed:** master-trader application tools (apply/edit/submit) — a KYC-flavored onboarding flow with legal-disclosure checkboxes (`hasAcceptedRiskDisclosure`, etc.), better handled by the dedicated UI than a chat action; every admin moderation function (review/approve/reject applications, suspend/remove masters) — permission-gated, and `approveApplication` mutates a *different* user's roles, out of scope for a personal-assistant tool regardless of the caller's own permissions.
- **Context-orchestrator entity type:** `"copy_relationship"` (Phase 9) — `copyTradingService.getOwnedRelationship(id, userId)`

## Competition

- **Frontend:** `app/(app)/competition/page.tsx`, `store/competitionStore.ts` — entirely mock/local Zustand state (`mockCompetitions`, `mockParticipants`), fake ids via `Date.now().toString()`, no API calls
- **Backend:** **NOT FOUND** — no `Competition` Prisma model, no route, no service, no repository. `PostType.COMPETITION_UPDATE`, `NotificationType.COMPETITION`, and `CommunityPost.linkedCompetitionId` are unused enum/scaffold surface area referencing an entity that doesn't exist; `competition.*` permission keys exist only as seed placeholders explicitly commented `// competition (future)`.
- **Production-backed:** **no — frontend-only**
- **Copilot tools:** none, and none should ever be added against the current mock store — there is nothing real to call. Confirmed as the correct, already-established position (this matches the Phase 4 audit's finding, re-verified for Phase 9).

## Copilot Memory (Phase 7, editing added in the production-hardening pass)

- Not a TCC platform capability in the same sense as the above — this is Copilot's own long-term memory of the user, layered on top of everything else. Included here because Phase 9 explicitly combines it with real TCC data (see the Phase 9 report's "Memory + TCC Intelligence" section).
- **Copilot tools:** `get_memories`, `propose_memory`, `delete_memory` (all existing, Phase 7) — unchanged.
- **REST API (not a Copilot tool — user-facing memory management UI, MemoryOverlay):** `GET/DELETE /copilot/memories[/:id]` (existing) plus **`PATCH /copilot/memories/:id`** (production-hardening pass) — edits a memory's content through the exact same governance `persistMemory()` enforces at creation: sanitization, secret-content rejection, normalization, dedup-against-siblings (an edit that now exactly restates another active memory of the same type merges into it, marking the edited row SUPERSEDED rather than keeping a duplicate), conflict-axis resolution, and an async embedding refresh (the stale vector is cleared synchronously so the row is never served as a stale semantic match while the refresh is in flight). Ownership enforced by the same conditional-UPDATE pattern as every other Copilot mutation — 404 for not-found, not-owned, or already-superseded/deleted alike.

## Copilot Conversations (Phase 6, deletion added in the production-hardening pass)

- Not a TCC platform capability either — conversation history/management. `GET /copilot/conversations[/:id]` (existing) plus **`DELETE /copilot/conversations/:id`** (production-hardening pass) — ownership-scoped conditional delete; `CopilotMessage`/`CopilotToolExecution` cascade at the schema level (`onDelete: Cascade`), so one DELETE call safely removes every message and pending-action row that belonged to the conversation, including cascading away a still-PENDING_CONFIRMATION action (confirming it afterward correctly 404s — there is nothing left to confirm). Frontend: HistoryOverlay's per-conversation delete button, two-step in-panel confirm (click once to arm, again to confirm) rather than a native browser dialog.

## Copilot Embedding Provider (Phase 10, made pluggable in the production-hardening pass)

- Not a TCC platform capability — Copilot's own semantic-retrieval backend. `COPILOT_EMBEDDING_PROVIDER` selects `"groq"` (default, reuses `GROQ_API_KEY`) or `"openai-compatible"` (calls `COPILOT_EMBEDDING_BASE_URL` directly via `fetch`, covering OpenAI itself or a local/self-hosted server — Ollama, LM Studio, vLLM — that implements the same `POST /embeddings` shape). No new npm dependency for the second provider. Every failure mode (disabled, unconfigured, wrong provider selected, timeout, non-2xx response, network error) degrades to deterministic-only retrieval — never a hard failure, never a fake vector. See `.env.example` for the complete set of `COPILOT_EMBEDDING_*` variables.
- **Infrastructure limitation, re-confirmed in the final closure pass:** this environment's `GROQ_API_KEY` still has no embedding-model access, so semantic retrieval against a real Groq embedding call remains architecturally complete but unverified live here — an external configuration limitation, not a code defect. The OpenAI-compatible path is verified against a real HTTP mock (no live external embedding server was available to point at either).

## Copilot Observability — GET /copilot/metrics (final closure pass)

- **Available, authenticated, aggregate-only.** Surfaces `copilotObservability.ts`'s in-memory `getProviderMetricsSnapshot()` — provider call/success/failure/retry counts, rate-limit/timeout counts, average latency, total tokens, agent turns/tool calls, and (new this pass) `actionsExecuted/Failed/Cancelled/Expired`, `continuationsResumed`, and derived `confirmationRate`/`cancellationRate`/`expiredRate`. Process-lifetime, in-memory, resets on restart — deliberately not a persistent metrics store (no new infrastructure introduced). Never returns prompts, message content, tool arguments/output, or secrets — only counts and rates, verified by a dedicated test that posts a real chat message and asserts its content cannot be found anywhere in the metrics response.

---

## Deferred entity types (context orchestrator)

Audited against the Phase 8 pattern ("client entity id → authenticated userId → service ownership lookup → verified entity") and found to need new service logic beyond what "extend carefully" allows:

- **watchlist item** — no fetchable single-record id; items are keyed by `(userId, symbol)`, not addressable the way a trade/journal/post/relationship id is.
- **academy lesson** — a lesson belongs to a course, not to a user; "owned" would really mean "enrolled in the lesson's course", one hop removed from the clean ownership checks every other entity type uses.
- **competition** — no real backend at all (see above).

## Registry organization (Step 2)

`copilotToolRegistry.ts`'s `ToolDefinition` gained two optional metadata fields this phase: `capability` (a short dotted path, e.g. `"copy_trading.relationships"`) and `readOnly` (documentation/observability only — the actual auto-execute-vs-confirm decision remains `riskLevel` alone, unchanged). Every existing tool was tagged retroactively; every new tool is tagged at creation. Neither field carries any authorization weight — see `copilotToolRegistry.ts`'s updated doc comment. The registry's `FORBIDDEN_ARG_KEYS` check was also widened this phase from `userId`-only to also reject `riskLevel`, `permission`, `permissions`, `ownerId`, `ownerUserId` as tool-schema keys, closing the gap Phase 9's Step 2 explicitly called out.
