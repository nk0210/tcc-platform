# TCC Platform — Trader's Command Center

A full-stack paper-trading platform: live-simulated trading, a trade journal, performance analytics, a social community feed, copy-trading, an academy, and an AI trading assistant (**TCC Copilot**) that can act on a trader's behalf through a strict, human-in-the-loop confirmation system.

Monorepo managed with **pnpm workspaces** + **Turborepo**.

---

## Stack

| Layer | Tech |
|---|---|
| API | Node.js, Express 4, TypeScript, Prisma ORM, PostgreSQL, Zod, JWT auth, WebSocket (`ws`), Groq SDK |
| Web | Next.js 16 (App Router, Turbopack), React 19, Zustand, Tailwind CSS 4, Recharts |
| DB | PostgreSQL, Prisma (schema + migrations in `packages/db`) |
| Shared | `packages/types` — framework-agnostic TypeScript types shared by both apps |

---

## Monorepo layout

```
tcc-platform/
├── apps/
│   ├── api/                  # Express API (apps/api/src)
│   │   ├── routes/           # One router per module, mounted under /api
│   │   ├── server/
│   │   │   ├── services/     # Business logic (one per module)
│   │   │   ├── repositories/ # Prisma queries only, no business logic
│   │   │   ├── audit/        # Admin action audit log
│   │   │   ├── notifications/
│   │   │   └── permissions/  # RBAC cache/lookup
│   │   ├── middleware/       # authenticate, requirePermission, validate, rate limiting
│   │   ├── websocket/        # Live price feed + notification broadcast (ws://…/ws)
│   │   └── config/env.ts     # Single source of truth for all env vars (Zod-validated)
│   └── web/                  # Next.js frontend (apps/web/app)
│       ├── (app)/            # Authenticated app shell — one folder per page/module
│       ├── owner/            # Admin/owner dashboard (separate layout, permission-gated)
│       ├── components/       # Shared UI, incl. components/copilot/CopilotPanel.tsx
│       ├── store/            # Zustand stores, one per domain
│       └── lib/api/client.ts # Typed fetch wrapper (token refresh, etc.)
├── packages/
│   ├── db/                   # @tcc/db — Prisma schema, migrations, seed script
│   └── types/                # @tcc/types — shared TS types (no Prisma/Express imports)
├── COPILOT_CAPABILITY_MAP.md # What TCC Copilot can/can't do, and why — read this first
└── COPILOT_ASSESSMENT.md     # Original Copilot capability audit
```

---

## Features

- **Trading** — paper trading engine, live-simulated price feed over WebSocket, open/close positions, account state (balance/equity/margin).
- **Journal** — auto-created per closed trade; reflective fields (notes, lessons learned, emotion, confidence/stress, followed-plan, strategy tag).
- **Analytics** — aggregate performance, per-instrument and per-strategy breakdowns, date-range comparisons.
- **Watchlist** — per-user tracked instruments.
- **Risk score** — behavioral risk analysis (drawdown, consistency, position sizing, emotional/over-trading risk) from closed-trade history.
- **Community** — posts, comments, likes, bookmarks, follow graph, visibility rules (public/followers-only/private).
- **Strategies** — publish and browse trading strategies, saved-strategy lists.
- **Academy** — course catalog, enrollment, lesson/quiz progress, certificates.
- **Copy Trading** — master trader directory, copy relationships with configurable risk settings, copy-trade history (paper-copy only — no real-money execution path exists anywhere in the codebase).
- **Notifications** — in-app notifications, broadcast + targeted, delivered live over WebSocket.
- **Profile** — public/private profile fields, social links, trading identity, portfolio visibility.
- **Admin / Owner dashboard** — user management, action logs, reports, copy-trading oversight, system health — gated by an RBAC permission system (`Role`/`Permission`/`RolePermission` + `requirePermission` middleware).
- **TCC Copilot** — an AI agent (Groq-backed) that can read the user's own trading data and, for anything that writes data, only ever acts after the user explicitly confirms. See below.

---

## TCC Copilot

Copilot is the platform's AI trading assistant — a bounded tool-calling agent with one non-negotiable invariant:

```
model proposes → risk level fixed by the tool registry (never the model)
→ non-LOW action becomes PENDING_CONFIRMATION → user confirms
→ atomic ownership-scoped claim → the real TCC service executes
→ an interrupted multi-step request may resume, and any further write
  still needs its own fresh confirmation
```

It covers ~45 tools across trading, journal, watchlist, analytics, risk, academy, notifications, profile, community, and copy-trading; long-term memory (with governed create/edit/delete); full conversation history; hybrid deterministic + semantic retrieval with a pluggable embedding provider (Groq or any OpenAI-compatible endpoint, with graceful fallback to deterministic-only retrieval when no embedding provider is available); reliable provider handling (retry/backoff/timeout); and aggregate-only observability at `GET /api/copilot/metrics`.

**Read [`COPILOT_CAPABILITY_MAP.md`](./COPILOT_CAPABILITY_MAP.md)** for the full, honest breakdown of what's available, confirmation-required, deferred, or blocked — and why.

---

## Getting started

### Prerequisites

- Node.js 18+
- pnpm (`corepack enable` or `npm i -g pnpm`)
- PostgreSQL running locally (or a connection string to one)
- A [Groq API key](https://console.groq.com) (free tier works for chat; embedding-model access varies by account — see `COPILOT_EMBEDDING_PROVIDER` below)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp apps/api/.env.example apps/api/.env      # fill in DATABASE_URL, JWT secrets, GROQ_API_KEY
cp apps/web/.env.local.example apps/web/.env.local
```

Every API env var — required and optional, with defaults — is documented in `apps/api/.env.example`. Highlights:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Generate with `crypto.randomBytes(64).toString('hex')` |
| `GROQ_API_KEY` | Powers both Copilot chat and (if the account has access) embeddings |
| `COPILOT_EMBEDDING_PROVIDER` | `groq` (default) or `openai-compatible` (OpenAI itself, or a local Ollama/LM Studio/vLLM server) |
| `COPILOT_SEMANTIC_RETRIEVAL_ENABLED` | Set `false` to run Copilot on deterministic retrieval only |

### 3. Set up the database

```bash
pnpm generate                                    # prisma generate
pnpm --filter @tcc/db exec prisma migrate deploy # apply all migrations
```

### 4. Run

```bash
pnpm dev
```

This starts both apps via Turborepo:
- API → `http://localhost:4000` (routes under `/api`, WebSocket at `ws://localhost:4000/ws`, health check at `/api/health`)
- Web → `http://localhost:3000`

---

## Scripts

| Command (root) | What it does |
|---|---|
| `pnpm dev` | Run API + Web in dev mode (Turborepo) |
| `pnpm build` | Build both apps |
| `pnpm lint` | Lint both apps |
| `pnpm generate` | Regenerate the Prisma client |

Per-app (`apps/api` / `apps/web`):

| Command | API | Web |
|---|---|---|
| `pnpm dev` | `ts-node-dev` with hot reload | `next dev` (Turbopack) |
| `pnpm build` | `tsc` | `next build` |
| `pnpm typecheck` | `tsc --noEmit` | `tsc --noEmit` |
| `pnpm test` | `vitest run` (integration tests against a real dev Postgres DB) | — |
| `pnpm copilot:backfill-embeddings` | One-off resumable job to embed any memories/messages created before semantic retrieval was enabled | — |

`packages/db` also exposes `prisma studio`, `migrate:dev`, `migrate:deploy`, `migrate:reset`, and `seed`.

---

## API surface

All routes are mounted under `/api`. See `apps/api/src/routes/index.ts` for the authoritative list:

`/auth`, `/trade`, `/journal`, `/watchlist`, `/analytics`, `/owner`, `/community`, `/strategy`, `/academy`, `/profile`, `/copy-trading`, `/notifications`, `/risk`, `/copilot`, plus `/health`.

## Testing

The API's integration suite (`apps/api`, `vitest`) runs against a real local Postgres database using disposable test users — no mocked DB. Run it with:

```bash
cd apps/api && pnpm test
```

The AI provider layer is faked in tests (deterministic, network-free) — everything else (routes, services, repositories, confirmation flow, ownership checks) runs for real.
