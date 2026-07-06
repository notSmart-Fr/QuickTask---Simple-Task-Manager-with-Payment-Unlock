# Feature Specification: QuickTask MVP

**Feature Branch**: `001-quicktask-mvp`

**Created**: 2026-07-06

**Status**: Draft

**Input**: QuickTask – Simple Task Manager with Payment Unlock. A minimal full-stack SaaS
application that allows users to manage personal tasks. Users can register and log in,
create and manage tasks with a limit for free users, and unlock unlimited tasks through
a one-time Stripe payment.

## Clarifications

### Session 2026-07-06

- Q: Can users change a task's status to move it between Kanban columns? → A: Yes. Users can change a task's status via a dropdown on each card. Tasks can move between To Do, In Progress, and Done. No drag-and-drop — status change via dropdown only.
- Q: What is the JWT token expiry duration? → A: 7 days. Tokens expire after 7 days from issuance. No refresh mechanism — users re-login after expiry.

## User Scenarios & Testing

### User Story 1 - User Registration & Login (Priority: P1)

A visitor wants to create an account and log in so they can manage their personal tasks
securely. Only authenticated users can access the dashboard and task features.

**Why this priority**: Authentication is the foundation. Without it, no other feature
(tasks, payment) can function because all data is user-scoped.

**Independent Test**: Can be fully tested by registering a new account, logging in,
accessing the dashboard, and logging out. Delivers value as a working auth system
even before tasks exist.

**Acceptance Scenarios**:

1. **Given** a visitor on the landing page, **When** they click "Register" and submit
   name, email, and password, **Then** an account is created and they are redirected
   to the dashboard.

2. **Given** a registered user on the login page, **When** they enter correct email
   and password, **Then** they are authenticated and redirected to the dashboard.

3. **Given** a user entering invalid credentials, **When** they submit the login form,
   **Then** they see an error message and remain on the login page.

4. **Given** a registered user, **When** they try to register with the same email
   again, **Then** they see an error message that the email is already in use.

5. **Given** an unauthenticated visitor, **When** they try to access the dashboard
   directly via URL, **Then** they are redirected to the login page.

6. **Given** an authenticated user, **When** they click "Logout", **Then** their
   session ends and they are redirected to the landing page.

---

### User Story 2 - Task Management (Priority: P2)

An authenticated user wants to create, view, and delete tasks on a visual Kanban
board so they can track their work.

**Why this priority**: This is the core value proposition. Once users can log in,
they need to manage tasks. The free-tier limit of 3 tasks creates the incentive
for the payment feature (US3).

**Independent Test**: Can be fully tested by logging in, creating tasks, viewing
them in the Kanban board, and deleting them. A free user hitting the 3-task limit
should see the upgrade prompt.

**Acceptance Scenarios**:

1. **Given** an authenticated user on the dashboard, **When** they view the Kanban
   board, **Then** they see three columns: To Do, In Progress, and Done with tasks
   distributed across columns based on their status.

2. **Given** an authenticated free user with fewer than 3 tasks, **When** they fill
   in a task title and description and submit, **Then** the task appears in the
   "To Do" column.

3. **Given** an authenticated free user with exactly 3 tasks, **When** they try to
   create a 4th task, **Then** they see a message explaining the free-tier limit
   and are prompted to unlock unlimited tasks.

4. **Given** an authenticated premium user, **When** they create a task, **Then**
   the task is created regardless of how many tasks they already have.

5. **Given** an authenticated user with existing tasks, **When** they click delete
   on a task, **Then** the task is removed from the board.

6. **Given** an authenticated user, **When** they view their tasks, **Then** they
   only see tasks they created — not tasks from other users.

---

### User Story 3 - Payment & Premium Unlock (Priority: P3)

A free user who has hit the task limit wants to pay a one-time fee to unlock
unlimited tasks permanently.

**Why this priority**: Monetization depends on US1 (auth) and US2 (task limit
enforcement). A user must first experience the value of task management and
encounter the limit before they are motivated to pay.

**Independent Test**: Can be fully tested by logging in as a free user, clicking
"Unlock Unlimited Tasks", completing a payment, and verifying the premium status
upgrade takes effect immediately — allowing creation of more than 3 tasks.

**Acceptance Scenarios**:

1. **Given** an authenticated free user on the dashboard, **When** they view the
   page, **Then** they see an "Unlock Unlimited Tasks ($5)" button.

2. **Given** an authenticated free user, **When** they click "Unlock Unlimited
   Tasks ($5)", **Then** they are redirected to a secure payment page to complete
   the $5 one-time payment.

3. **Given** a user who completes payment successfully, **When** they return to
   the dashboard, **Then** their account is upgraded to premium, the unlock
   button is no longer visible, and they can create more than 3 tasks.

4. **Given** a user whose payment fails or is cancelled, **When** they return to
   the dashboard, **Then** their account remains free-tier and they can retry
   the payment.

5. **Given** an already-premium user on the dashboard, **When** they view the
   page, **Then** they do NOT see the "Unlock Unlimited Tasks" button.

6. **Given** a payment webhook is received twice for the same transaction (duplicate),
   **When** the system processes it, **Then** the user is only upgraded once — no
   double-processing occurs.

---

### Edge Cases

- What happens when a user's session expires while they are creating a task?
  The system redirects to login with a clear message. Form input is NOT preserved
  (out of scope for MVP). User must log in again and re-enter their task.

- What happens when a user deletes all their tasks? The board shows empty columns
  with a helpful message indicating no tasks exist yet.

- What happens if the payment provider is unreachable during checkout? The user
  sees a clear error message and can retry. No partial payment state is created.

- What happens when a free user's account is somehow flagged premium incorrectly?
  The system must not rely solely on a boolean flag in a single location — task
  limit enforcement is active by default, and premium status explicitly disables it.

- What happens on concurrent task creation requests from the same user? The system
  must enforce the task limit atomically — two simultaneous requests from a free
  user with 2 existing tasks must not both succeed and result in 4 tasks.

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow visitors to register with name, email, and password.
- **FR-002**: System MUST allow registered users to log in with email and password.
- **FR-003**: System MUST reject duplicate registrations with the same email address.
- **FR-004**: System MUST protect the dashboard and all task operations behind
  authentication — unauthenticated access must be denied. JWT tokens expire
  after 7 days; users must re-login after expiry.
- **FR-005**: System MUST display tasks in a three-column Kanban board: To Do,
  In Progress, Done. Tasks are distributed across columns based on their status.
- **FR-006**: System MUST allow authenticated users to create tasks with a title
  and optional description. New tasks default to "To Do" status.
- **FR-006a**: System MUST allow authenticated users to change a task's status
  (To Do → In Progress → Done, or any direction) via a status selector on each task card.
- **FR-007**: System MUST allow authenticated users to view all their own tasks.
- **FR-008**: System MUST allow authenticated users to delete their own tasks.
- **FR-009**: System MUST prevent users from viewing, modifying, or deleting
  tasks belonging to other users.
- **FR-010**: System MUST limit free-tier users to a maximum of 3 tasks.
- **FR-011**: System MUST display a clear message and upgrade prompt when a free
  user attempts to exceed the 3-task limit.
- **FR-012**: System MUST provide an "Unlock Unlimited Tasks" button visible
  only to free-tier users.
- **FR-013**: System MUST initiate a one-time $5 payment via a secure payment
  provider when the unlock button is clicked.
- **FR-014**: System MUST upgrade the user's account to premium upon successful
  payment confirmation.
- **FR-015**: System MUST handle duplicate payment confirmations idempotently —
  a user must not be upgraded more than once for the same payment.
- **FR-016**: System MUST allow premium users to create unlimited tasks.
- **FR-017**: System MUST hide the unlock button for users who are already premium.
- **FR-018**: System MUST allow users to log out, terminating their session.
- **FR-019**: System MUST show a public landing page for unauthenticated visitors
  with options to log in or register.
- **FR-020**: System MUST validate all user inputs (name, email, password, task
  title) and reject empty or malformed submissions with clear error messages.

### Key Entities

- **User**: Represents a registered account. Key attributes: unique identifier,
  name, email, hashed password, premium status (boolean). Tied to all tasks they
  own and their payment history.

- **Task**: Represents a single task item. Key attributes: unique identifier, title,
  description (optional), status (To Do / In Progress / Done), owner (linked to User),
  creation timestamp.

- **Payment**: Represents a payment transaction. Key attributes: unique identifier,
  user (linked to User), payment provider reference, amount ($5), status
  (pending / completed / failed), timestamp. Used to verify premium upgrades
  and prevent duplicate processing.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A new visitor can register an account and reach the dashboard in
  under 1 minute.
- **SC-002**: A registered user can log in and see their tasks in under 5 seconds.
- **SC-003**: A user can create a task and see it appear on the Kanban board
  within 2 seconds of submission.
- **SC-004**: A free user who hits the 3-task limit sees a clear, actionable
  upgrade prompt within 2 seconds of attempting to create a 4th task.
- **SC-005**: A user can complete the full payment flow (click unlock → pay →
  return to dashboard → create 4th task) in under 3 minutes.
- **SC-006**: 100% of duplicate payment confirmations are handled correctly
  (no double-upgrade, no data corruption).
- **SC-007**: A user can only see and manage their own tasks — 0% cross-user
  data leakage in manual and automated testing.
- **SC-008**: All form validation errors are displayed to the user within 1
  second of submission with clear, actionable messages.

## Assumptions

- Users have a modern web browser and a stable internet connection.
- The payment provider handles PCI compliance; the application does not store
  or transmit raw payment card data.
- A single premium tier exists — there is no subscription, no recurring billing,
  and no tier beyond the one-time $5 unlock.
- Task status changes are supported via dropdown on each card. Drag-and-drop
  between columns is out of scope for this MVP.
- Task editing (updating title/description after creation) is out of scope for
  this MVP. Users can create, view, and delete only.
- Password reset / "forgot password" flow is out of scope for this MVP.
- Email verification is out of scope for this MVP. Registration is immediate.
- The payment amount is fixed at $5 USD. No discount codes or variable pricing.
- Mobile responsiveness is required (the layout must adapt to small screens) but
  a dedicated mobile app is out of scope.
- The landing page is informational only — it does not require content management.
