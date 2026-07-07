# QuickTask — Reconstructed Architecture

## Triage Verdict: Suspicious (6/7)

| Pillar | Check | Result |
|--------|-------|--------|
| P1 — Perimeter | Every route uses Zod `safeParse` at boundary | ✅ PASS |
| P2 — Core Purity | All domain logic in `features/` uses Effect, no try/catch | ✅ PASS |
| P3 — Polarity | Each feature owns its contracts (interfaces, drivers); `main.ts` is sole composition root | ✅ PASS |
| P4 — Resilience | Atomic $transaction in payment webhook + createTask; SIGTERM/SIGINT handler with `prisma.$disconnect()` | ✅ PASS |
| P5 — Security | Zero hardcoded secrets in source | ✅ PASS |
| P6 — State Evolution | Prisma migrations exist; **no down/rollback migrations** | ❌ FAIL |
| P7 — Observability | `/health` endpoint with DB connectivity probe (`SELECT 1`); **no structured logging, PII masking, or distributed tracing** | ✅ PASS |

## What It Is

A simple task manager with payment unlock. Free users get 3 tasks; $5 one-time Stripe payment unlocks unlimited tasks. Vertical Slice Architecture with Effect-TS throughout the full stack.

## Stack

- **Backend**: Express 5, TypeScript strict, Effect-TS 3.x, Zod, Prisma + PostgreSQL (Neon)
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, TanStack Query, @dnd-kit
- **Auth**: JWT (7-day expiry), bcryptjs, stateless
- **Payments**: Stripe Checkout ($5 one-time), webhook idempotency
- **Testing**: Vitest, supertest
- **Package Manager**: pnpm

## Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│                      COMPOSITION ROOT                       │
│  main.ts                                                    │
│  ── new PrismaClient()                                      │
│  ── new AuthService(prisma)                                 │
│  ── new TaskService(prisma)                                 │
│  ── new StripeGateway()                                     │
│  ── new PaymentService(prisma, stripeGateway)               │
│  ── createAuthRouter(authService)                           │
│  ── createTaskRouter(taskService)                           │
│  ── createPaymentRouter(paymentService)                     │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────────────────────────────────────────────┐
│              FEATURES (Vertical Slices — backend)            │
│                                                              │
│  auth/                        task/                    payment/
│    auth.service.ts               tasks.service.ts        payment.service.ts
│      Hasher (interface)            createTask() → Task      PaymentGateway (interface)
│      TokenService (interface)      listTasks()  → Task[]    createCheckout() → url
│      BcryptHasher (impl)           deleteTask() → Task      handleWebhook() → void
│      JwtToken (impl)               updateTaskStatus() → Task│
│      AuthService.register()        FREE_TASK_LIMIT = 3      driver.stripe.ts
│      AuthService.login()           Task // domain types       StripeGateway (implements PaymentGateway)
│      AuthService.getUserWithFreshToken()                    │
│    auth.routes.ts               tasks.routes.ts           payment.routes.ts
│      Zod.safeParse →              Zod.safeParse →           Zod.safeParse →
│      Effect.either →              Effect.either →           Effect.either →
│      _tag match                   _tag match                _tag match
│                                                              │
│  EFFECT-TS (Zod at Boundary, Effect in Core)                 │
│                                                              │
│  All errors: Data.TaggedError                                │
│    EmailAlreadyRegistered, InvalidCredentials,               │
│    TaskLimitReached, TaskNotFound,                           │
│    WebhookVerificationFailed, PaymentRecordNotFound          │
│                                                              │
│  PrismaClient is injected directly — no repository layer     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│              CROSS-CUTTING (backend)                         │
│                                                              │
│  middleware/auth.middleware.ts                                │
│    JWT verify → sets req.user                                │
│  types/express.d.ts                                          │
│    Express Request augmentation for req.user                 │
│  config.ts                                                   │
│    Zod-validated env vars, crashes on startup if missing     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 15)                     │
│                                                              │
│  app/                      features/              lib/       │
│    login/page.tsx            auth/                  effect-client.ts
│    register/page.tsx           auth.api.ts           (fetch + Effect.tryPromise)
│    dashboard/page.tsx          auth.effect.ts        errors.ts
│                                auth.schema.ts        (HttpError, NetworkError
│  providers.tsx                 password-input.tsx     — Data.TaggedError)
│    QueryClientProvider         password-toggle-icon  auth-context.tsx
│    AuthProvider              tasks/
│                                tasks.api.ts           (TanStack Query hooks
│                              with runEffect bridge)
│                                tasks.effect.ts
│                                task.schema.ts
│                                kanban-board.tsx       (DndContext, DropSpacer,
│                              arrayMove)
│                                sortable-task-card
│                                task-card.tsx
│                                add-task-form.tsx
│                              payment/
│                                payment.api.ts
│                                payment.effect.ts
│                                unlock-button.tsx
│                                                              │
│  Pattern: UI → TanStack Query → features/*/*.effect.ts       │
│           → effectApi (fetch wrapper) → backend HTTP          │
│                                                              │
│  Kanban drag-and-drop: @dnd-kit/core with layered             │
│    pointerWithin → closestCorners collision detection        │
│    DropSpacer for visible "drop here" zones                  │
│    Frontend computes fractional positions from neighbors     │
│    using arrayMove + neighbor position midpoint              │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

Every endpoint follows the same pattern:

```
[HTTP Request]
     │
     ▼
Zod.safeParse(req.body)    ← Shape validation (400 if bad)
     │ result.data
     ▼
Effect.runPromise(         ← NEVER throws
  Effect.either(           ← Converts all errors to Either.left
    service.method(data)
  )
)
     │
     ▼
Either.isLeft(either)      ← Typed error routing
  ├─ _tag === "TaskLimitReached" → 403
  ├─ _tag === "TaskNotFound"      → 404
  ├─ _tag === "InvalidCredentials" → 401
  ├─ _tag === "EmailAlreadyRegistered" → 409
  └─ fallthrough                  → 500
     │
Either.isRight(either)
  → res.json(either.right)
```

The same Effect-TS pattern flows end-to-end from frontend to backend:
- **Frontend**: `ui → TanStack Query → runEffect(program) → feature.effect.ts → effectApi → fetch()`
- **Backend**: `route → Zod → Effect.either(service) → Prisma (direct, no repository)`

## Task Position Model (Fractional Indexing)

Tasks use fractional positions (Float) instead of sequential integers:

- **Schema**: `position Float @default(100)` in Prisma
- **New tasks**: position = `(lastTask?.position ?? 0) + 100`, creating gaps from the start
- **Same-column reorder**: Frontend computes new position as midpoint of neighbor positions (e.g., `(pos_before + pos_after) / 2`)
- **Cross-column move**: Frontend computes position relative to target column neighbors
- **Column drop (end of column)**: position = `lastPosition + 100`
- **Empty column**: position = `100`
- **Backend**: Single-row `prisma.task.update({ data: { status, position } })` — no shifting, no transactions on move
- **Delete**: Single-row `prisma.task.delete()` — no position shifting (fractional gaps are harmless)

## External Dependencies

| Env Var | Category | Purpose |
|---------|----------|---------|
| `DATABASE_URL` | Credential | Neon PostgreSQL connection string |
| `JWT_SECRET` | Credential | JWT signing secret (min 32 chars) |
| `STRIPE_SECRET_KEY` | Credential | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Credential | Stripe webhook signing secret |
| `PORT` | Operational | Server port |
| `FRONTEND_URL` | Operational | CORS allowed origin |
| `NODE_ENV` | Operational | `development` / `test` / `production` |
| `NEXT_PUBLIC_API_URL` | Operational | Backend API URL for frontend fetch calls |

## Known Gaps

1. **No structured logging or tracing** — uses bare `console.error`. No request ID propagation, no log levels, no PII redaction. Makes production debugging harder.
2. **No down migrations** — Prisma generates `up` only. No automated rollback path. Manual reversal SQL needed for disaster recovery.
3. **No rate limiting** — auth endpoints (`/register`, `/login`) have no rate limiting, leaving them vulnerable to brute-force attacks.
