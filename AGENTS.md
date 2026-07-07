# AGENTS.md — QuickTask Project Constitution

> Self-guidance document for AI agents working on this codebase.
> Read this FIRST before making any change.

## Project Overview

QuickTask is a simple task manager with payment unlock. Free users get 3 tasks; $5 one-time Stripe payment unlocks unlimited tasks.

**Architecture**: Vertical Slice Architecture. Every feature is a self-contained folder owning its routes, service logic, database calls, and switchable driver contracts. Strict composition root — only `main.ts` instantiates service classes and drivers.

```
backend/
  src/
    features/      ← Every feature is a self-contained vertical slice
      auth/        → auth.service.ts, auth.routes.ts
      tasks/       → tasks.service.ts, tasks.routes.ts  
      payment/     → payment.service.ts, payment.routes.ts, driver.stripe.ts
    middleware/    ← Cross-cutting (auth JWT middleware)
    types/         ← Express type augmentation
    config.ts      ← Zod-validated, crashes on startup if env missing
    main.ts        ← Composition root (THE ONLY place services/drivers are `new`'d)

frontend/
  src/
    app/           ← Next.js App Router pages (declarative UI, no Effect)
      login/       → LoginPage
      register/    → RegisterPage
      dashboard/   → DashboardPage (Kanban + AddTaskForm)
    features/      ← Each feature owns its API hooks, effects, schemas, and components
      auth/        → auth.api.ts, auth.effect.ts, auth.schema.ts, password-input.tsx
      tasks/       → tasks.api.ts, tasks.effect.ts, task.schema.ts, kanban-board, task-card, ...
      payment/     → payment.api.ts, payment.effect.ts, unlock-button.tsx
    lib/           ← Shared infrastructure
      effect-client.ts  → Effect-based HTTP adapter (Effect.tryPromise + fetch)
      auth-context.tsx  → React Context for auth state
      errors.ts         → Data.TaggedError: NetworkError, HttpError
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
│    │ runEffect(featureEffect)                                           │
│    ▼                                                                    │
│  features/*/*.effect.ts             ← pure Effect pipelines            │
│    │ effectApi.get/post/patch/delete                                    │
│    ▼                                                                    │
│  lib/effect-client.ts               ← Effect.tryPromise wrapping fetch  │
│    │                                                                    │
├────│────────────────────────────────────────────────────────────────────┤
│    │  HTTP (JSON)                                                       │
├────│────────────────────────────────────────────────────────────────────┤
│    ▼                          BACKEND (Express)                         │
│                                                                         │
│  features/*/*.routes.ts            ← Zod.safeParse at boundary         │
│    │ Effect.either(service.method())  + _tag match for status codes     │
│    ▼                                                                    │
│  features/*/*.service.ts           ← Effect.gen + Data.TaggedError     │
│    │ prisma.user/task/payment calls directly (no repository layer)     │
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
| **Feature Effect pipelines** | `Effect.tryPromise` wrapping `effectApi` | Returns `Effect<Data, HttpError \| NetworkError>` |
| **HTTP adapter** | `Effect.tryPromise` wrapping `fetch()` | `throw new HttpError({ status, message })` → caught by `catch:` |
| **Backend feature routes** | `Effect.runPromise(Effect.either(service))` | `_tag` match → HTTP status code |
| **Backend feature services** | `Effect.gen` + `Effect.tryPromise` | `yield* Effect.fail(new TaskLimitReached({}))` |
| **Backend Prisma (direct)** | `Effect.tryPromise` wrapping Prisma client | Errors caught → typed domain error |

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

### 3. `try/catch` is FORBIDDEN in `features/` (backend) and `features/` (frontend core)

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

- **ONLY `main.ts`** instantiates service classes and drivers (`new TaskService(prisma)`, `new AuthService(prisma)`, `new StripeGateway()`, etc.)
- Services that need switchable dependencies (PaymentGateway, Hasher, TokenService) receive them via constructor injection with default implementations
- Services that call Prisma directly (TaskService, AuthService) receive only the `PrismaClient`

## Feature Autonomy Rule

- All code for a feature lives in its `features/` folder: routes, service, drivers, types.
- If a feature folder is deleted, that feature is 100% removed — no ghost files, no broken imports in other features.
- Cross-cutting concerns (auth middleware, config, types augmentation) live outside features.

## Selective Switchability

- **Payment gateway** → `PaymentGateway` interface at top of `payment.service.ts`, with `driver.stripe.ts` implementing it. Room for `driver.bkash.ts` later.
- **Auth hasher & token** → `Hasher` and `TokenService` interfaces at top of `auth.service.ts`, with `BcryptHasher` and `JwtToken` as default implementations.
- **Tasks** → No abstraction. `TaskService` takes `PrismaClient` and calls it directly.

## Project Invariants (Enforced by ESLint)

| Ban | What | Where |
|-----|------|-------|
| Ban 1 | `JSON.parse()` without Zod | All code (except config.ts) |
| Ban 2 | `any` type / `as any` | All code |
| Ban 3 | `@ts-ignore` / `@ts-nocheck` | All code |
| Ban 4 | `console.log` (use `console.error`) | Backend (except main.ts) |
| Ban 7 | `process.exit()` | All code (except main.ts) |
| Ban 9 | `process.env` | All code (except config.ts) |
| Ban 10 | `Date.now()` / `new Date()` | `src/features/**/*.ts` (backend) |
| Ban 12 | `export *` barrel exports | All code |
| Ban 14 | `Math.random()` / `crypto.randomUUID()` | `src/features/**/*.ts` (backend) |
| — | `$queryRaw` / `$executeRaw` (Prisma raw SQL) | All code |
| — | `try/catch` | `src/features/**/*.ts` (backend) and frontend `features/` effect files |
| — | `instanceof` for Effect tagged errors | `src/features/**/*.ts` (backend) |

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
