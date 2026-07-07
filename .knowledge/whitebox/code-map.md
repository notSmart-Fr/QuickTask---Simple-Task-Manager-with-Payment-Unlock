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

3. frontend/src/features/auth/auth.effect.ts — registerEffect()
   - Pure Effect pipeline: effectApi.post<AuthResponse>("/auth/register", { name, email, password })
   - Returns Effect<AuthResponse, HttpError | NetworkError>

4. frontend/src/lib/effect-client.ts — effectApi.post()
   - Effect.tryPromise wrapping fetch() to {NEXT_PUBLIC_API_URL}/api/v1/auth/register
   - Adds auth token from localStorage if present (Bearer header)
   - Non-ok responses → HttpError { status, message }
   - Network failures → NetworkError { message }

   ═══════════════════ HTTP boundary ═══════════════════

5. backend/src/features/auth/auth.routes.ts — POST /api/v1/auth/register
   - RegisterInputSchema.safeParse(req.body) → 400 if invalid (Zod at boundary)
   - Effect.runPromise(Effect.either(authService.register(name, email, password)))
   - On Either.left: _tag match → 409 (EmailAlreadyRegistered) or 500
   - On Either.right: 201 { user, token }

6. backend/src/features/auth/auth.service.ts — AuthService.register()
   - Effect.gen pipeline: prisma.user.findUnique({ email }) → if exists, fail(EmailAlreadyRegistered)
   - Hash password via hasher.hash(password) (bcrypt, SALT_ROUNDS=12)
   - Create user via prisma.user.create({ name, email, passwordHash })
   - Generate JWT via tokenService.sign(userId, name, email, isPremium)
   - Returns { user, token }
   - AuthService constructor: (prisma, hasher?, tokenService?) with BcryptHasher/JwtToken defaults

   Login flow is identical structure, authService.login() instead of register():
   - prisma.user.findUnique({ email }) → if not found, fail(InvalidCredentials)
   - hasher.compare(password, user.passwordHash) → if invalid, fail(InvalidCredentials)
   - tokenService.sign(...) → return { user, token }

   GET /me: authMiddleware → authService.getUserWithFreshToken(id)
   - Reads user from DB to ensure isPremium reflects webhook updates, not stale JWT
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
   - Layered collision detection: pointerWithin → closestCorners (prioritizes card items)
   - DragOverlay shows active TaskCard with variant="overlay" (opacity 0.5)
   - DropSpacer: fixed-height droppable zone below last card in each column (toggles border/bg)
   - computeDropTarget: triesColumnDrop → trySameColumnDrop → tryCrossColumnDrop
   - Fractional position computation: midpoint of neighbors for reorder, +100 for append, /2 for first
   - handleDragEnd: validates no-op → useUpdateTaskStatus mutation
   - ErrorToast: auto-dismissing notification (3s) on mutation error

4. frontend/src/features/tasks/sortable-task-card.tsx — SortableTaskCard
   - useSortable({ id: task.id }) → transform/transition CSS
   - Wraps TaskCard, passes drag handle props

5. frontend/src/features/tasks/task-card.tsx — TaskCard
   - Displays title, description, status selector, delete button, timeAgo
   - variant="overlay" hides interactive elements in DragOverlay (prevents duplicate IDs)

6. frontend/src/features/tasks/tasks.api.ts — useUpdateTaskStatus()
   - Optimistic update: immediately repositions in cache, re-sorts by (status, position)
   - On error: rolls back to previousTasks snapshot
   - On success: replaces moved task with server's authoritative position + re-sorts
   - runEffect bridge: Effect.runPromise(Effect.either(program)) → throw either.left

7. frontend/src/features/tasks/tasks.effect.ts — updateTaskStatusEffect()
   - effectApi.patch(`/tasks/${id}/status`, { status, position })

   ═══════════════════ HTTP boundary ═══════════════════

8. backend/src/features/tasks/tasks.routes.ts — All task endpoints (authMiddleware on all)
   - GET / → listTasks → 200 { tasks }
   - POST / → Zod.safeParse → createTask → _tag match (TaskLimitReached → 403)
   - PATCH /:id/status → Zod.safeParse → updateTaskStatus(id, status, position) → _tag match (TaskNotFound → 404)
   - DELETE /:id → deleteTask → _tag match (TaskNotFound → 404)

9. backend/src/features/tasks/tasks.service.ts — TaskService
   - Constructor: (prisma: PrismaClient) — no repository, calls Prisma directly
   - createTask:
     - Premium user: direct create with position = (lastTodoTask?.position ?? 0) + 100
     - Free user: $transaction with count check → if ≥ FREE_TASK_LIMIT (3), throw TaskLimitReached → fail
   - listTasks: prisma.task.findMany ordered by [{ status: "asc" }, { position: "asc" }]
   - deleteTask: Effect.either wraps prisma.task.delete (single-row, no shifting — fractional indexing)
     - Either.isLeft → fail(TaskNotFound)
   - updateTaskStatus: Effect.either wraps prisma.task.update (single-row UPDATE of status + position)
     - Frontend computes fractional position from neighbors — backend just writes it
     - No transaction, no shifting, no index conversion
   - toDomainTask: inline mapping from Prisma row to Task domain type

   Task positions: Float, default 100, indexed on [ownerId, status, position]
```

## Flow 3: Stripe Payment Unlock

```
1. frontend/src/features/payment/unlock-button.tsx — UnlockButton
   - Calls useCreateCheckout() mutation
   - Sends successUrl (dashboard) + cancelUrl (dashboard)
   - On success: window.location.href = checkoutUrl (redirects to Stripe)

2. frontend/src/features/payment/payment.effect.ts — createCheckoutEffect()
   - effectApi.post("/payment/create-checkout", { successUrl, cancelUrl })

   ═══════════════════ HTTP boundary ═══════════════════

3. backend/src/features/payment/payment.routes.ts — POST /api/v1/payment/create-checkout
   - authMiddleware, Zod.safeParse(CreateCheckoutSchema), Effect.either(paymentService.createCheckout)
   - Returns 201 { checkoutUrl }

4. backend/src/features/payment/payment.service.ts — PaymentService.createCheckout()
   - Constructor: (prisma: PrismaClient, gateway: PaymentGateway)
   - gateway.createCheckoutSession(userId, customerEmail, successUrl, cancelUrl)
   - prisma.payment.create({ userId, stripeSessionId, status: "PENDING" })
   - Returns checkoutUrl

5. backend/src/features/payment/driver.stripe.ts — StripeGateway implements PaymentGateway
   - createCheckoutSession: stripe.checkout.sessions.create({ mode: "payment", unit_amount: 500, … })

   ═══════════════════ Stripe webhook ═══════════════════

6. backend/src/features/payment/payment.routes.ts — POST /api/v1/payment/webhook
   - No authMiddleware (Stripe sends raw request)
   - Extracts stripe-signature header → paymentService.handleWebhook(rawBody, signature)

7. backend/src/features/payment/payment.service.ts — PaymentService.handleWebhook()
   - gateway.verifyWebhookSignature(body, signature) → WebhookEvent (via Effect.try)
   - gateway.getEventId(event) / gateway.getSessionId(event) — if no sessionId, return early
   - Atomic Prisma $transaction wraps idempotency check + processing:
     - tx.payment.findFirst({ stripeEventId: eventId }) → if already processed, return early
     - tx.payment.findUnique({ stripeSessionId: sessionId }) → if not found, throw PaymentRecordNotFound
     - On checkout.session.completed:
       - tx.payment.update({ status: "COMPLETED", stripeEventId })
       - tx.user.update({ isPremium: true })
     - Other events: tx.payment.update({ status: "FAILED", stripeEventId })
   - Concurrent Stripe webhooks for the same event serialize — the second one sees the processed record and does nothing

8. backend/src/features/payment/driver.stripe.ts — StripeGateway
   - verifyWebhookSignature: stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)

9. backend/src/features/payment/payment.routes.ts — GET /api/v1/payment/status
   - authMiddleware → returns { isPremium: req.user.isPremium } (from JWT, no DB read)
```

## Quick Reference: "Where is X?"

| Question | File |
|----------|------|
| Composition root (all `new` calls) | [backend/src/main.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/main.ts) |
| Config validation | [backend/src/config.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/config.ts) |
| Free task limit (3) | [backend/src/features/tasks/tasks.service.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/tasks/tasks.service.ts#L24) |
| Auth routes + Zod boundary | [backend/src/features/auth/auth.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/auth/auth.routes.ts) |
| Task routes + Zod boundary | [backend/src/features/tasks/tasks.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/tasks/tasks.routes.ts) |
| Payment routes | [backend/src/features/payment/payment.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/payment/payment.routes.ts) |
| Auth middleware (JWT verify) | [backend/src/middleware/auth.middleware.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/middleware/auth.middleware.ts) |
| Auth service (Hasher/TokenService interfaces + BcryptHasher/JwtToken impls) | [backend/src/features/auth/auth.service.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/auth/auth.service.ts) |
| Task service (fractional indexing) | [backend/src/features/tasks/tasks.service.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/tasks/tasks.service.ts) |
| Payment service (PaymentGateway interface) | [backend/src/features/payment/payment.service.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/payment/payment.service.ts) |
| Stripe gateway driver | [backend/src/features/payment/driver.stripe.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/payment/driver.stripe.ts) |
| Domain errors (Data.TaggedError) | In each service file: [auth.service.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/auth/auth.service.ts#L73-79), [tasks.service.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/tasks/tasks.service.ts#L28-34), [payment.service.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/payment/payment.service.ts#L47-53) |
| Prisma schema (all models) | [backend/prisma/schema.prisma](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/prisma/schema.prisma) |
| DB migrations | [backend/prisma/migrations/](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/prisma/migrations/) |
| ESLint config (consolidated features/ bans) | [backend/eslint.config.js](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/eslint.config.js) |
| Frontend HTTP client (Effect wrapper) | [frontend/src/lib/effect-client.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/lib/effect-client.ts) |
| Frontend effect pipelines | [frontend/src/features/auth/auth.effect.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/features/auth/auth.effect.ts), [frontend/src/features/tasks/tasks.effect.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/features/tasks/tasks.effect.ts), [frontend/src/features/payment/payment.effect.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/features/payment/payment.effect.ts) |
| Frontend TanStack Query hooks | [frontend/src/features/auth/auth.api.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/features/auth/auth.api.ts), [frontend/src/features/tasks/tasks.api.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/features/tasks/tasks.api.ts), [frontend/src/features/payment/payment.api.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/features/payment/payment.api.ts) |
| Kanban drag-and-drop (DndContext) | [frontend/src/features/tasks/kanban-board.tsx](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/features/tasks/kanban-board.tsx) |
| Fractional position computation | [frontend/src/features/tasks/kanban-board.tsx](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/frontend/src/features/tasks/kanban-board.tsx#L154-L163) |
| Health endpoint (with DB probe) | [backend/src/main.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/main.ts#L42-L49) |
| Graceful shutdown (SIGTERM/SIGINT) | [backend/src/main.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/main.ts#L77-L94) |
