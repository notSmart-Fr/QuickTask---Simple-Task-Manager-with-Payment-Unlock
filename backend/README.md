# QuickTask Backend

Express 5 + TypeScript + Effect-TS + Prisma + PostgreSQL backend for QuickTask — a simple task manager with Stripe payment unlock.

## Tech Stack

- **Runtime**: Node.js, Express 5, TypeScript strict
- **Domain Logic**: Effect-TS 3.x (typed errors, `Data.TaggedError`, `Effect.gen`)
- **Database**: Prisma ORM + PostgreSQL
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Payments**: Stripe Checkout SDK
- **Validation**: Zod (at HTTP boundary)
- **Testing**: Vitest + supertest

## Architecture

```
src/
├── core/                  # Domain logic (pure Effect-TS, no framework imports)
│   ├── auth/              → AuthService, User entity, ports
│   ├── task/              → TaskService, Task entity, ports
│   └── payment/           → PaymentService, Payment entity, ports
├── adapters/              # Infrastructure adapters (implement ports)
│   ├── prisma/            → PrismaUserRepository, PrismaTaskRepository, PrismaPaymentRepository
│   ├── bcrypt/            → BcryptHasher (password hashing)
│   ├── jwt/               → JwtToken (token signing & verification)
│   └── stripe/            → StripeGateway (checkout sessions, webhooks)
├── api/                   # Express routes (thin: validate → delegate → respond)
│   ├── auth.routes.ts     → POST /register, POST /login, GET /me
│   ├── task.routes.ts     → GET /tasks, POST /tasks, DELETE /tasks/:id, PATCH /tasks/:id/status
│   ├── payment.routes.ts  → POST /create-checkout, POST /webhook, GET /status
│   └── middleware/        → auth.middleware.ts (JWT verification)
├── shared/schemas.ts      # Zod schemas (shared with frontend)
├── config.ts              # Env validation at startup (crashes if missing)
└── main.ts                # Composition root (only place adapters are instantiated)
```

## Setup

### Prerequisites

- Node.js 20+ and pnpm
- PostgreSQL database (local or hosted)
- Stripe account (test mode)

### Installation

```bash
cd backend
cp .env.example .env
pnpm install
pnpm prisma migrate dev --name init
pnpm prisma generate
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) | Yes |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode) | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Yes |
| `FRONTEND_URL` | Frontend origin for CORS | Yes |
| `PORT` | Server port (default: 4000) | No |
| `NODE_ENV` | Environment (development/test/production) | No |

### Development

```bash
pnpm dev                    # Start with hot-reload (port 4000)
pnpm test                   # Run tests
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript check
```

### Seed Data

```bash
pnpm tsx prisma/seed.ts
```

Creates:
- **Free user**: `free@example.com` / `testpassword123` (3 tasks)
- **Premium user**: `premium@example.com` / `testpassword123` (5 tasks)

### Stripe Webhook (local development)

```bash
stripe listen --forward-to localhost:4000/api/v1/payment/webhook
```

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login, returns JWT |
| GET | `/auth/me` | Yes | Get current user |

### Tasks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/tasks` | Yes | List user's tasks |
| POST | `/tasks` | Yes | Create task (3 limit for free) |
| DELETE | `/tasks/:id` | Yes | Delete task (own only) |
| PATCH | `/tasks/:id/status` | Yes | Update task status |

### Payment

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payment/create-checkout` | Yes | Create Stripe Checkout session |
| POST | `/payment/webhook` | No | Stripe webhook (raw body) |
| GET | `/payment/status` | Yes | Get premium status |

## Testing

```bash
pnpm test              # Unit + integration tests
```

Tests use `Effect.either` + `Either.isLeft/isRight` for typed error assertions.
API tests use supertest with mocked service dependencies.
