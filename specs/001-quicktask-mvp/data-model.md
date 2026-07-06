# Data Model: QuickTask MVP

**Created**: 2026-07-06
**Feature**: [spec.md](./spec.md)

## Entity Overview

```
User ──┬── Task (1:N)
       └── Payment (1:N)
```

## Entities

### User

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| name | string | required, 1-100 chars | |
| email | string | required, unique, valid email format | Used for login |
| passwordHash | string | required, bcrypt | Never returned in API responses |
| isPremium | boolean | default: false | Upgraded on successful payment |
| createdAt | DateTime | auto-generated | |
| updatedAt | DateTime | auto-updated | |

**Validation Rules**:
- `name`: Non-empty, trimmed, max 100 chars
- `email`: Valid email format, unique (case-insensitive), trimmed
- `password`: Min 8 chars, required at registration only

**State Transitions**:
```
Free (isPremium=false) ──[payment confirmed]──▶ Premium (isPremium=true)
```
Premium is irreversible once set.

### Task

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| title | string | required, 1-200 chars, trimmed | |
| description | string | optional, max 2000 chars | |
| status | enum | "TODO" / "IN_PROGRESS" / "DONE" | Default: "TODO". Can be changed via status update. |
| ownerId | UUID | FK → User.id, required | |
| createdAt | DateTime | auto-generated | |
| updatedAt | DateTime | auto-updated | |

**Validation Rules**:
- `title`: Non-empty after trim, max 200 chars
- `description`: Max 2000 chars, defaults to empty string
- `status`: Must be one of the three enum values
- `ownerId`: Must reference an existing User

**Business Rules**:
- Free users (isPremium=false): max 3 tasks total (all statuses)
- Premium users (isPremium=true): unlimited tasks
- Task limit is enforced atomically: `SELECT COUNT(*) WHERE ownerId = ?` inside a
  transaction with the `INSERT`
- Users can only access their own tasks (ownerId filter on all queries)

### Payment

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| userId | UUID | FK → User.id, required | |
| stripeSessionId | string | required, unique | Stripe Checkout Session ID |
| stripeEventId | string | nullable, unique | Stripe webhook event ID (for idempotency) |
| amount | integer | required | 500 (cents, = $5.00) |
| status | enum | "PENDING" / "COMPLETED" / "FAILED" | Default: "PENDING" |
| createdAt | DateTime | auto-generated | |
| completedAt | DateTime | nullable | Set when status → COMPLETED |

**Validation Rules**:
- `stripeSessionId`: Non-empty, unique
- `stripeEventId`: If present, must be unique (prevents duplicate webhook processing)
- `amount`: Must equal 500

**State Transitions**:
```
PENDING ──[webhook: checkout.session.completed]──▶ COMPLETED
PENDING ──[webhook: checkout.session.expired]────▶ FAILED
```
COMPLETED is terminal. FAILED is terminal (user must start new checkout).

## Relationships

| From | To | Type | Notes |
|------|----|------|-------|
| Task | User | N:1 (ownerId) | Cascade delete: deleting a user deletes their tasks |
| Payment | User | N:1 (userId) | Cascade delete: deleting a user deletes their payment records |

## Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| User | email (unique) | Login lookup, duplicate registration check |
| Task | ownerId + status | List tasks for a user, optionally filtered by column |
| Payment | stripeSessionId (unique) | Lookup by Stripe session |
| Payment | stripeEventId (unique) | Idempotency check on webhook |
| Payment | userId | List payments for a user |
