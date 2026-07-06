# AGENTS.md — QuickTask Project Constitution

> Self-guidance document for AI agents working on this codebase.
> Read this FIRST before making any change.

## Project Overview

QuickTask is a simple task manager with payment unlock. Free users get 3 tasks; $5 one-time Stripe payment unlocks unlimited tasks.

**Architecture**: Feature-driven hexagonal (ports & adapters). Strict composition root — only `main.ts` instantiates adapters.

```
backend/
  src/
    core/          ← Domain logic (pure, no frameworks, Effect-TS)
      auth/        → AuthService, User entity, ports
      task/        → TaskService, Task entity, ports  
      payment/     → PaymentService, Payment entity, ports
    adapters/      ← Infrastructure implementations
      prisma/      → PrismaUserRepository, PrismaTaskRepository, PrismaPaymentRepository
      bcrypt/      → BcryptHasher
      jwt/         → JwtToken
      stripe/      → StripeGateway
    api/           ← Express routes (Zod boundary → Effect domain)
    shared/        → Shared Zod schemas (cross-boundary)
    config.ts      ← Zod-validated, crashes on startup if env missing
    main.ts        ← Composition root (THE ONLY place adapters are `new`'d)

frontend/
  src/
    app/           ← Next.js App Router pages (declarative UI, no Effect)
      login/       → LoginPage
      register/    → RegisterPage
      dashboard/   → DashboardPage (Kanban + AddTaskForm)
    features/      ← TanStack Query hooks + UI components
      auth/        → auth.api.ts (useQuery/useMutation ↔ Effect bridge)
      tasks/       → tasks.api.ts, kanban-board, task-card, add-task-form
      payment/     → payment.api.ts, unlock-button
    core/          ← Domain logic (pure Effect-TS, no React/Next.js)
      errors.ts    → Data.TaggedError: NetworkError, HttpError
      api/         → Effect pipelines for each feature
        auth.effect.ts      → registerEffect, loginEffect, fetchMeEffect
        task.effect.ts      → fetchTasksEffect, createTaskEffect, ...
        payment.effect.ts   → createCheckoutEffect
    lib/           ← Shared infrastructure
      effect-client.ts  → Effect-based HTTP adapter (Effect.tryPromise + fetch)
      auth-context.tsx  → React Context for auth state
    schemas/       → Client-side Zod validation schemas
```

## Tech Stack

- **Backend**: Express 5, TypeScript strict, Effect-TS 3.x, Zod, Prisma + PostgreSQL (Neon)
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, TanStack Query, Zod
- **Auth**: JWT (7-day expiry), bcryptjs, stateless
- **Payments**: Stripe Checkout ($5 one-time)
- **Testing**: Vitest, supertest
- **Linting**: ESLint 9 flat config with TypeScript strict

## The Golden Rule: Zod at Boundary, Effect in Core

This is the single most important pattern in the codebase. **Never mix them.**

```
[HTTP Request]
     │
     ▼
┌──────────────────────────────┐
│  Zod.safeParse(req.body)     │  ← Shape validation (400 if bad)
│  if (!success) return 400    │
└──────────────┬───────────────┘
               │ result.data (clean, typed)
               ▼
┌──────────────────────────────┐
│  Effect.either(              │  ← Domain pipeline (typed errors)
│    service.method(data)      │
│  )                           │
└──────────────┬───────────────┘
               │ Either<E, A>
               ▼
┌──────────────────────────────┐
│  Effect.runPromise(either)   │  ← NEVER throws
│  if (Either.isLeft(either))  │
│    match either.left._tag    │  ← Typed error routing:
│      "TaskLimitReached"→403  │
│      "TaskNotFound"→404      │
│      "InvalidCredentials"→401│
│      "EmailAlreadyRegistered"→409
│      _ → 500                 │
│  else res.json(either.right) │
└──────────────────────────────┘
```

## End-to-End Effect-TS: Frontend ↔ Backend

Effect-TS flows through the entire stack with the same `Data.TaggedError` types, `Effect.either` bridging, and `_tag`-based error matching on both sides.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Next.js)                             │
│                                                                         │
│  UI (React pages)                    ← declarative, no Effect           │
│    │ useQuery / useMutation                                             │
│    ▼                                                                    │
│  TanStack Query hooks               ← bridge: Effect.either → throw    │
│    │ runEffect(corePipeline)                                            │
│    ▼                                                                    │
│  core/api/*.effect.ts               ← pure Effect pipelines            │
│    │ effectApi.get/post/patch/delete                                    │
│    ▼                                                                    │
│  lib/effect-client.ts               ← Effect.tryPromise wrapping fetch  │
│    │                                                                    │
├────│────────────────────────────────────────────────────────────────────┤
│    │  HTTP (JSON)                                                       │
├────│────────────────────────────────────────────────────────────────────┤
│    ▼                          BACKEND (Express)                         │
│                                                                         │
│  api/*.routes.ts                    ← Zod.safeParse at boundary        │
│    │ Effect.either(service.method())  + _tag match for status codes     │
│    ▼                                                                    │
│  core/*.service.ts                  ← Effect.gen + Data.TaggedError    │
│    │ repo.create / repo.findByEmail          typed error channels      │
│    ▼                                                                    │
│  adapters/prisma/*.repository.ts    ← Prisma queries in Effect.tryPromise│
│    │                                                                    │
│    ▼                                                                    │
│  PostgreSQL (Neon)                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Frontend Bridge: `runEffect` helper

Every TanStack Query hook uses this exact pattern to bridge Effect to Promise:

```typescript
// features/auth/auth.api.ts
import { Effect, Either } from "effect";

function runEffect<T>(program: Effect.Effect<T, AuthError>): Promise<T> {
  return Effect.runPromise(
    Effect.either(program),     // Effect<A, E> → Effect<Either<A, E>, never>
  ).then((either) => {
    if (Either.isLeft(either)) {
      throw either.left;         // TaggedError with _tag intact (no FiberFailure)
    }
    return either.right;
  });
}

// Query: data flows through onSuccess, errors through onError
export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => runEffect(fetchTasksEffect()),
  });
}

// Mutation: typed error available via mutation.error._tag
export function useCreateTask() {
  return useMutation({
    mutationFn: (data) => runEffect(createTaskEffect(data.title, data.description)),
  });
}
```

### Error shape is identical on both sides

Both frontend and backend produce the same error structure:

```typescript
// Backend response body
{ "error": "Free users can only have 3 tasks. Upgrade to premium!" }

// Frontend TanStack Query error (via .error property)
{ _tag: "HttpError", status: 403, message: "Free users can only have 3 tasks..." }

// Frontend UI pattern-matches on error
if (error._tag === "HttpError" && error.status === 403) {
  showLimitBanner(error.message);
}
```

### Key invariants across the full stack

| Layer | Effect Pattern | Error Flow |
|-------|---------------|------------|
| **UI** | No Effect — declarative JSX | Checks `query.error?._tag` / `mutation.isError` |
| **TanStack Query hooks** | `Effect.runPromise(Effect.either(program))` | `Either.isLeft` → throw `either.left` (preserves `_tag`) |
| **Core Effect pipelines** | `Effect.tryPromise` wrapping `effectApi` | Returns `Effect<Data, HttpError \| NetworkError>` |
| **HTTP adapter** | `Effect.tryPromise` wrapping `fetch()` | `throw new HttpError({ status, message })` → caught by `catch:` |
| **Backend API routes** | `Effect.runPromise(Effect.either(service))` | `_tag` match → HTTP status code |
| **Backend services** | `Effect.gen` + `Effect.tryPromise` | `yield* Effect.fail(new TaskLimitReached({}))` |
| **Backend adapters** | `Effect.tryPromise` wrapping Prisma | Errors caught → typed domain error |

## Effect-TS Rules (CRITICAL)

### 1. Domain errors use `Data.TaggedError`

```typescript
import { Data } from "effect";

export class TaskLimitReached extends Data.TaggedError("TaskLimitReached")<{
  limit: number;
}> {}
```

Never subclass `Error` for domain errors. Always use `Data.TaggedError`.

### 2. Error matching uses `_tag`, NEVER `instanceof`

```typescript
// CORRECT
if (either.left._tag === "TaskNotFound") { ... }

// WRONG — breaks across module boundaries
if (error instanceof TaskNotFound) { ... }
```

### 3. `try/catch` is FORBIDDEN in `core/` and `api/`

All error handling goes through the Effect error channel. Use:

```typescript
// CORRECT: Effect.gen + Effect.tryPromise
Effect.gen(this, function* () {
  const result = yield* Effect.tryPromise({
    try: () => someAsyncCall(),
    catch: (e) => e instanceof Error ? e : new Error(String(e)),
  });
})

// CORRECT: Effect.either in routes
const either = await Effect.runPromise(
  Effect.either(service.method(data))
);

// WRONG — never do this
try {
  const result = await service.method(data);
} catch (e) {
  // ...
}
```

### 4. `Effect.runPromise` must always be wrapped in `Effect.either`

Never call `Effect.runPromise` directly on a failing effect — the error will be wrapped in `FiberFailure`. Always use:

```typescript
const either = await Effect.runPromise(Effect.either(effect));
```

### 5. Domain services return `Effect<A, E, never>`, never `Promise`

```typescript
// CORRECT
createTask(user, data): Effect.Effect<Task, TaskLimitReached | Error>

// WRONG
async createTask(user, data): Promise<Task>
```

## Composition Root (FM2)

- **ONLY `main.ts`** instantiates adapters (`new PrismaUserRepository()`, `new BcryptHasher()`, etc.)
- This is enforced by ESLint Ban 16: `new AdapterClass()` outside `main.ts` is a build error
- Services receive their dependencies via constructor injection

## Project Invariants (Enforced by ESLint)

| Ban | What | Where |
|-----|------|-------|
| Ban 1 | `JSON.parse()` without Zod | All code (except config.ts) |
| Ban 2 | `any` type / `as any` | All code |
| Ban 3 | `@ts-ignore` / `@ts-nocheck` | All code |
| Ban 4 | `console.log` (use `console.error`) | Backend (except main.ts) |
| Ban 7 | `process.exit()` | All code (except main.ts) |
| Ban 9 | `process.env` | All code (except config.ts) |
| Ban 10 | `Date.now()` / `new Date()` | `core/` |
| Ban 12 | `export *` barrel exports | All code |
| Ban 14 | `Math.random()` / `crypto.randomUUID()` | `core/` |
| Ban 16 | `new AdapterClass()` outside main.ts | All code |
| — | `$queryRaw` / `$executeRaw` (Prisma raw SQL) | All code |
| — | `try/catch` | `core/` and `api/` (both backend & frontend) |
| — | `instanceof` for Effect tagged errors | `core/` and `api/` |

## Testing Patterns

### Core service tests: use `Effect.either` + `Either.isLeft/isRight`

```typescript
const either = await Effect.runPromise(
  Effect.either(service.createTask(user, data))
);

expect(Either.isLeft(either)).toBe(true);
if (Either.isLeft(either)) {
  expect(either.left._tag).toBe("TaskLimitReached");
  expect(either.left.limit).toBe(3);
}
```

### API route tests: mock service returns `Effect.succeed/fail`

```typescript
const app = makeApp({
  createTask: vi.fn().mockReturnValue(
    Effect.fail(new TaskLimitReached({ limit: 3 }))
  ),
});

const res = await request(app).post("/api/v1/tasks")...;
expect(res.status).toBe(403);
```

## Commands

```bash
# Backend
pnpm dev           # Start backend (port 4000)
pnpm lint          # Run ESLint
pnpm test          # Run Vitest
npx prisma generate # Generate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create DB migration

# Frontend
cd frontend
pnpm dev           # Start Next.js dev server (port 3000)
pnpm lint          # Run ESLint
pnpm typecheck     # Run tsc --noEmit
```

## Ponytail Rules (Efficiency)

- Pick the simplest solution that works
- Reuse existing patterns before creating new ones
- Deletion over addition
- No abstractions without explicit request
- No new dependencies without explicit request
- Mark intentional shortcuts with `ponytail:` comment
