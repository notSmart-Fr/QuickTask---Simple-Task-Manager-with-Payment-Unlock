# Quickstart: QuickTask MVP

**Created**: 2026-07-06
**Purpose**: Step-by-step validation guide to prove the feature works end-to-end.

## Prerequisites

- Node.js 20+ and pnpm
- PostgreSQL database (local or Supabase free tier)
- Stripe account (test mode) — [dashboard.stripe.com](https://dashboard.stripe.com)
- Git

## Setup

### 1. Clone and install

```bash
# Backend
cd backend
cp .env.example .env
pnpm install

# Frontend
cd ../frontend
cp .env.example .env
pnpm install
```

### 2. Configure environment

**backend/.env**:
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-here
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:3000
PORT=4000
```

**frontend/.env**:
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3. Initialize database

```bash
cd backend
pnpm prisma migrate dev --name init
pnpm prisma generate
```

### 4. Start services

```bash
# Terminal 1: Backend
cd backend
pnpm dev          # → http://localhost:4000

# Terminal 2: Frontend
cd frontend
pnpm dev          # → http://localhost:3000
```

### 5. Stripe webhook forwarding (local dev)

```bash
stripe listen --forward-to localhost:4000/api/v1/payment/webhook
```

## Validation Scenarios

### Scenario 1: Registration & Login (US1)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open http://localhost:3000 | Landing page with Register/Login buttons |
| 2 | Click Register, fill form, submit | Redirected to dashboard, no tasks shown |
| 3 | Click Logout | Redirected to landing page |
| 4 | Click Login, enter credentials | Redirected to dashboard |
| 5 | Try accessing /dashboard without login | Redirected to /login |
| 6 | Register again with same email | Error: "Email already registered" |
| 7 | Login with wrong password | Error: "Invalid email or password" |

### Scenario 2: Task Management (US2)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login, view dashboard | Three empty Kanban columns visible |
| 2 | Create task "Task 1" | Appears in "To Do" column |
| 3 | Create "Task 2" | Appears in "To Do" column |
| 4 | Create "Task 3" | Appears in "To Do" column |
| 5 | Try creating "Task 4" | Error: "Task limit reached. Unlock for $5." |
| 6 | Delete "Task 1" | Task disappears from board |
| 7 | Create "Task 4" again | Succeeds (now 3 tasks) |
| 8 | Open in incognito, register new user | New user sees empty board |
| 9 | Login as first user again | Only your 3 tasks visible |

### Scenario 3: Payment & Premium (US3)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login as free user (3 tasks) | "Unlock Unlimited Tasks ($5)" button visible |
| 2 | Click unlock button | Redirected to Stripe Checkout |
| 3 | Enter test card: `4242 4242 4242 4242`, any future date, any CVC | Payment succeeds |
| 4 | Wait for redirect back to dashboard | "Unlock" button gone |
| 5 | Create "Task 4" | Succeeds (now premium) |
| 6 | Create more tasks | All succeed, no limit |
| 7 | Login as another free user | "Unlock" button still visible for them |

### Scenario 4: Payment Edge Cases

| Step | Action | Expected |
|------|--------|----------|
| 1 | Free user clicks unlock, closes Stripe tab | Payment not completed; user remains free |
| 2 | Free user clicks unlock, uses test decline card `4000 0000 0000 0002` | Payment declines; user remains free |
| 3 | Simulate duplicate webhook (resend from Stripe dashboard) | No duplicate upgrade; idempotency works |
| 4 | Premium user checks dashboard | No unlock button visible |

## Run Tests

```bash
# Backend
cd backend
pnpm test                    # Core service tests
pnpm test:api                # API integration tests (requires DB)

# Frontend
cd frontend
pnpm test                    # Component + hook tests
```

## Environment Variables Reference

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | `postgresql://localhost:5432/quicktask` |
| JWT_SECRET | Secret key for JWT signing | `openssl rand -hex 32` |
| STRIPE_SECRET_KEY | Stripe secret key (test mode) | `sk_test_...` |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret | `whsec_...` |
| FRONTEND_URL | Frontend origin (CORS) | `http://localhost:3000` |
| PORT | Backend server port | `4000` |

### Frontend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| NEXT_PUBLIC_API_URL | Backend API base URL | `http://localhost:4000/api/v1` |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe publishable key (test mode) | `pk_test_...` |
