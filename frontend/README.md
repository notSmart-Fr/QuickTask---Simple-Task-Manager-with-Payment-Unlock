# QuickTask Frontend

Next.js 16 + TypeScript + TanStack Query + Tailwind CSS frontend for QuickTask — a simple task manager with Stripe payment unlock.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 18
- **State**: TanStack Query (server state) + React Context (auth state)
- **Domain Logic**: Effect-TS 3.x (HTTP pipelines with typed errors)
- **Styling**: Tailwind CSS
- **Validation**: Zod (client-side)
- **Testing**: Vitest

## Architecture

```
src/
├── app/                   # Next.js App Router pages (declarative, no Effect)
│   ├── page.tsx           → Landing page
│   ├── login/page.tsx     → Login form
│   ├── register/page.tsx  → Register form
│   ├── dashboard/page.tsx → Kanban board + task management
│   ├── layout.tsx         → Root layout
│   └── providers.tsx      → TanStack Query + Auth providers
├── features/              # TanStack Query hooks + UI components
│   ├── auth/auth.api.ts   → useRegister, useLogin, useMe (Effect bridge)
│   ├── tasks/             → useTasks, useCreateTask, TaskCard, KanbanBoard, AddTaskForm
│   └── payment/           → useCreateCheckout, UnlockButton
├── core/                  # Domain logic (pure Effect-TS, no React)
│   ├── errors.ts          → Data.TaggedError: NetworkError, HttpError
│   └── api/               → Effect pipelines (auth.effect.ts, task.effect.ts, payment.effect.ts)
├── lib/                   # Shared infrastructure
│   ├── effect-client.ts   → Effect-based HTTP adapter (Effect.tryPromise + fetch)
│   └── auth-context.tsx   → Auth state (React Context + localStorage)
└── schemas/               → Client-side Zod schemas
```

## Setup

### Prerequisites

- Node.js 20+ and pnpm
- Backend running on `http://localhost:4000` (see [backend README](../backend/README.md))

### Installation

```bash
cd frontend
cp .env.example .env
pnpm install
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | Yes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | No (for future use) |

### Development

```bash
pnpm dev                    # Start dev server (port 3000)
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript check
pnpm test                   # Run tests
```

## Key Patterns

### Effect-TS Bridge

Every TanStack Query hook bridges Effect-TS to the imperative world via `Effect.runPromise(Effect.either(...))`:

```typescript
function runEffect<T>(program: Effect.Effect<T, Error>): Promise<T> {
  return Effect.runPromise(Effect.either(program))
    .then((either) => {
      if (Either.isLeft(either)) throw either.left;
      return either.right;
    });
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => runEffect(fetchTasksEffect()),
  });
}
```

### Error Handling

Errors from the API are typed `Data.TaggedError` instances with `_tag` matching:

```typescript
if (error._tag === "HttpError" && error.status === 403) {
  showLimitBanner(error.message);
}
```

## Pages

| Route | Description | Auth Required |
|-------|-------------|---------------|
| `/` | Landing page | No |
| `/login` | Login form | No |
| `/register` | Registration form | No |
| `/dashboard` | Kanban task board | Yes |
