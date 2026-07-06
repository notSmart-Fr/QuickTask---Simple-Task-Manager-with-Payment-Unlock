# Implementation Plan: QuickTask MVP

**Branch**: `001-quicktask-mvp` | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-quicktask-mvp/spec.md`

## Summary

Build a minimal full-stack SaaS task manager with JWT authentication, Kanban-style
task CRUD (3-task free-tier limit), and a one-time $5 Stripe payment to unlock
unlimited tasks. Hexagonal architecture on the backend (EffectTS for typed
side-effects), Next.js App Router + TanStack Query + shadcn/ui on the frontend.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, both frontend and backend)

**Primary Dependencies**:
- Frontend: Next.js 14+ (App Router), TanStack Query, Zod, Tailwind CSS, shadcn/ui
- Backend: Express.js, EffectTS, Prisma, Zod, jsonwebtoken, bcrypt, Stripe SDK
- Shared: Zod schemas (validation parity between frontend and backend)

**Storage**: PostgreSQL (Supabase free tier or Railway free tier)

**Testing**: Vitest (unit + integration), Supertest (API integration tests)

**Target Platform**: Web — Vercel (frontend), Render/Railway (backend)

**Project Type**: Web application (separate `backend/` and `frontend/` directories)

**Performance Goals**:
- Task creation visible in < 2s (SC-003)
- Login to dashboard in < 5s (SC-002)
- Registration to dashboard in < 1min (SC-001)
- Payment flow complete in < 3min (SC-005)

**Constraints**:
- $0 infrastructure cost (Supabase free tier, Vercel Hobby, Render free tier)
- 3-task limit for free users, unlimited for premium
- No drag-and-drop, no task editing, no password reset, no email verification (MVP scope)

**Scale/Scope**: Single-user SaaS MVP, 4 pages (Home, Login, Register, Dashboard), 3 entities (User, Task, Payment)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| 1.1 Separation of Concerns | ✅ PASS | Backend (Express routes → Core services → Ports) separate from Frontend (pages → features → API hooks) |
| 1.2 Dependency Direction | ✅ PASS | Core imports nothing from frameworks; adapters implement ports; routes depend on abstractions |
| 1.3 Testability First | ✅ PASS | Core business logic (task limits, premium upgrade) testable without mocks; test priorities defined in Quality Gates |
| 1.4 Type Safety | ✅ PASS | Strict TS mandated; Zod schemas with inferred types; no `any`/`@ts-ignore` |
| 1.5 Observability by Default | ✅ PASS | Structured JSON logging on all critical paths (auth, task CRUD, Stripe webhook) |
| 1.6 Fail Gracefully | ✅ PASS | Timeouts on Stripe + DB; EffectTS typed errors; no stack traces to client |
| 1.7 Data Integrity | ✅ PASS | Zod validation at API boundaries; PII/secrets never logged |
| 1.8 Idempotency | ✅ PASS | Stripe webhook idempotency key handling (FR-015); duplicate events don't double-upgrade |
| 1.9 Backward Compatibility | ✅ PASS | REST API versioning via URL prefix; Prisma migrations follow expand-migrate-contract |
| 1.10 Resource Lifecycle | ✅ PASS | EffectTS Scope for DB connections; SIGTERM/SIGINT graceful shutdown |
| 1.11 State Sanitization | ✅ PASS | Passwords/tokens/Stripe keys never appear in logs or API responses |
| 1.12 Transaction Integrity | ✅ PASS | Premium upgrade + user tier change wrapped in Prisma transaction |
| 1.13 Forward Migration Contracts | ✅ PASS | Prisma migrations as the migration mechanism; schema evolution via expand-migrate-contract |
| 1.14 Invariant Preservation | ✅ PASS | Task validation (title non-empty, valid status) enforced at creation boundary, not just DB constraint |

**Gate Result**: All 14 principles pass. No violations. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-quicktask-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (REST API contracts)
│   ├── auth.yaml
│   ├── tasks.yaml
│   └── payment.yaml
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── core/                    # Domain logic (NO framework imports)
│   │   ├── task/
│   │   │   ├── task.entity.ts   # Task domain model + invariants
│   │   │   ├── task.service.ts  # create, delete, list, checkLimit
│   │   │   └── task.port.ts     # TaskRepositoryPort
│   │   ├── auth/
│   │   │   ├── auth.service.ts  # register, login, verifyToken
│   │   │   └── auth.port.ts     # UserRepositoryPort, PasswordHasherPort, TokenPort
│   │   └── payment/
│   │       ├── payment.service.ts  # createCheckout, handleWebhook
│   │       └── payment.port.ts     # PaymentGatewayPort
│   ├── adapters/                # Implementations of ports
│   │   ├── prisma/
│   │   │   ├── prisma-task.repository.ts
│   │   │   └── prisma-user.repository.ts
│   │   ├── stripe/
│   │   │   └── stripe-gateway.adapter.ts
│   │   ├── bcrypt/
│   │   │   └── bcrypt-hasher.adapter.ts
│   │   └── jwt/
│   │       └── jwt-token.adapter.ts
│   ├── api/                     # Express routes (thin)
│   │   ├── auth.routes.ts
│   │   ├── task.routes.ts
│   │   ├── payment.routes.ts
│   │   └── middleware/
│   │       └── auth.middleware.ts
│   ├── shared/
│   │   └── schemas.ts           # Zod validation schemas (shared domain definitions)
│   ├── config.ts                # Env validation at startup
│   └── main.ts                  # Composition root
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── core/
│   │   ├── task.service.test.ts
│   │   ├── auth.service.test.ts
│   │   └── payment.service.test.ts
│   ├── adapters/
│   │   └── stripe-gateway.test.ts
│   └── api/
│       ├── auth.routes.test.ts
│       ├── task.routes.test.ts
│       └── payment.routes.test.ts
├── .env.example
├── package.json
└── tsconfig.json

frontend/
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── page.tsx             # Landing page (/)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── layout.tsx
│   ├── features/                # Feature-based organization
│   │   ├── auth/
│   │   │   ├── login-form.tsx
│   │   │   ├── register-form.tsx
│   │   │   └── auth.api.ts      # TanStack Query hooks
│   │   ├── tasks/
│   │   │   ├── kanban-board.tsx
│   │   │   ├── task-card.tsx
│   │   │   ├── add-task-form.tsx
│   │   │   └── tasks.api.ts
│   │   └── payment/
│   │       ├── unlock-button.tsx
│   │       └── payment.api.ts
│   ├── components/ui/           # shadcn/ui primitives
│   ├── lib/                     # API client, auth context
│   │   ├── api-client.ts
│   │   └── auth-context.tsx
│   └── schemas/                 # Zod schemas (shared with backend)
│       ├── auth.schema.ts
│       └── task.schema.ts
├── tests/
│   ├── features/
│   │   ├── auth.test.tsx
│   │   └── tasks.test.tsx
│   └── api/
│       ├── auth.api.test.ts
│       └── tasks.api.test.ts
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

**Structure Decision**: Option 2 (Web application) with feature-based organization on
the frontend and hexagonal on the backend. Frontend features co-locate components
with their TanStack Query hooks. Backend separates core domain logic from adapters
and API routes per constitution Section 2.

## Complexity Tracking

> No violations detected. All 14 constitutional principles pass.
