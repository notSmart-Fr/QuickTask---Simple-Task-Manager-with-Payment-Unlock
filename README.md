# QuickTask

A simple task manager with payment unlock. Free users get 3 tasks; $5 one-time Stripe payment unlocks unlimited tasks. Kanban-style drag-and-drop, full-stack Effect-TS, hexagonal architecture.

**Live**: [https://quick-task-simple-task-manager-with.vercel.app](https://quick-task-simple-task-manager-with.vercel.app)

---

## Architecture

Feature-driven hexagonal (ports & adapters), enforced at build time via ESLint bans. `main.ts` is the single composition root — only it instantiates adapters. `core/` is pure domain logic (no frameworks, no I/O).

Architecture rules are encoded as [ESLint flat config bans](backend/eslint.config.mjs) — violated imports break the build. Full architecture doc: [.knowledge/whitebox/](.knowledge/whitebox/). Project scope and agent guidance: [AGENTS.md](AGENTS.md).

Every request follows: **Zod at boundary → Effect pipeline → `_tag`-based error routing** — same pattern end-to-end from frontend to backend.

### Development Approach

- **Spec-driven**: Features designed via [spec-kit](https://github.com/github/spec-kit) — spec → plan → tasks → implement workflow. See [specs/](specs/) for feature specs.
- **Hexagonal architecture**: Core owns contracts (ports), adapters implement them, composition root wires them. ESLint ban rule #16 prevents `new AdapterClass()` outside `main.ts`.
- **Strict boundaries**: Ban rules 1-16 cover everything from `any` types to `Date.now()` in core. `try/catch` forbidden in `core/` and `api/` — all error handling goes through Effect error channels.

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

- **Effect-TS everywhere**: Both frontend and backend use the same Effect-TS error types (`Data.TaggedError`). The frontend bridge (`runEffect`) converts Effect pipelines to TanStack Query promises while preserving typed errors. This means UI can pattern-match on `error._tag` the same way backend routes do.

- **Manual Kanban positioning**: Tasks use a `position` integer for ordering, not a linked list or fractional indexing. New tasks go to the bottom of TODO (position = count of existing TODO tasks). Drag-and-drop renumbers via `shiftPositions` in a Prisma transaction. Simple but works for the scale.

- **Optimistic updates**: Dragging a task immediately repositions it in the TanStack Query cache. On mutation error, the cache rolls back to the previous snapshot. The brief visual "snap" after server confirmation is a known trade-off for simplicity.

- **Password visibility**: Both login and register pages have Show/Hide toggles. Form errors clear on any field change (both Zod validation errors and server errors like "Invalid credentials").

- **Login form feedback**: The login page was the second form to get the error-clearing + password-toggle treatment. The register page had it first, login was missed initially — both now match.

- **Prisma v5 not v7**: Render's global `npx` resolves to Prisma 7 but the project uses Prisma 5.22. Build uses `pnpm install` with a `postinstall: "prisma generate"` script that calls the local binary. Moving `prisma` and `tsx` from devDependencies to dependencies was necessary for Render's production-only install.

- **CORS trailing slash**: Render env vars sometimes include trailing slashes, which breaks CORS origin matching. `main.ts` strips trailing slashes from `FRONTEND_URL` with `.replace(/\/+$/, "")`.

- **DragOverlay duplicate IDs**: `@dnd-kit` DragOverlay renders a second copy of the task card, which caused duplicate form element IDs. Fixed by passing `variant="overlay"` to hide interactive elements in the overlay and using React `useId()` instead of `task.id`.

- **Kanban pointerWithin + midpoint splitting (production-grade)**: The Kanban drag-and-drop uses `pointerWithin` from `@dnd-kit/core` — collision detection based on the **exact cursor (x, y) coordinate**, not card bounding-box overlap. This eliminates adjacent-column collision bugs entirely. On drop, `calcDropPosition` computes the target card's vertical midpoint. If the pointer is above midpoint → insert before the card; below midpoint → insert after. This is the same 50% threshold logic Trello, Jira, and Linear use. The current cursor Y is derived from `activatorEvent.clientY + delta.y` (activation point + cumulative drag delta). A fallback to `overTask.position` handles keyboard navigation where `over.rect` is unavailable.
