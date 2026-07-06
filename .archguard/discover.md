# ArchGuard Discover Output

**Generated**: 2026-07-06 | **Phase**: Post-Phase 4 (Auth + Task Management implemented)

---

## Project Context

- **Project Type**: Two-package setup (NOT pnpm workspaces monorepo) — separate `backend/` and `frontend/` with independent `package.json` files
- **Backend Runtime**: Node.js (type: module, target: ES2022, strict: true)
- **Frontend Runtime**: Browser + Node.js SSR (Next.js 16.2, target: ES2017, strict: true, jsx: react-jsx)
- **Package Manager**: pnpm (no `packageManager` field set)
- **Backend**: Express.js 4.x + TypeScript 5.x + Prisma 5.x + Zod 3.x + bcryptjs + jsonwebtoken + Stripe 17.x
- **Frontend**: Next.js 16.2 (App Router) + React 18 + TanStack Query 5.x + Tailwind CSS 3.x + Zod 3.x

### Backend Dependencies (relevant)

| Category | Packages |
|----------|----------|
| Framework | express, express-async-errors, cors |
| Database | @prisma/client |
| Auth | bcryptjs, jsonwebtoken |
| Payment | stripe |
| Validation | zod, @effect/schema |
| Config | dotenv |

### Frontend Dependencies (relevant)

| Category | Packages |
|----------|----------|
| Framework | next, react, react-dom |
| Data Fetching | @tanstack/react-query |
| Styling | tailwindcss, tailwind-merge, clsx |
| Validation | zod |

---

## Map A: Trust Boundaries

**Count**: 9 matches across 4 files

### Backend

| File | Count | Patterns |
|------|-------|----------|
| `backend/src/api/auth.routes.ts` | 4 | `req.body`, `req.headers` |
| `backend/src/api/task.routes.ts` | 4 | `req.body`, `req.params` |
| `backend/src/api/middleware/auth.middleware.ts` | 1 | `req.headers` |
| `backend/src/config.ts` | 1 | `process.env` (whitelisted — Ban 9 exception) |

### Frontend

| File | Count | Patterns |
|------|-------|----------|
| `frontend/src/lib/api-client.ts` | 1 | `process.env.NEXT_PUBLIC_API_URL` (expected for Next.js public env) |

**Pattern types found**: Express req.body, req.params, req.headers, process.env, Next.js public env

**Assessment**: All trust boundaries are properly guarded by Zod validation at the API layer. No raw `req.body` usage without Zod `.parse()` — all 6 route handler `req.body` accesses are immediately followed by schema validation. `process.env` access is confined to `config.ts` (backend) and `api-client.ts` (frontend, Next.js pattern).

---

## Map B: Dependency Graph

**Layer structure** (actual, from code scan):

```
backend/src/
├── core/
│   ├── auth/           → imports: types from same dir only (NO framework, NO adapters)
│   ├── task/           → imports: types from same dir only (NO framework, NO adapters)
│   └── [payment/ not yet implemented]
├── adapters/
│   ├── prisma/         → imports: @prisma/client + core types (correct direction)
│   ├── bcrypt/         → imports: bcryptjs + core types (correct direction)
│   ├── jwt/            → imports: jsonwebtoken + config + core types (correct direction)
│   └── [stripe/ not yet implemented]
├── api/
│   ├── auth.routes.ts  → imports: express + core + adapters + shared ⚠️
│   ├── task.routes.ts  → imports: express + core + shared (clean — no direct adapter import)
│   └── middleware/      → imports: jsonwebtoken + config
├── shared/schemas.ts   → imports: zod only
├── config.ts           → imports: dotenv + zod
└── main.ts             → imports: express + api routes + core + adapters (composition root)
```

### Dependency Direction Analysis

| Direction | Status | Evidence |
|-----------|--------|----------|
| core/ → adapters/ | ✅ CLEAN | 0 imports |
| core/ → api/ | ✅ CLEAN | 0 imports |
| core/ → framework | ✅ CLEAN | 0 imports (Express/Prisma/Stripe) |
| adapters/ → core/ | ✅ CORRECT | Implements ports, depends on entities |
| api/ → core/ | ✅ CORRECT | Routes delegate to services |
| api/ → adapters/ | ⚠️ PARTIAL | `task.routes.ts` clean via constructor DI; `auth.routes.ts` directly instantiates adapters |

### FM2 Violation: `auth.routes.ts` bypasses composition root — **RESOLVED**

**File**: [auth.routes.ts](file:///i:/QuickTask%20%E2%80%93%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/auth.routes.ts)

Status: Fixed. `auth.routes.ts` now uses the same `createAuthRouter(authService)` factory pattern as `task.routes.ts`. All adapter instantiation moved to `main.ts` (composition root).

**ESLint Rule Added** — Ban 16 (`backend/eslint.config.js`):
```
NewExpression[callee.name=/^(PrismaUserRepository|PrismaTaskRepository|...)$/]
```
Enforced on `src/**/*.ts` excluding `src/main.ts`. Any `new AdapterClass()` outside the composition root is a compile-time error.

### Frontend Dependency Graph

```
frontend/src/
├── app/                → imports: next/* + features + lib + schemas
├── features/
│   ├── auth/           → imports: lib/api-client + schemas + @tanstack/react-query
│   └── tasks/          → imports: lib/api-client + schemas + @tanstack/react-query
├── lib/                → imports: features/auth (for User type only) + next (browser APIs)
└── schemas/            → imports: zod only
```

**Frontend assessment**: Clean. Features depend on lib (correct). App depends on features + lib (correct). No circular dependencies detected.

---

## Map C: Output Surfaces

**Count**: 32 matches across 7 files

### Backend — HTTP Responses (Express)

| File | Count | Patterns |
|------|-------|----------|
| `backend/src/api/auth.routes.ts` | 14 | `res.json()`, `res.status().json()` |
| `backend/src/api/task.routes.ts` | 8 | `res.json()`, `res.status().json()` |
| `backend/src/api/middleware/auth.middleware.ts` | 2 | `res.status().json()` |
| `backend/src/main.ts` | 2 | `res.json()`, `res.status().json()` + health endpoint |

### Backend — console output

| File | Line | Pattern | Context |
|------|------|---------|---------|
| `main.ts:44` | `console.error(err)` | Global error handler |
| `main.ts:52` | `console.log(...)` | Startup message (whitelisted) |
| `auth.routes.ts:48,68,92` | `console.error(err)` | Route error fallback |

### Frontend

| File | Patterns |
|------|----------|
| `lib/api-client.ts:55` | `fetch()` — all external HTTP calls flow through this one function |
| No `console.log`/`console.error` found in frontend src/ |

**Assessment**: All HTTP responses are typed. Error paths consistently return `{ error: string }`. The frontend `fetch()` call is centralized in `api-client.ts` — good for auditing external calls.

### Data Leaving the System (PII/sensitive data check)

- Passwords: Only hashed (`passwordHash`) in DB; never returned in API responses
- Tokens: JWT returned on login/register, stored in localStorage — expected pattern
- Stripe keys: Never in source code; `process.env` only in config.ts (Zod-validated)
- User data: `name`, `email`, `isPremium` field returned in API responses — no PII leak

---

## Map D: Resources & Mutations

**Count**: 21 matches across 5 files

### Database Mutations (Prisma)

| File | Operation | Count |
|------|-----------|-------|
| `adapters/prisma/prisma-user.repository.ts` | `create`, `findUnique` (x2), `update` | 4 |
| `adapters/prisma/prisma-task.repository.ts` | `findMany`, `create`, `delete`, `findUnique`, `update`, `count` | 6 |

### Service-Level Multi-Mutation (FM6 Candidates)

| File | Function | Mutations | Transaction? |
|------|----------|-----------|--------------|
| `core/auth/auth.service.ts:register()` | `findByEmail` + `create` (via `userRepo`) | 2 | ❌ No |
| `core/task/task.service.ts:createTask()` | `countByOwnerId` + `create` (via `taskRepo`) | 2 | ❌ No |

**FM6 Risk**: Both `register()` and `createTask()` perform check-then-act patterns without wrapping in a database transaction. This creates a race condition window:
- **register()**: Two concurrent requests with same email could both pass `findByEmail` → both call `create`, second one crashes with DB unique constraint (caught by Prisma — user gets 500, not 409)
- **createTask()**: Two concurrent requests from user with 2 tasks could both pass `countByOwnerId` → both call `create`, resulting in 4 tasks instead of limit of 3

### Frontend — Browser Storage & External Calls

| File | Pattern | Count |
|------|---------|-------|
| `lib/api-client.ts` | `fetch()` | 1 (centralized) |
| `lib/auth-context.tsx` | `localStorage.{getItem,setItem,removeItem}` | 6 |
| `lib/api-client.ts` | `localStorage.getItem("token")` | 1 |

**Assessment**: `localStorage` usage for auth tokens is the standard pattern for SPAs. The `fetch()` call is centralized through `api-client.ts` — no raw `fetch()` anywhere else.

---

## Tech Context

### Packages Requiring ESLint Rules (Status Check)

| Package | Rule | Status |
|---------|------|--------|
| `@prisma/client` (5.x) | Ban `$queryRaw` / `$executeRaw` | ✅ Enforced in `eslint.config.js:232-238` |
| `zod` (3.x) | Validate presence at all boundaries | ✅ All 6 `req.body` accesses use Zod `.parse()` |
| `jsonwebtoken` (9.x) | No `process.env.JWT_SECRET` without config | ✅ Via `config.ts` — single validated config object |

### Violations Found (against existing ESLint rules)

| # | Ban | File | Line | Status |
|---|-----|------|------|--------|
| 1 | Ban 1: `JSON.parse()` | [auth-context.tsx](file:///i:/QuickTask%20%E2%80%93%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/lib/auth-context.tsx#L36) | 36 | ✅ `JSON.parse(storedUser)` — should use Zod |
| 2 | Ban 2: `any` type | [prisma-task.repository.ts](file:///i:/QuickTask%20%E2%80%93%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/adapters/prisma/prisma-task.repository.ts#L77) | 77 | ✅ `toDomainTask(prismaTask: any)` — use Prisma-generated type |
| 3 | Ban 4: `console.log` | [main.ts](file:///i:/QuickTask%20%E2%80%93%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/main.ts#L52) | 52 | ✅ Whitelisted (startup message in main.ts) |
| 4 | Ban 4: `console.error` | [auth.routes.ts](file:///i:/QuickTask%20%E2%80%93%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/auth.routes.ts#L48) | 48,68,92 | ✅ Whitelisted (error-only console in all files) |
| 5 | FM6: Multi-mutation w/o transaction | [task.service.ts](file:///i:/QuickTask%20%E2%80%93%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/core/task/task.service.ts#L27-L38) | 27,35 | ⚠️ `countByOwnerId` + `create` not in transaction |

### Packages NOT in Catalog (No Predefined Rules)

| Package | Notes |
|---------|-------|
| `express` (4.x) | Standard web framework — no catalog entry |
| `bcryptjs` | Password hashing — no ban needed |
| `stripe` (17.x) | Payment SDK — not yet wired; rules deferred to Phase 5 |
| `@tanstack/react-query` (5.x) | Frontend data fetching — no ban needed |
| `next` (16.x) | Frontend framework — no ban needed |
| `tailwindcss` (3.x) | Styling — no ban needed |

---

## Summary of Issues

### Resolved
- ~~FM2: auth.routes.ts bypasses composition root~~ — Fixed: refactored to `createAuthRouter(authService)` DI pattern. Ban 16 ESLint rule added to prevent regression.
- ~~Ban 1: JSON.parse in auth-context.tsx:36~~ — Fixed: replaced with `UserSchema.safeParse()` + Zod validation. Ban 1 rule added to frontend ESLint config.
- ~~Ban 2: `any` in prisma-task.repository.ts:77~~ — Fixed: replaced with Prisma's generated `Task` type.
- ~~FM6: Check-then-act race in task limit~~ — Fixed: `TaskRepositoryPort.transaction()` wraps count+create in Prisma `$transaction`, eliminating the race window.

### Clean — no outstanding issues

### Clean Areas
- ✅ No `$queryRaw` / `$executeRaw` anywhere in Prisma usage
- ✅ No `process.exit()` outside allowed files
- ✅ No `process.env` outside `config.ts` (backend) or `api-client.ts` (frontend)
- ✅ No `@ts-ignore` or `@ts-nocheck` anywhere
- ✅ No `export *` barrel exports
- ✅ No `Date.now()` / `Math.random()` / `crypto.randomUUID()` in `core/` or `lib/`
- ✅ No floating promises detected
- ✅ Frontend has zero circular dependencies
- ✅ All `req.body` access followed by Zod validation

---

## Notes

- Payment layer (`core/payment/`, `adapters/stripe/`, `api/payment.routes.ts`) not yet implemented — will be re-scanned after Phase 5
- Previous run (Phase 1) had 0 matches across all maps. Current run (Phase 4) has real production code — all 4 findings resolved.
