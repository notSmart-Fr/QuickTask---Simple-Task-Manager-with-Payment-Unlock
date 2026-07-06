# QuickTask — Reconstructed Architecture

## Triage Verdict: Suspicious (6/7)

| Pillar | Check | Result |
|--------|-------|--------|
| P1 — Perimeter | Every route uses Zod `safeParse` at boundary | ✅ PASS |
| P2 — Core Purity | `task.service.ts` imports only Effect, entities, port interfaces | ✅ PASS |
| P3 — Polarity | `core/` owns contracts (ports); `adapters/` implements them; `main.ts` is sole composition root | ✅ PASS |
| P4 — Resilience | Transaction wrappers exist in all three Prisma repos; SIGTERM/SIGINT handler with `prisma.$disconnect()` | ✅ PASS |
| P5 — Security | Zero hardcoded secrets in source | ✅ PASS |
| P6 — State Evolution | Prisma migrations exist (2 up); **no down/rollback migrations** | ❌ FAIL |
| P7 — Observability | `/health` endpoint exists with DB connectivity probe (`SELECT 1`); **no structured logging, PII masking, or distributed tracing** | ✅ PASS |

## What It Is

A simple task manager with payment unlock. Free users get 3 tasks; $5 one-time Stripe payment unlocks unlimited tasks. Feature-driven hexagonal (ports & adapters) architecture with Effect-TS throughout the full stack.

## Stack

- **Backend**: Express 5, TypeScript strict, Effect-TS 3.x, Zod, Prisma 5 + PostgreSQL (Neon)
- **Frontend**: Next.js 16 (App Router), React 18, Tailwind CSS, TanStack Query, @dnd-kit
- **Auth**: JWT (7-day expiry), bcryptjs, stateless
- **Payments**: Stripe Checkout ($5 one-time), webhook idempotency
- **Testing**: Vitest, supertest
- **Package Manager**: pnpm 9.15.0

## Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│                      COMPOSITION ROOT                       │
│  main.ts                                                    │
│  ── new PrismaClient()                                      │
│  ── new PrismaUserRepository(prisma)                        │
│  ── new PrismaTaskRepository(prisma)                        │
│  ── new PrismaPaymentRepository(prisma)                     │
│  ── new BcryptHasher()                                      │
│  ── new JwtToken()                                          │
│  ── new StripeGateway()                                     │
│  ── new AuthService(userRepo, hasher, token)               │
│  ── new TaskService(taskRepo)                               │
│  ── new PaymentService(paymentRepo, userRepo, stripe)       │
│  ── createAuthRouter(authService)                           │
│  ── createTaskRouter(taskService)                           │
│  ── createPaymentRouter(paymentService)                     │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────┐   ┌──────────────────────────────────┐
│    API (Express)     │   │    ADAPTERS (Infrastructure)     │
│                      │   │                                  │
│  auth.routes.ts ─────┼──▶│  PrismaUserRepository            │
│    Zod.safeParse →   │   │  PrismaTaskRepository            │
│    Effect.either →   │   │  PrismaPaymentRepository         │
│    _tag match        │   │  BcryptHasher                     │
│                      │   │  JwtToken                         │
│  task.routes.ts ─────┼──▶│  StripeGateway                    │
│    authMiddleware →   │   │                                  │
│    Zod.safeParse →   │   │  ┌─ PrismaClient ──► PostgreSQL  │
│    Effect.either →   │   │  └─ Stripe SDK ────► Stripe API  │
│    _tag match        │   │                                  │
│                      │   │                                  │
│  payment.routes.ts ──┼──▶│  All import from core/ port      │
│    Zod.safeParse →   │   │  interfaces only                 │
│    Effect.either →   │   │                                  │
│    _tag match        │   │                                  │
│                      │   │                                  │
│  middleware/         │   │                                  │
│    auth.middleware   │   │                                  │
└──────────┬───────────┘   └──────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│              CORE (Pure Domain — no frameworks)              │
│                                                              │
│  auth/                    task/                  payment/    │
│    auth.service.ts          task.service.ts        payment.service.ts
│      register() → {user,token}  createTask() → Task    createCheckout() → url
│      login()    → {user,token}  listTasks()  → {tasks,…} handleWebhook() → void
│    user.entity.ts            deleteTask() → Task          │
│    auth.port.ts              updateTaskStatus() → Task    │
│      (interfaces only)       moveTask() → Task            │
│                              │                            │
│                              task.entity.ts               │
│                                Task { position, … }       │
│                                FREE_TASK_LIMIT = 3        │
│                              task.port.ts                 │
│                                TaskRepositoryPort         │
│                                 (interface only)           │
│                                                           │
│  All errors: Data.TaggedError                              │
│    EmailAlreadyRegistered, InvalidCredentials,             │
│    TaskLimitReached, TaskNotFound,                         │
│    WebhookVerificationFailed, PaymentRecordNotFound        │
│                                                           │
│  shared/schemas.ts — Zod schemas (cross-boundary)          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16)                     │
│                                                              │
│  app/                      features/              core/      │
│    login/page.tsx            auth/                  api/     │
│    register/page.tsx           auth.api.ts           auth.effect.ts
│    dashboard/page.tsx        tasks/                  task.effect.ts
│                                add-task-form.tsx     payment.effect.ts
│  providers.tsx                 kanban-board.tsx     errors.ts
│    QueryClientProvider         sortable-task-card  (TaggedError)
│    AuthProvider                task-card.tsx
│                                tasks.api.ts       lib/
│                              payment/               effect-client.ts
│                                payment.api.ts       auth-context.tsx
│                                unlock-button.tsx
│                                                              │
│  Pattern: UI → TanStack Query → core/api/*.effect.ts         │
│           → effectApi (fetch wrapper) → backend HTTP          │
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
- **Frontend**: `ui → TanStack Query → runEffect(program) → effectApi → fetch()`
- **Backend**: `route → Zod → Effect.either(service) → repository → Prisma`

## External Dependencies

| Env Var | Category | Purpose |
|---------|----------|---------|
| `DATABASE_URL` | Credential | Neon PostgreSQL connection string |
| `JWT_SECRET` | Credential | JWT signing secret (min 32 chars) |
| `STRIPE_SECRET_KEY` | Credential | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Credential | Stripe webhook signing secret |
| `PORT` | Operational | Server port (forced to 10000 by Render) |
| `FRONTEND_URL` | Operational | CORS allowed origin |
| `NODE_ENV` | Operational | `development` / `test` / `production` |
| `NEXT_PUBLIC_API_URL` | Operational | Backend API URL for frontend fetch calls |

## Known Gaps

1. **No structured logging or tracing** — uses bare `console.error`. No request ID propagation, no log levels, no PII redaction. Makes production debugging harder.
2. **No down migrations** — Prisma generates `up` only. No automated rollback path. Manual reversal SQL needed for disaster recovery.
3. **No rate limiting** — auth endpoints (`/register`, `/login`) have no rate limiting, leaving them vulnerable to brute-force attacks.
