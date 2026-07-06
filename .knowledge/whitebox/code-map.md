# Code Map — QuickTask

## Flow 1: User Registration & Login

```
1. frontend/src/app/register/page.tsx — RegisterPage component
   - User fills name/email/password → RegisterInputSchema.safeParse (client-side)
   - Calls registerMutation.mutate(parsed.data)
   - On success: authLogin(data.user, data.token) → router.push('/dashboard')
   - clearErrors() on every field onChange clears validation + server errors

2. frontend/src/features/auth/auth.api.ts — useRegister()
   - Wraps runEffect(registerEffect(name, email, password))
   - runEffect: Effect.runPromise(Effect.either(program)) → throw either.left on error
   - Stores auth_token in localStorage, sets auth state via AuthContext

3. frontend/src/core/api/auth.effect.ts — registerEffect()
   - Pure Effect pipeline: effectApi.post<AuthResponse>("/auth/register", { name, email, password })
   - Returns Effect<AuthResponse, HttpError | NetworkError>

4. frontend/src/lib/effect-client.ts — effectApi.post()
   - Effect.tryPromise wrapping fetch() to {NEXT_PUBLIC_API_URL}/api/v1/auth/register
   - Adds auth token from localStorage if present (Bearer header)
   - Non-ok responses → HttpError { status, message }
   - Network failures → NetworkError { message }

   ═══════════════════ HTTP boundary ═══════════════════

5. backend/src/api/auth.routes.ts — POST /api/v1/auth/register
   - RegisterInputSchema.safeParse(req.body) → 400 if invalid (Zod at boundary)
   - Effect.runPromise(Effect.either(authService.register(name, email, password)))
   - On Either.left: _tag match → 409 (EmailAlreadyRegistered) or 500
   - On Either.right: 201 { user, token }

6. backend/src/core/auth/auth.service.ts — AuthService.register()
   - Effect.gen pipeline: findByEmail → if exists, fail(EmailAlreadyRegistered)
   - Hash password via hasher.hash(password) (bcrypt adapter)
   - Create user via userRepo.create({ name, email, passwordHash })
   - Generate JWT via tokenService.sign(userId, name, email, isPremium)
   - Returns { user, token }

7. backend/src/adapters/prisma/prisma-user.repository.ts — PrismaUserRepository
   - findByEmail: prisma.user.findUnique({ where: { email } })
   - create: prisma.user.create({ data: { name, email, passwordHash } })

8. backend/src/adapters/bcrypt/bcrypt-hasher.adapter.ts — BcryptHasher
   - hash: bcrypt.hash(password, 10)
   - compare: bcrypt.compare(password, hash)

9. backend/src/adapters/jwt/jwt-token.adapter.ts — JwtToken
   - sign: jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
   - verify: jwt.verify(token, JWT_SECRET) → decoded payload

   Login flow is identical structure, authService.login() instead of register():
   - findByEmail → if not found, fail(InvalidCredentials)
   - compare password hash → if invalid, fail(InvalidCredentials)
   - sign JWT → return { user, token }
```

## Flow 2: Task CRUD + Kanban Drag-and-Drop

```
1. frontend/src/app/dashboard/page.tsx — DashboardPage
   - Renders AddTaskForm + KanbanBoard
   - Auth check: if (!user) → redirect to /login

2. frontend/src/features/tasks/add-task-form.tsx — AddTaskForm
   - Client-side Zod validation
   - useCreateTask() mutation → invalidates ["tasks"] on success

3. frontend/src/features/tasks/kanban-board.tsx — KanbanBoard
   - DndContext wrapping three DroppableColumn components (TODO/IN_PROGRESS/DONE)
   - DragOverlay shows active TaskCard with variant="overlay" (opacity 0.5)
   - findDropTarget(overId) → { status, index } for drop position calculation
   - handleDragEnd: validates no-op (same position, same status) → useUpdateTaskStatus mutation
   - ErrorToast: auto-dismissing notification (3s) on mutation error

4. frontend/src/features/tasks/sortable-task-card.tsx — SortableTaskCard
   - useSortable({ id: task.id }) → transform/transition CSS
   - Wraps TaskCard, passes drag handle props

5. frontend/src/features/tasks/task-card.tsx — TaskCard
   - Displays title, description, status selector, delete button, timeAgo
   - variant="overlay" hides interactive elements in DragOverlay (prevents duplicate IDs)
   - React useId() for unique form element IDs

6. frontend/src/features/tasks/tasks.api.ts — useUpdateTaskStatus()
   - Optimistic update: immediately repositions in cache, re-sorts by (status, position)
   - On error: rolls back to previousTasks snapshot
   - On settled: invalidates ["tasks"] query

   ═══════════════════ HTTP boundary ═══════════════════

7. backend/src/api/task.routes.ts — All task endpoints (authMiddleware on all)
   - GET / → listTasks → 200 { tasks, total, limit, isPremium }
   - POST / → Zod.safeParse → createTask → _tag match (TaskLimitReached → 403)
   - PATCH /:id/status → Zod.safeParse → updateTaskStatus(id, status, position) → _tag match
   - DELETE /:id → deleteTask → _tag match (TaskNotFound → 404)

8. backend/src/core/task/task.service.ts — TaskService
   - createTask: countByOwnerId → if ≥ 3 and !isPremium → fail(TaskLimitReached)
     → repo.create(data) with auto-computed position (count of existing TODO tasks)
   - listTasks: repo.listByOwnerId → map to { tasks, total, limit, isPremium }
   - deleteTask: findByIdAndOwnerId → if not found, fail(TaskNotFound) → delete + shift
   - updateTaskStatus: findByIdAndOwnerId → updateStatusByIdAndOwnerId
   - moveTask: complex position logic in Prisma transaction:
     - Same column: shift positions between old and new index
     - Cross-column: shift target column up, shift source column down

9. backend/src/adapters/prisma/prisma-task.repository.ts — PrismaTaskRepository
   - transaction: Prisma $transaction wrapping new PrismaTaskRepository(tx)
   - shiftPositions: prisma.task.updateMany with gte filter + increment
   - deleteByIdAndOwnerId: delete + updateMany (position decrement for remaining)
   - Implements TaskRepositoryPort { listByOwnerId, create, updateStatus, shiftPositions, … }
```

## Flow 3: Stripe Payment Unlock

```
1. frontend/src/features/payment/unlock-button.tsx — UnlockButton
   - Calls useCreateCheckout() mutation
   - Sends successUrl (dashboard) + cancelUrl (dashboard)
   - On success: window.location.href = checkoutUrl (redirects to Stripe)

2. frontend/src/core/api/payment.effect.ts — createCheckoutEffect()
   - effectApi.post("/payment/create-checkout", { successUrl, cancelUrl })

   ═══════════════════ HTTP boundary ═══════════════════

3. backend/src/api/payment.routes.ts — POST /api/v1/payment/create-checkout
   - authMiddleware, Zod.safeParse, Effect.either(paymentService.createCheckout)
   - Returns { checkoutUrl }

4. backend/src/core/payment/payment.service.ts — PaymentService.createCheckout()
   - stripeGateway.createCheckoutSession(userId, successUrl, cancelUrl)
   - paymentRepo.create({ ownerId, stripeSessionId, status: "PENDING" })

5. backend/src/adapters/stripe/stripe-gateway.adapter.ts — StripeGateway
   - createCheckoutSession: stripe.checkout.sessions.create({ mode: "payment", unit_amount: 500, … })

   ═══════════════════ Stripe webhook ═══════════════════

6. backend/src/api/payment.routes.ts — POST /api/v1/payment/webhook
   - No authMiddleware (Stripe sends raw request)
   - Extracts stripe-signature header → paymentService.handleWebhook(rawBody, signature)

7. backend/src/core/payment/payment.service.ts — PaymentService.handleWebhook()
   - stripeGateway.verifyWebhookSignature(body, signature) → StripeWebhookEvent
   - Atomic Prisma transaction wraps idempotency check + processing:
     - findByEventId(eventId) → if already processed, return early (serialized via transaction isolation)
     - findBySessionId → if not found, throw PaymentRecordNotFound
     - On checkout.session.completed: updateStatus("COMPLETED") + userRepo.transaction updateToPremium
     - Other events: updateStatus("FAILED")
   - Concurrent Stripe webhooks for the same event serialize — the second one sees the processed record and does nothing

8. backend/src/adapters/stripe/stripe-gateway.adapter.ts
   - verifyWebhookSignature: stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
```

## Quick Reference: "Where is X?"

| Question | File |
|----------|------|
| Composition root (all `new` calls) | [backend/src/main.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/main.ts) |
| Config validation | [backend/src/config.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/config.ts) |
| Free task limit (3) | [backend/src/core/task/task.entity.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/core/task/task.entity.ts#L19) |
| Auth routes + Zod boundary | [backend/src/api/auth.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/auth.routes.ts) |
| Task routes + Zod boundary | [backend/src/api/task.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/task.routes.ts) |
| Payment routes | [backend/src/api/payment.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/payment.routes.ts) |
| Auth middleware (JWT verify) | [backend/src/api/middleware/auth.middleware.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/middleware/auth.middleware.ts) |
| Domain errors (Data.TaggedError) | [backend/src/core/auth/auth.service.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/core/auth/auth.service.ts) and [backend/src/core/task/task.service.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/core/task/task.service.ts) and [backend/src/core/payment/payment.service.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/core/payment/payment.service.ts) |
| Prisma schema (all models) | [backend/prisma/schema.prisma](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/prisma/schema.prisma) |
| DB migrations | [backend/prisma/migrations/](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/prisma/migrations/) |
| Shared Zod schemas | [backend/src/shared/schemas.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/shared/schemas.ts) |
| Frontend HTTP client (Effect wrapper) | [frontend/src/lib/effect-client.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/lib/effect-client.ts) |
| Frontend API effect pipelines | [frontend/src/core/api/auth.effect.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/core/api/auth.effect.ts) and [frontend/src/core/api/task.effect.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/core/api/task.effect.ts) |
| Frontend TanStack Query hooks | [frontend/src/features/auth/auth.api.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/features/auth/auth.api.ts) and [frontend/src/features/tasks/tasks.api.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/features/tasks/tasks.api.ts) |
| Kanban drag-and-drop (DndContext) | [frontend/src/features/tasks/kanban-board.tsx](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/features/tasks/kanban-board.tsx) |
| Stripe gateway adapter | [backend/src/adapters/stripe/stripe-gateway.adapter.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/adapters/stripe/stripe-gateway.adapter.ts) |
| Health endpoint (with DB probe) | [backend/src/main.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/main.ts#L51-L58) |
| Graceful shutdown (SIGTERM/SIGINT) | [backend/src/main.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/main.ts#L81-L108) |
