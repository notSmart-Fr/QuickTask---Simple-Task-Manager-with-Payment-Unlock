# Tasks: QuickTask MVP

**Input**: Design documents from `/specs/001-quicktask-mvp/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included for constitution-mandated critical paths (core business logic, auth, Stripe webhook idempotency). See constitution §3.3.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/prisma/`, `backend/tests/`
- **Frontend**: `frontend/src/`, `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling configuration for both backend and frontend

- [X] T001 Initialize backend project with pnpm, TypeScript, Express, EffectTS, Prisma, Zod, jsonwebtoken, bcrypt, Stripe SDK in `backend/package.json`
- [X] T002 [P] Initialize frontend project with Next.js 14 (App Router), TypeScript, Tailwind CSS, TanStack Query, Zod in `frontend/package.json`
- [X] T003 [P] Configure backend TypeScript strict mode, ESLint, Vitest in `backend/tsconfig.json`
- [X] T004 [P] Configure frontend TypeScript strict mode, ESLint, Vitest, Tailwind in `frontend/tsconfig.json` and `frontend/tailwind.config.ts`
- [X] T005 [P] Create backend `.env.example` with all required variables (DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FRONTEND_URL, PORT) in `backend/.env.example`
- [X] T006 [P] Create frontend `.env.example` with required variables (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) in `frontend/.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Create Prisma schema with User, Task, Payment models per data-model.md (enums for TaskStatus and PaymentStatus, unique indexes on email, stripeSessionId, stripeEventId) in `backend/prisma/schema.prisma`
- [x] T008 Run initial Prisma migration and generate client: `pnpm prisma migrate dev --name init`
- [X] T009 [P] Create backend config module with env validation at startup (Zod schema for all env vars, crash on missing config in `backend/src/config.ts`
- [X] T010 Create Express app shell with CORS, JSON parsing, structured JSON logging middleware in `backend/src/main.ts`
- [X] T011 [P] Create shared Zod validation schemas (name, email, password, task title, task description, task status enum) in `backend/src/shared/schemas.ts` — these will also be duplicated in `frontend/src/schemas/` for frontend-side validation parity
- [X] T012 [P] Create frontend API client (fetch wrapper with base URL, auth header injection, JSON parsing, typed error handling in `frontend/src/lib/api-client.ts`
- [X] T013 Implement JWT auth middleware (verify token, attach userId to request, return 401 on invalid/expired in `backend/src/api/middleware/auth.middleware.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - User Registration & Login (Priority: P1)

**Goal**: Visitors can register and log in with JWT authentication. Protected dashboard access. Logout.

**Independent Test**: Register a new account → log in → see empty dashboard → log out → verify redirect to login. Register with same email again → see error. Login with wrong password → see error.

### Implementation for User Story 1

**Backend — Domain Layer**

- [X] T014 [P] [US1] Define auth port interfaces (UserRepositoryPort, PasswordHasherPort, TokenPort) in `backend/src/core/auth/auth.port.ts`
- [X] T015 [P] [US1] Define User entity types and validation (no framework imports) in `backend/src/core/auth/user.entity.ts`
- [X] T016 [US1] Implement AuthService (register with duplicate-email check, login with password verify, getUserFromToken) in `backend/src/core/auth/auth.service.ts`

**Backend — Adapters**

- [X] T017 [P] [US1] Implement BcryptHasher adapter (hash password, compare password) in `backend/src/adapters/bcrypt/bcrypt-hasher.adapter.ts`
- [X] T018 [P] [US1] Implement JwtToken adapter (sign token with 7-day expiry carrying userId+isPremium, verify token) in `backend/src/adapters/jwt/jwt-token.adapter.ts`
- [X] T019 [P] [US1] Implement PrismaUserRepository (create user, findByEmail, findById, update to premium) in `backend/src/adapters/prisma/prisma-user.repository.ts`

**Backend — API Routes**

- [X] T020 [US1] Implement auth routes (POST /register, POST /login, GET /me) with Zod validation and HTTP error mapping in `backend/src/api/auth.routes.ts`
- [X] T021 [US1] Wire auth dependencies in composition root (instantiate adapters, inject into service, mount routes) in `backend/src/main.ts`

**Backend — Tests (constitution §3.3: CRITICAL for auth)**

- [x] T022 [P] [US1] Test AuthService.register (success, duplicate email, validation errors) in `backend/tests/core/auth.service.test.ts`
- [x] T023 [P] [US1] Test AuthService.login (success, wrong password, non-existent email) in `backend/tests/core/auth.service.test.ts`

**Frontend**

- [X] T025 [P] [US1] Create Zod auth schemas (register input, login input) for client-side validation in `frontend/src/schemas/auth.schema.ts`
- [X] T026 [P] [US1] Create auth API hooks (useRegister, useLogin, useMe) with TanStack Query useMutation/useQuery in `frontend/src/features/auth/auth.api.ts`
- [X] T027 [US1] Create AuthContext (user state, login/logout actions, token storage in localStorage) in `frontend/src/lib/auth-context.tsx`
- [X] T028 [US1] Create login page with form (email + password), validation errors, redirect to dashboard on success in `frontend/src/app/login/page.tsx`
- [X] T029 [US1] Create register page with form (name + email + password), validation errors, redirect to dashboard on success in `frontend/src/app/register/page.tsx`
- [X] T030 [US1] Create landing page (public, with links to Login and Register) in `frontend/src/app/page.tsx`
- [X] T031 [US1] Create root layout with AuthProvider wrapper in `frontend/src/app/layout.tsx`
- [X] T032 [US1] Create dashboard page (authenticated only, shows user name + logout button, placeholder for tasks) in `frontend/src/app/dashboard/page.tsx`

**Checkpoint**: User Story 1 should be fully functional — register, login, protected dashboard, logout

---

## Phase 4: User Story 2 - Task Management (Priority: P2)

**Goal**: Authenticated users can create, view, and delete tasks on a 3-column Kanban board. Free users limited to 3 tasks. Status changes via dropdown.

**Independent Test**: Login → see Kanban board with 3 empty columns → create 3 tasks → all appear in "To Do" column → try creating 4th task → see limit error with upgrade prompt → change task status via dropdown → task moves to correct column → delete task → task disappears → create again → succeeds.

### Implementation for User Story 2

**Backend — Domain Layer**

- [x] T033 [P] [US2] Define TaskRepositoryPort interface in `backend/src/core/task/task.port.ts`
- [x] T034 [P] [US2] Define Task entity types, state machine (status transitions), and validation in `backend/src/core/task/task.entity.ts`
- [x] T035 [US2] Implement TaskService (create with atomic limit check via Prisma transaction, delete with ownership check, list by user, updateStatus with validation and ownership) using EffectTS with typed errors in `backend/src/core/task/task.service.ts`

**Backend — Adapters**

- [x] T036 [US2] Implement PrismaTaskRepository (list by ownerId, create, delete by id+ownerId, findById, updateStatus) in `backend/src/adapters/prisma/prisma-task.repository.ts`

**Backend — API Routes**

- [x] T037 [US2] Implement task routes (GET /tasks, POST /tasks, DELETE /tasks/:id, PATCH /tasks/:id/status) with Zod validation, auth middleware, and EffectTS error-to-HTTP mapping in `backend/src/api/task.routes.ts`
- [x] T038 [US2] Wire task dependencies in composition root (instantiate repository, inject into service, mount routes) in `backend/src/main.ts`

**Backend — Tests (constitution §3.3: CRITICAL for task limit enforcement)**

- [x] T039 [P] [US2] Test TaskService.create (success for free user under limit, error at limit, success for premium user over limit, empty title rejection, concurrent limit enforcement) in `backend/tests/core/task.service.test.ts`
- [x] T040 [P] [US2] Test TaskService.delete, list, and updateStatus (ownership enforcement, valid status transitions) in `backend/tests/core/task.service.test.ts`
- [x] T041 [US2] Test task API endpoints (POST 201/403/400, GET 200, DELETE 200/404/403, PATCH status 200/404/403/400) in `backend/tests/api/task.routes.test.ts`

**Frontend**

- [x] T042 [P] [US2] Create Zod task schemas (create task, status update) for client-side validation in `frontend/src/schemas/task.schema.ts`
- [x] T043 [P] [US2] Create tasks API hooks (useTasks, useCreateTask, useDeleteTask, useUpdateTaskStatus) with TanStack Query and cache invalidation in `frontend/src/features/tasks/tasks.api.ts`
- [x] T044 [P] [US2] Create TaskCard component (displays title, description, status dropdown selector, delete button) in `frontend/src/features/tasks/task-card.tsx`
- [x] T045 [US2] Create AddTaskForm component (title input, optional description, submit button, validation errors) in `frontend/src/features/tasks/add-task-form.tsx`
- [x] T046 [US2] Create KanbanBoard component (3 columns: To Do, In Progress, Done — tasks grouped by status, status change via TaskCard dropdown, empty state message per column) in `frontend/src/features/tasks/kanban-board.tsx`
- [x] T047 [US2] Integrate tasks into dashboard page — KanbanBoard + AddTaskForm stacked, free-tier limit indicator (shows "2/3 tasks used"), upgrade prompt when limit hit in `frontend/src/app/dashboard/page.tsx`

**Checkpoint**: User Stories 1 AND 2 should both work independently — full task CRUD on Kanban board with free-tier limit

---

## Phase 5: User Story 3 - Payment & Premium Unlock (Priority: P3)

**Goal**: Free users can pay $5 one-time via Stripe Checkout to unlock unlimited tasks. Already-premium users don't see the unlock button. Duplicate webhooks are handled idempotently.

**Independent Test**: Login as free user with 3 tasks → click "Unlock Unlimited Tasks ($5)" → redirected to Stripe Checkout → pay with test card `4242 4242 4242 4242` → redirected back → premium badge visible, unlock button gone → create 4th+ tasks → succeed. Login as another free user → unlock button still visible. Resend webhook from Stripe dashboard → no duplicate upgrade.

### Implementation for User Story 3

**Backend — Domain Layer**

- [x] T048 [P] [US3] Define PaymentGatewayPort interface (createCheckoutSession, verifyWebhookSignature, getEventId, getSessionId) in `backend/src/core/payment/payment.port.ts`
- [x] T049 [P] [US3] Define Payment entity types, state transitions, and validation in `backend/src/core/payment/payment.entity.ts`
- [x] T050 [US3] Implement PaymentService (createCheckout: store PENDING payment, create Stripe session, return URL; handleWebhook: verify signature, idempotency check via stripeEventId, atomic upgrade [update payment + set user isPremium in Prisma transaction]) using EffectTS with typed errors in `backend/src/core/payment/payment.service.ts`

**Backend — Adapters**

- [x] T051 [US3] Implement StripeGateway adapter (createCheckoutSession with $5 product, verifyWebhookSignature, parse event) in `backend/src/adapters/stripe/stripe-gateway.adapter.ts`
- [x] T052 [US3] Implement PrismaPaymentRepository (create, findBySessionId, findByEventId, updateStatus, listByUser) in `backend/src/adapters/prisma/prisma-payment.repository.ts`

**Backend — API Routes**

- [x] T053 [US3] Implement payment routes (POST /create-checkout — auth required, returns checkout URL; POST /webhook — unauthenticated, raw body + Stripe signature; GET /status — auth required, returns premium status) in `backend/src/api/payment.routes.ts`
- [x] T054 [US3] Wire payment dependencies in composition root (instantiate StripeGateway + repository, inject into service, mount routes, configure raw body parser for webhook route) in `backend/src/main.ts`

**Backend — Tests (constitution §3.3: CRITICAL for Stripe webhook idempotency)**

- [x] T055 [P] [US3] Test PaymentService.handleWebhook (successful upgrade: payment→COMPLETED + user→premium, idempotency: duplicate event returns 200 with no side effects, expired session: payment→FAILED, invalid signature) in `backend/tests/core/payment.service.test.ts`
- [x] T056 [US3] Test payment API endpoints (POST /create-checkout 200/400, GET /status 200, webhook idempotency) in `backend/tests/api/payment.routes.test.ts`

**Frontend**

- [x] T057 [P] [US3] Create payment API hooks (useCreateCheckout — redirects to Stripe URL, usePaymentStatus) with TanStack Query in `frontend/src/features/payment/payment.api.ts`
- [x] T058 [US3] Create UnlockButton component (visible only to free users, shows "$5 one-time", triggers checkout redirect, handles errors) in `frontend/src/features/payment/unlock-button.tsx`
- [x] T059 [US3] Integrate UnlockButton and premium status into dashboard (conditionally show/hide based on isPremium, display premium badge when upgraded) in `frontend/src/app/dashboard/page.tsx`

**Checkpoint**: All three user stories fully functional — auth, task management with Kanban and 3-task limit, Stripe payment unlock

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final touches, code quality, and validation

- [x] T060 [P] Validate all input forms display clear error messages within 1s of submission (per SC-008) across `frontend/src/features/auth/` and `frontend/src/features/tasks/`
- [x] T061 [P] Add responsive Tailwind styles to all pages (mobile-first check: landing, login, register, dashboard) in `frontend/src/app/`
- [x] T062 [P] Add Prisma seed script with test data for demo (free user with 3 tasks, premium user with 5 tasks) in `backend/prisma/seed.ts`
- [x] T063 [P] Create backend README with setup/run instructions in `backend/README.md`
- [x] T064 [P] Create frontend README with setup/run instructions in `frontend/README.md`
- [ ] T065 Run full quickstart.md validation scenarios (all 4 scenarios, 30 test cases) end-to-end, including informal timing checks against SC-001 through SC-005 (register < 1min, login < 5s, task create < 2s, limit error < 2s, payment flow < 3min)
- [x] T066 Run constitution quality gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — all must pass with zero errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 (Auth) → US2 (Tasks) → US3 (Payment) is the recommended sequential order
  - US2 depends on US1 (needs auth middleware, user context)
  - US3 depends on US1 (needs auth) and US2 (needs task limit enforcement to motivate payment)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (auth middleware, user identity for task ownership, AuthContext in frontend)
- **User Story 3 (P3)**: Depends on US1 (auth) + US2 (task limit triggers upgrade prompt, dashboard integration)

### Within Each User Story

- Domain ports → Entity types (parallel)
- Entity types → Service implementation
- Service → Adapter implementations (can be parallel with service if ports are defined first)
- Adapters + Service → API routes
- API routes → Frontend hooks (parallel with backend tests)
- Frontend hooks → Frontend components
- Frontend components → Page integration

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, T005, T006 can all run in parallel (different files in different directories)
- **Phase 2**: T009, T011, T012 can run in parallel after T007
- **Phase 3 (US1)**: T014+T015 (ports+entity), T017+T018+T019 (all adapters), T022+T023 (service tests), T025+T026 (frontend schemas+hooks) are parallel groups
- **Phase 4 (US2)**: T033+T034 (port+entity), T039+T040 (service tests), T042+T043+T044 (frontend parallel group)
- **Phase 5 (US3)**: T048+T049 (port+entity), T057 (frontend hook)
- **Phase 6**: T060, T061, T062, T063, T064 all parallel

---

## Parallel Example: User Story 1

```bash
# After foundational phase, launch parallel backend task groups:

# Group 1 — Domain definitions (no dependencies between them):
Task: "Define auth port interfaces in backend/src/core/auth/auth.port.ts"          # T014
Task: "Define User entity types in backend/src/core/auth/user.entity.ts"           # T015

# Group 2 — All adapters in parallel (after T014 for contract reference):
Task: "Implement BcryptHasher adapter in backend/src/adapters/bcrypt/"              # T017
Task: "Implement JwtToken adapter in backend/src/adapters/jwt/"                     # T018
Task: "Implement PrismaUserRepository in backend/src/adapters/prisma/"              # T019

# Group 3 — Frontend parallel (no dependencies between them):
Task: "Create Zod auth schemas in frontend/src/schemas/auth.schema.ts"              # T025
Task: "Create auth API hooks in frontend/src/features/auth/auth.api.ts"             # T026
```

---

## Parallel Example: User Story 2

```bash
# Parallel tasks within US2:

# Group 1 — Domain definitions:
Task: "Define TaskRepositoryPort in backend/src/core/task/task.port.ts"             # T033
Task: "Define Task entity in backend/src/core/task/task.entity.ts"                  # T034

# Group 2 — Frontend (all parallel with backend implementation):
Task: "Create task schemas in frontend/src/schemas/task.schema.ts"                  # T042
Task: "Create tasks API hooks in frontend/src/features/tasks/tasks.api.ts"          # T043
Task: "Create TaskCard component in frontend/src/features/tasks/task-card.tsx"      # T044
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T013)
3. Complete Phase 3: User Story 1 — Auth (T014-T032)
4. **STOP and VALIDATE**: Test registration, login, protected dashboard, logout
5. Deploy/demo: working auth system

### Incremental Delivery (Recommended)

1. Setup + Foundational → Foundation ready
2. Add User Story 1 (Auth) → Test independently → Deploy/Demo (MVP: users can sign up)
3. Add User Story 2 (Tasks + Kanban) → Test independently → Deploy/Demo (core product: task management with limit)
4. Add User Story 3 (Payment) → Test independently → Deploy/Demo (full product: paid unlock)
5. Polish phase → Final validation via quickstart.md → Ship

### Sequential Strategy (Single Developer)

T001→T002→T003→T004→T005→T006 → T007→T008→T009→T010→T011→T012→T013 → T014→T015→T016→T017→T018→T019→T020→T021→T022→T023→T024→T025→T026→T027→T028→T029→T030→T031→T032 → T033→T034→T035→T036→T037→T038→T039→T040→T041→T042→T043→T044→T045→T046→T047 → T048→T049→T050→T051→T052→T053→T054→T055→T056→T057→T058→T059 → T060→T061→T062→T063→T064→T065→T066

---

## Notes

- [P] tasks = different files, no dependencies — can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Core business logic (task limits, premium upgrade, auth) MUST have passing tests per constitution §3.3
- Stripe webhook idempotency (duplicate event) MUST have a passing test
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All external API calls MUST have timeouts per constitution §1.6 and §4
- Never log passwords, tokens, or Stripe keys per constitution §1.11
- All user input validated with Zod at boundaries per constitution §1.7 and §3.6
- **Adapter tests**: Constitution §3.3 lists adapter implementations as a HIGH testing priority. Adapter correctness is validated through API integration tests (T024, T041, T056) which exercise the full stack including all adapter layers — no separate adapter unit test tasks are needed
- **Timing SCs (SC-001–SC-005)**: These are human-validated during T065 (quickstart walkthrough) rather than automated benchmarks. The app is a single-user SaaS MVP — automated performance testing infrastructure is overkill for this scope
- **Session expiry form preservation**: Out of scope for MVP. When a user's JWT expires, they are redirected to login and form state is lost. This is documented in the spec edge cases as an accepted limitation
