# QuickTask

A simple task manager with payment unlock. Free users get 3 tasks; $5 one-time Stripe payment unlocks unlimited tasks. Kanban-style drag-and-drop with fractional indexing, full-stack Effect-TS, Vertical Slice Architecture.

**Live**: [https://quick-task-simple-task-manager-with.vercel.app](https://quick-task-simple-task-manager-with.vercel.app)

---

## Architecture

**Vertical Slice Architecture** — every feature is a self-contained folder owning its routes, service logic, database calls, and switchable driver contracts. `main.ts` is the single composition root — only it instantiates services and drivers.

```
backend/src/features/
  auth/     → auth.service.ts, auth.routes.ts       (Hasher, TokenService injectable)
  tasks/    → tasks.service.ts, tasks.routes.ts      (direct Prisma calls)
  payment/  → payment.service.ts, payment.routes.ts, driver.stripe.ts  (PaymentGateway injectable)
```

Architecture rules are encoded as [ESLint flat config bans](backend/eslint.config.js) — violated imports fail lint. Full architecture doc: [.knowledge/whitebox/](.knowledge/whitebox/). Project scope and agent guidance: [AGENTS.md](AGENTS.md).

Every request follows: **Zod at boundary → Effect pipeline → `_tag`-based error routing** — same pattern end-to-end from frontend to backend.

### Key Architectural Decisions

- **No repository layer**: Services call Prisma directly. Only payment gateway, hasher, and token service have switchable interfaces (Selective Switchability).
- **Fractional Indexing**: Task positions are `Float` values (midpoints between neighbors). Drag-and-drop updates one database row — no shifting of other tasks.
- **Effect-TS everywhere**: `try/catch` is forbidden in `features/`. Errors flow through `Data.TaggedError` + `Effect.either` + `_tag` matching.
- **ESLint bans consolidated**: All prohibitions in a single `src/features/**/*.ts` block to avoid flat config override issues.

---

## Local Setup

### Prerequisites

- **Node.js** 20+
- **pnpm** 9.15+ (enable with `corepack enable`)
- **PostgreSQL** 14+ (local or [Neon](https://neon.tech) free tier)
- **Stripe** account (free test mode)

### 1. Backend

```bash
cd backend

# Install dependencies
pnpm install

# Create .env from the example
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
# JWT_SECRET: openssl rand -hex 32
# Stripe keys: https://dashboard.stripe.com/test/apikeys

# Run database migration
npx prisma migrate dev

# Start dev server (port 4000)
pnpm dev
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Create .env.local from the example
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_URL (default: http://localhost:4000/api/v1)
# Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY from Stripe dashboard

# Start dev server (port 3000)
pnpm dev
```

### 3. Stripe Webhooks (local)

```bash
# Install Stripe CLI, then:
stripe listen --forward-to localhost:4000/api/v1/payment/webhook
# Copy the signing secret from output → STRIPE_WEBHOOK_SECRET in backend/.env
```

**You must keep `stripe listen` running** while testing payments locally. Stripe can't reach
`localhost` directly — the CLI creates a tunnel. The signing secret from the CLI is different
from the one in your Stripe Dashboard (which is used for production).

On deployment, you configure the webhook URL in the [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
(e.g. `https://your-app.com/api/v1/payment/webhook`) and set its signing secret as the
`STRIPE_WEBHOOK_SECRET` env var. No CLI needed — Stripe calls your public URL directly.

### 4. Verify

- Open [http://localhost:3000](http://localhost:3000) → register a user
- Create up to 3 tasks — drag them between columns
- Click "Unlock Unlimited Tasks" → Stripe Checkout → back to dashboard

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `JWT_SECRET` | Yes | Min 32 chars — `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret (`whsec_...`) |
| `PORT` | Yes | Server port (local: 4000, Render: 10000) |
| `FRONTEND_URL` | Yes | CORS allowed origin |
| `NODE_ENV` | No | `development` (default), `test`, `production` |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL + `/api/v1` (e.g. `http://localhost:4000/api/v1`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key (`pk_test_...`) |

---

## Commands

```bash
# Backend
cd backend
pnpm dev              # Start dev server (port 4000, auto-reload)
pnpm test             # Run tests (Vitest)
pnpm typecheck        # TypeScript check (tsc --noEmit)
pnpm lint             # ESLint
npx prisma generate   # Rebuild Prisma client after schema changes
npx prisma migrate dev --name <name>   # Create new migration

# Frontend
cd frontend
pnpm dev              # Start Next.js dev server (port 3000)
pnpm test             # Run tests (Vitest)
pnpm typecheck        # TypeScript check
pnpm lint             # ESLint
```

---

## Deployment

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect the GitHub repo
3. Settings → **Node** runtime (not Docker), **pnpm**
4. Build command: `pnpm install`
5. Start command: `pnpm start`
6. Add all backend env vars in the Render dashboard
7. After deploy, open **Render Shell** and run: `npx prisma migrate deploy`
8. Set Stripe webhook endpoint to `https://<your-render-url>/api/v1/payment/webhook`

### Frontend → Vercel

1. Import the repo on [Vercel](https://vercel.com)
2. Root Directory: `frontend`
3. Framework Preset: Next.js
4. Install command: `cd ../ && pnpm install` (Vercel installs at root)
5. Add `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in env vars

Live Render's free tier spins down after 15 min idle — first request after idle takes ~30s.

---

## Implementation Notes

- **Effect-TS everywhere**: Both frontend and backend use the same Effect-TS error types (`Data.TaggedError`). The frontend bridge (`runEffect`) converts Effect pipelines to TanStack Query promises while preserving typed errors. UI pattern-matches on `error._tag` the same way backend routes do.

- **Fractional Indexing (drag-and-drop)**: Task positions are `Float` values, not sequential integers. When dragging, the frontend computes the midpoint between neighboring cards using `arrayMove`. The backend performs a single-row UPDATE — no shifting of other tasks, no transaction needed. Positions: top = `firstPos / 2`, middle = `(prev + next) / 2`, bottom = `lastPos + 100`.

- **Layered collision detection**: `@dnd-kit/core` with `pointerWithin` (exact cursor position) falling back to `closestCorners` (column droppable). `DropSpacer` components at the bottom of each column provide visible "drop here" zones. This eliminates the adjacent-column collision bugs common with `closestCorners` alone.

- **Selective Switchability**: Payment gateway (`PaymentGateway` interface), auth hasher (`Hasher` interface), and token service (`TokenService` interface) are injectable at the composition root. Tasks use direct Prisma calls — no abstraction where none is needed (YAGNI).

- **Optimistic updates**: Dragging a task immediately repositions it in the TanStack Query cache. On mutation error, the cache rolls back to the previous snapshot.

- **ESLint bans consolidated**: All 15+ bans live in a single `src/features/**/*.ts` config block. Prior flat config had them split across 3 overlapping blocks, which silently replaced each other — the `try/catch` ban was dead code. Now all prohibitions (Date.now, Math.random, JSON.parse, process.env, $queryRaw, try/catch, etc.) apply together.

- **Prisma v5**: The project uses Prisma 5. Render's global `npx` resolves to Prisma 7. Build uses `pnpm install` with a `postinstall: "prisma generate"` script calling the local binary.

- **CORS trailing slash**: Render env vars sometimes include trailing slashes, which break CORS origin matching. `main.ts` strips trailing slashes from `FRONTEND_URL` with `.replace(/\/+$/, "")`.

- **DragOverlay duplicate IDs**: `@dnd-kit` DragOverlay renders a second copy of the task card, which caused duplicate form element IDs. Fixed by passing `variant="overlay"` to hide interactive elements in the overlay and using React `useId()` instead of `task.id`.
