# Research: QuickTask MVP

**Created**: 2026-07-06
**Purpose**: Resolve technical decisions and document rationale for all technology choices.

## Decisions

### 1. Backend Architecture: Hexagonal (Ports & Adapters) + EffectTS

**Decision**: Use hexagonal architecture with EffectTS for typed side-effect management.

**Rationale**:
- Core business logic (task limits, premium state transitions) is pure and testable
  without mocking Express, Prisma, or Stripe.
- EffectTS provides typed error channels (`Effect<A, E, R>`) eliminating the need for
  try/catch boilerplate on every external call.
- Dependency injection via EffectTS `Layer` replaces manual wiring at the composition
  root.
- Stripe webhook handling benefits from EffectTS `retry` and `timeout` operators.

**Alternatives considered**:
- Plain Express + try/catch: More familiar but error handling is ad-hoc and untyped.
- NestJS: Too heavy for a 3-entity MVP; opinionated module system adds boilerplate.

### 2. Frontend Data Fetching: TanStack Query

**Decision**: Use TanStack Query (React Query v5) for all server state management.

**Rationale**:
- Automatic caching, background refetching, and optimistic updates reduce boilerplate.
- `useMutation` with `onError`/`onSuccess` provides structured error handling that
  maps cleanly to the typed error responses from the backend.
- Co-locating hooks with feature components (e.g., `tasks.api.ts` next to
  `kanban-board.tsx`) keeps data fetching close to where it's consumed.

**Alternatives considered**:
- SWR: Simpler but less feature-rich; no mutation management built-in.
- Plain fetch + useState: No caching, requires manual loading/error state management
  on every page.

### 3. UI Components: shadcn/ui + Tailwind CSS

**Decision**: Use shadcn/ui component primitives with Tailwind CSS for styling.

**Rationale**:
- shadcn/ui components are copied into the project (not a dependency) — full control
  over styling and behavior.
- Tailwind utility classes enable rapid, consistent, responsive design.
- Components like Button, Card, Input, Form cover all UI needs for this MVP.

**Alternatives considered**:
- MUI / Chakra UI: Heavier, more opinionated, harder to customize.
- Plain Tailwind: Loses accessibility and interaction patterns that shadcn/ui provides
  for free.

### 4. Database: PostgreSQL + Prisma

**Decision**: PostgreSQL via Prisma ORM.

**Rationale**:
- Prisma's type-safe queries eliminate a class of runtime errors.
- Migrations are declarative and version-controlled.
- PostgreSQL's row-level locking supports atomic task-limit enforcement (SELECT COUNT
  + INSERT in a transaction).
- Supabase free tier provides 500MB PostgreSQL at $0.

**Alternatives considered**:
- SQLite: Simpler but no concurrent write support; not suitable for web service.
- Drizzle ORM: Lighter but less mature ecosystem; Prisma's migration tooling is
  battle-tested.

### 5. Authentication: JWT (jsonwebtoken + bcrypt)

**Decision**: Stateless JWT authentication with bcrypt password hashing.

**Rationale**:
- Stateless JWT means no session store — simpler deployment on free-tier hosting
  that may cold-start.
- bcrypt is the industry standard for password hashing (salt + adaptive cost factor).
- JWT can carry user ID and premium status, avoiding a DB lookup on every request
  for basic auth checks.

**Alternatives considered**:
- Sessions with express-session + Redis: Requires Redis, adds infrastructure cost
  and complexity.
- NextAuth.js: Tightly coupled to Next.js; doesn't fit well with a separate Express
  backend.

### 6. Payment: Stripe Checkout Sessions + Webhooks

**Decision**: Stripe Checkout for payment UI, webhooks for backend confirmation.

**Rationale**:
- Stripe Checkout is a hosted payment page — no PCI compliance burden on the app.
- Webhooks provide the authoritative confirmation of payment (not the redirect URL,
  which users may close).
- Idempotency is built into Stripe webhook delivery — each event has a unique ID
  that the backend deduplicates.
- Stripe test mode is free and mirrors production behavior exactly.

**Alternatives considered**:
- Stripe Payment Elements (embedded): More control but more UI to build; overkill for
  a single $5 product.
- PayPal / Lemon Squeezy: Different ecosystems; Stripe is the standard for developer
  tooling and documentation.

### 7. Validation: Zod (shared between frontend and backend)

**Decision**: Zod for all runtime validation, with schema types inferred.

**Rationale**:
- Single source of truth for validation rules shared between frontend and backend.
- `z.infer<typeof schema>` eliminates manual type duplication.
- Zod's `.strict()` mode rejects unknown fields, enforcing data integrity at
  boundaries.

**Alternatives considered**:
- Yup: Similar features but Zod has better TypeScript inference.
- Joi: Heavier, less TypeScript-native.

### 8. Testing: Vitest + Supertest

**Decision**: Vitest for unit/integration tests, Supertest for API integration tests.

**Rationale**:
- Vitest is fast (esbuild-based), compatible with Jest APIs, and works for both
  frontend and backend.
- Supertest allows testing Express routes without starting a server.
- Core service tests use EffectTS `runSync` for deterministic test execution.

**Alternatives considered**:
- Jest: Slower, requires separate config for TS.
- Playwright: Overkill for a 4-page MVP with no complex browser interactions.

### 9. Hosting: Vercel (Frontend) + Render/Railway (Backend)

**Decision**: Vercel Hobby for frontend, Render or Railway free tier for backend.

**Rationale**:
- Both are $0 for MVP scale.
- Vercel is the natural choice for Next.js (zero-config deploy).
- Render/Railway provide managed PostgreSQL + Node.js hosting.
- Cold starts on free tier are acceptable for a demo/submission.

**Alternatives considered**:
- Single Vercel deployment with API routes: Would couple backend to Next.js, violating
  separation of concerns.
- Fly.io: Free tier requires credit card; Render/Railway don't.
