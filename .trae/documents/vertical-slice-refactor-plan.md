# Vertical Slice Architecture Refactor — QuickTask

## Summary

Collapse the current hexagonal (core/adapters/api/shared) layout into 3 self-contained feature
folders under `features/`.  Each feature owns its routes, service logic, database calls, and
switchable driver contracts.  Keep the same Effect-TS patterns, the same Zod-at-boundary rule,
and the same composition root — just with fewer files and no cross-cutting indirection.

---

## Current State Analysis

### Backend — 23 source files across 7 directories

```
src/
  main.ts                   ← composition root
  config.ts                 ← env config
  types/express.d.ts        ← type augmentation
  shared/schemas.ts         ← Zod schemas shared by all routes
  api/
    auth.routes.ts
    task.routes.ts
    payment.routes.ts
    middleware/auth.middleware.ts   ← JWT verify (used by all routes)
  core/
    auth/auth.service.ts    ← depends on UserRepositoryPort, PasswordHasherPort, TokenPort
    auth/auth.port.ts       ← 3 interfaces (UserRepository, PasswordHasher, Token)
    auth/user.entity.ts     ← User interface
    task/task.service.ts    ← depends on TaskRepositoryPort
    task/task.port.ts       ← TaskRepositoryPort (11 methods)
    task/task.entity.ts     ← Task, TaskStatus, FREE_TASK_LIMIT
    payment/payment.service.ts  ← depends on PaymentRepositoryPort, PaymentGatewayPort, UserRepositoryPort
    payment/payment.port.ts     ← 2 interfaces + Stripe types
    payment/payment.entity.ts   ← Payment interface
  adapters/
    prisma/prisma-user.repository.ts
    prisma/prisma-task.repository.ts
    prisma/prisma-payment.repository.ts
    bcrypt/bcrypt-hasher.adapter.ts
    jwt/jwt-token.adapter.ts
    stripe/stripe-gateway.adapter.ts
```

### Frontend — 25 source files (almost already vertical)

```
src/
  app/            ← Next.js pages (declarative, already correct)
  features/       ← already vertical: auth/, tasks/, payment/
  core/           ← Effect-TS pipelines (one per feature) + errors.ts
  lib/            ← effect-client.ts, auth-context.tsx (cross-cutting)
  schemas/        ← Zod schemas (one per feature, but in a shared directory)
```

### What changes and why

| Problem | Fix |
|---------|-----|
| To understand "create a task" you trace 5 files across 4 directories | All task logic in `features/tasks/` — routes + service + Prisma calls |
| `TaskRepositoryPort` (11 methods) exists solely to wrap Prisma | Delete the interface; service calls `prisma.task.findMany()` directly |
| `core/auth/auth.port.ts` has 3 interfaces spread across hasher/token/repo | All 3 interfaces + implementations in `features/auth/auth.service.ts` |
| Payment gateway abstraction is legit (Stripe ↔ bKash) but lives in global `adapters/` | Move to `features/payment/driver.stripe.ts` with interface defined locally in `features/payment/payment.service.ts` |
| `shared/schemas.ts` couples all features to one Zod file | Each route file defines its own input schemas (locality) |
| Frontend effect pipelines live in `core/api/` separate from their feature hooks | Move each effect file into its feature folder: `features/auth/auth.effect.ts` |
| Frontend Zod schemas live in `schemas/` separate from their feature | Move each schema into its feature folder: `features/tasks/task.schema.ts` |

### Selective switchability — what stays abstracted

- **Payment gateway** → `PaymentGateway` interface at top of `payment.service.ts`, with `driver.stripe.ts` implementing it.  Room for `driver.bkash.ts` later.
- **Auth hasher & token** → Interfaces (`Hasher`, `TokenService`) defined at top of `auth.service.ts`, with `BcryptHasher` and `JwtToken` as inline classes.  Default instances injected so tests can still mock.
- **Tasks** → No abstraction.  `TaskService` takes `PrismaClient` in its constructor and calls it directly.  No `TaskRepositoryPort`.

---

## Proposed Changes

### Step 1 — Update AGENTS.md

Update the project structure diagram and remove references to `core/`, `adapters/`, `shared/`,
and `api/` directories.  Add the vertical slice layout with feature autonomy rule.

**File**: [AGENTS.md](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/AGENTS.md)

Changes:
- Replace the "Feature-driven hexagonal" description with "Vertical Slice Architecture"
- Replace the backend directory tree with the new `features/` layout
- Replace the frontend directory tree (effect files + schemas move into features)
- Update "Composition Root (FM2)" section — adapters no longer in `adapters/`, drivers in feature folders
- Update "Project Invariants" table — remove Ban 16 (FM2 adapter ban), update try/catch ban path from `core/` to `features/`

---

### Step 2 — Backend: Create feature files

#### 2a. `src/features/auth/auth.service.ts` (NEW)

Merges content from:
- `src/core/auth/user.entity.ts` → `User` interface
- `src/core/auth/auth.port.ts` → `Hasher` + `TokenService` interfaces (NOT UserRepository — that's eliminated)
- `src/core/auth/auth.service.ts` → `AuthService` class + `EmailAlreadyRegistered` + `InvalidCredentials`
- `src/adapters/bcrypt/bcrypt-hasher.adapter.ts` → `BcryptHasher` class
- `src/adapters/jwt/jwt-token.adapter.ts` → `JwtToken` class
- `src/adapters/prisma/prisma-user.repository.ts` → Prisma calls inlined into AuthService methods

Key design decision: `AuthService` takes `PrismaClient` and optional `Hasher` + `TokenService` (with defaults):

```typescript
// Interface contracts at top of file (local, switchable)
export interface Hasher { hash(password: string): Promise<string>; compare(password: string, hash: string): Promise<boolean>; }
export interface TokenService { sign(userId: string, name: string, email: string, isPremium: boolean): string; verify(token: string): { userId: string; ... }; }

export class BcryptHasher implements Hasher { ... }
export class JwtToken implements TokenService { ... }

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly hasher: Hasher = new BcryptHasher(),
    private readonly tokens: TokenService = new JwtToken(),
  ) {}
  // register(), login(), getUserWithFreshToken() — all call prisma.user directly
}
```

#### 2b. `src/features/auth/auth.routes.ts` (NEW)

Moved from `src/api/auth.routes.ts`.  Same logic, updated import path:
- `import { AuthService } from "./auth.service.js"` instead of `"../../core/auth/auth.service.js"`
- Zod schemas (`RegisterInputSchema`, `LoginInputSchema`) defined locally at top of file
- `authMiddleware` import updated to `"../middleware/auth.middleware.js"` or similar

#### 2c. `src/features/tasks/tasks.service.ts` (NEW)

Merges content from:
- `src/core/task/task.entity.ts` → `Task`, `TaskStatus`, `UserForTaskService`, `FREE_TASK_LIMIT`
- `src/core/task/task.service.ts` → `TaskService` + `TaskLimitReached` + `TaskNotFound`
- `src/adapters/prisma/prisma-task.repository.ts` → ALL Prisma query logic inlined into TaskService methods

Key design decision: `TaskService` takes `PrismaClient` directly — no `TaskRepositoryPort`:

```typescript
export class TaskService {
  constructor(private readonly prisma: PrismaClient) {}

  // createTask() calls prisma.task.count() + prisma.task.create() directly
  // listTasks() calls prisma.task.findMany() directly
  // deleteTask() calls prisma.task.delete() + prisma.task.updateMany() directly
  // moveTask() uses prisma.$transaction() with inline shiftPosition logic
}
```

The transaction callback pattern changes from `this.taskRepository.transaction(async (tx) => ...)` to `this.prisma.$transaction(async (tx) => ...)` where `tx` is a `Prisma.TransactionClient` passed to a temp service or used directly.

#### 2d. `src/features/tasks/tasks.routes.ts` (NEW)

Moved from `src/api/task.routes.ts`.  Same logic, updated imports:
- `import { TaskService, TaskLimitReached, TaskNotFound } from "./tasks.service.js"`
- Zod schemas (`CreateTaskInputSchema`, `UpdateTaskStatusInputSchema`) defined locally
- `authMiddleware` import updated

#### 2e. `src/features/payment/payment.service.ts` (NEW)

Merges content from:
- `src/core/payment/payment.entity.ts` → `Payment`, `PaymentStatus`
- `src/core/payment/payment.port.ts` → `PaymentGateway` interface + `StripeWebhookEvent`, `StripeCheckoutSession` types
- `src/core/payment/payment.service.ts` → `PaymentService` + `WebhookVerificationFailed` + `PaymentRecordNotFound`
- `src/adapters/prisma/prisma-payment.repository.ts` → Prisma calls inlined

Key design:

```typescript
// PaymentGateway interface at top of file (switchable — Stripe ↔ bKash)
export interface PaymentGateway {
  createCheckoutSession(userId: string, email: string, successUrl: string, cancelUrl: string): Promise<CheckoutSession>;
  verifyWebhookSignature(body: Buffer, signature: string): WebhookEvent;
  getEventId(event: WebhookEvent): string;
  getSessionId(event: WebhookEvent): string | null;
}

export class PaymentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly gateway: PaymentGateway,
  ) {}
  // createCheckout() — calls gateway + prisma.payment.create directly
  // handleWebhook() — calls gateway.verify + prisma.payment transaction directly
}
```

Note: `PaymentService` no longer depends on `UserRepositoryPort` for `updateToPremium` — it calls `prisma.user.update()` directly.

#### 2f. `src/features/payment/payment.routes.ts` (NEW)

Moved from `src/api/payment.routes.ts`.  Updated imports to local `./payment.service.js`.

#### 2g. `src/features/payment/driver.stripe.ts` (NEW)

Moved from `src/adapters/stripe/stripe-gateway.adapter.ts`.  Implements the `PaymentGateway` interface from `./payment.service.js`.

#### 2h. `src/middleware/auth.middleware.ts` (NEW)

Moved from `src/api/middleware/auth.middleware.ts`.  Same content, updated config import path: `"../../config.js"` → `"../config.js"`.

---

### Step 3 — Backend: Update main.ts (composition root)

Replace all old imports with new feature imports:

```typescript
// OLD
import { AuthService } from "./core/auth/auth.service.js";
import { TaskService } from "./core/task/task.service.js";
import { PaymentService } from "./core/payment/payment.service.js";
import { PrismaUserRepository } from "./adapters/prisma/prisma-user.repository.js";
import { PrismaTaskRepository } from "./adapters/prisma/prisma-task.repository.js";
import { PrismaPaymentRepository } from "./adapters/prisma/prisma-payment.repository.js";
import { BcryptHasher } from "./adapters/bcrypt/bcrypt-hasher.adapter.js";
import { JwtToken } from "./adapters/jwt/jwt-token.adapter.js";
import { StripeGateway } from "./adapters/stripe/stripe-gateway.adapter.js";
import { createAuthRouter } from "./api/auth.routes.js";
import { createTaskRouter } from "./api/task.routes.js";
import { createPaymentRouter } from "./api/payment.routes.js";

// NEW
import { AuthService } from "./features/auth/auth.service.js";
import { TaskService } from "./features/tasks/tasks.service.js";
import { PaymentService } from "./features/payment/payment.service.js";
import { StripeGateway } from "./features/payment/driver.stripe.js";
import { createAuthRouter } from "./features/auth/auth.routes.js";
import { createTaskRouter } from "./features/tasks/tasks.routes.js";
import { createPaymentRouter } from "./features/payment/payment.routes.js";
```

Service instantiation becomes simpler:

```typescript
// OLD
const hasher = new BcryptHasher();
const tokenService = new JwtToken();
const userRepo = new PrismaUserRepository(prisma);
const authService = new AuthService(userRepo, hasher, tokenService);
const taskRepo = new PrismaTaskRepository(prisma);
const taskService = new TaskService(taskRepo);
const stripeGateway = new StripeGateway();
const paymentRepo = new PrismaPaymentRepository(prisma);
const paymentService = new PaymentService(paymentRepo, userRepo, stripeGateway);

// NEW
const authService = new AuthService(prisma);
const taskService = new TaskService(prisma);
const stripeGateway = new StripeGateway();
const paymentService = new PaymentService(prisma, stripeGateway);
```

---

### Step 4 — Backend: Delete old files

Remove entire directories:
- `src/core/` (9 files)
- `src/adapters/` (6 files)
- `src/api/` (4 files)
- `src/shared/schemas.ts` (Zod schemas now local)

Files that MOVE (not delete):
- `src/types/express.d.ts` stays at `src/types/express.d.ts`
- `src/config.ts` stays
- `src/main.ts` stays (updated imports)

---

### Step 5 — Backend: Update ESLint config

Key ESLint rule changes needed:

1. **FM2 Composition Root**: Remove the adapter `new` ban rule since adapter classes are now in `features/` and instantiated in `main.ts` only:
   - Remove lines 228-240 (the `PrismaUserRepository|PrismaTaskRepository|...|StripeGateway` ban)
   - The class names changed; a generic "only main.ts calls `new` on service classes" would be overkill — just remove

2. **try/catch ban paths**: Update from `["src/core/**/*.ts", "src/api/**/*.ts"]` to `["src/features/**/*.ts"]`

3. **Ban 10 + 14 (Date/Math/crypto)**: Update from `["src/core/**/*.ts"]` to `["src/features/**/*.ts"]`

4. **Prisma adapter relaxations**: Remove the `src/adapters/prisma/**/*.ts` overrides (no longer needed since Prisma is called in features)

5. **process.env ban**: Update from referencing `src/core/` and `src/api/` to `src/features/`

---

### Step 6 — Frontend: Move effect files into features

Move each effect pipeline from `src/core/api/` into its feature folder:

| From | To |
|------|----|
| `src/core/api/auth.effect.ts` | `src/features/auth/auth.effect.ts` |
| `src/core/api/task.effect.ts` | `src/features/tasks/tasks.effect.ts` |
| `src/core/api/payment.effect.ts` | `src/features/payment/payment.effect.ts` |

Update imports in the corresponding `*.api.ts` files:
- `features/auth/auth.api.ts` → import from `"./auth.effect"` instead of `"../../core/api/auth.effect"`
- `features/tasks/tasks.api.ts` → import from `"./tasks.effect"` instead of `"../../core/api/task.effect"`
- `features/payment/payment.api.ts` → import from `"./payment.effect"` instead of `"../../core/api/payment.effect"`

---

### Step 7 — Frontend: Move schema files into features

| From | To |
|------|----|
| `src/schemas/task.schema.ts` | `src/features/tasks/task.schema.ts` |
| `src/schemas/auth.schema.ts` | `src/features/auth/auth.schema.ts` |

Delete: `src/schemas/index.ts`, `src/core/api/` directory (now empty)

Update imports in ALL files that import from `../../schemas/task.schema`:
- `features/tasks/tasks.api.ts`
- `features/tasks/kanban-board.tsx`
- `features/tasks/task-card.tsx`
- `features/tasks/add-task-form.tsx`
- `features/tasks/sortable-task-card.tsx`
- For frontend JSX components: `"../../schemas/task.schema"` → `"./task.schema"`
- For `features/auth/auth.api.ts`: `"../../schemas/auth.schema"` → `"./auth.schema"`

---

### Step 8 — Update test files

**Backend tests** (Vitest):

| File | Changes |
|------|---------|
| `tests/core/auth.service.test.ts` | Import from `features/auth/auth.service.js`, mock `PrismaClient` instead of `UserRepositoryPort` |
| `tests/core/task.service.test.ts` | Import from `features/tasks/tasks.service.js`, mock `PrismaClient` instead of `TaskRepositoryPort` |
| `tests/api/auth.routes.test.ts` | Import from `features/auth/auth.routes.js` |
| `tests/api/task.routes.test.ts` | Import from `features/tasks/tasks.routes.js` |

Test directories should mirror `src/`:
- `tests/features/auth.service.test.ts`
- `tests/features/task.service.test.ts`
- `tests/features/auth.routes.test.ts`
- `tests/features/task.routes.test.ts`

Test mocks change from mocking the interface to mocking `PrismaClient`.  The `makeRepo()` helper in task tests becomes `makePrismaMock()` that mocks `prisma.task.findMany()`, etc.

---

### Step 9 — Verification

After all changes, run:

```bash
# Backend
pnpm typecheck      # tsc --noEmit
pnpm lint           # ESLint
pnpm test           # Vitest
pnpm dev            # Smoke test — server starts, endpoints work

# Frontend
cd frontend
pnpm typecheck      # tsc --noEmit
pnpm lint           # ESLint
pnpm dev            # Smoke test — app loads, drag-and-drop works
```

---

## Assumptions & Decisions

1. **Hasher/Token are kept as injectable interfaces** despite being unlikely to switch.  Reason: the user's prompt explicitly lists "Hashers" and "Token Managers" as switchable.  Keep the option open without adding driver files — just default instances in the constructor.

2. **`auth.middleware.ts` stays in a shared `middleware/` directory** rather than being duplicated per feature.  Reason: it's a cross-cutting concern, not a feature.  The user's target didn't show it but it's needed.

3. **`express.d.ts` (type augmentation) stays at `src/types/`**.  Reason: it's framework-level glue, not business logic.

4. **`config.ts` stays at root of `src/`**.  Reason: cross-cutting, validated once at startup.

5. **`effect-client.ts` stays at `src/lib/` in frontend**.  Reason: cross-cutting HTTP adapter, not feature-specific.

6. **`auth-context.tsx` stays at `src/lib/` in frontend**.  Reason: shared auth state provider.

7. **No `driver.bkash.ts` is created** — only `driver.stripe.ts`.  The architecture supports it; we'll add the file when needed.

8. **ESLint `try/catch` ban applies to `src/features/**/*.ts`** — same as the old `core/` + `api/` ban, just on a single unified path now.

9. **Test mocks switch from interface-based mocks to PrismaClient mocks**.  This is the biggest behavioral change.  `PrismaClient`'s delegate methods (`.user.findMany()`, `.task.create()`, etc.) are the new mock targets.  The `$transaction` method is also mocked.

---

## Rollback Strategy

Every step preserves the old files until the new ones are verified.  The order:
1. Create all new `features/` files (old files still exist)
2. Update `main.ts` imports to point at new files
3. Run typecheck + lint — fix import errors
4. Run tests — fix mock mismatches
5. Delete old directories (they're unreferenced by this point)
6. Update AGENTS.md + ESLint config to reflect new structure
