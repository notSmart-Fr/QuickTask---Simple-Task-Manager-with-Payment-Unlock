# Quickstart: Kanban Drag-and-Drop Validation

**Created**: 2026-07-06
**Feature**: [spec.md](./spec.md)

## Prerequisites

- Backend running on `http://localhost:4000` with Prisma migration applied
- Frontend running on `http://localhost:3000`
- At least one registered user account
- Desktop or tablet with mouse/touch input

## Setup

```bash
# Apply the position migration
cd backend
pnpm prisma migrate dev --name add_task_position
pnpm dev

# Start frontend (with @dnd-kit installed)
cd frontend
pnpm install
pnpm dev
```

## Validation Scenarios

### Scenario 1: Drag Between Columns (US1)

1. Log in and navigate to dashboard
2. Ensure you have at least 1 task in "To Do"
3. Click and hold a task card, drag it to the "In Progress" column
4. **Verify**: Task moves visually to "In Progress" column during drag (highlight on target)
5. **Verify**: Task appears in "In Progress" after drop
6. **Verify**: Refresh page — task stays in "In Progress" (persisted)
7. **Verify**: Status dropdown on the card now shows "In Progress"
8. Drag the task back to "To Do"
9. **Verify**: Task returns to "To Do" column

### Scenario 2: Reorder Within Column (US2)

1. Create 3 tasks in "To Do" with titles "A", "B", "C" (in that order)
2. Drag task "C" (bottom) to the top of "To Do"
3. **Verify**: Column order becomes: C, A, B
4. Refresh page
5. **Verify**: Order persists: C, A, B
6. Drag task "A" to the bottom
7. **Verify**: Order becomes: C, B, A
8. Drag task "C" to the middle (between B and A)
9. **Verify**: Order becomes: B, C, A

### Scenario 3: Cross-Column Drag with Position (US3)

1. Have 2 tasks in "To Do" (positions 0, 1) and 2 tasks in "In Progress" (positions 0, 1)
2. Drag the position-1 task from "To Do" to position 0 in "In Progress"
3. **Verify**: Dragged task now has status "In Progress" at position 0
4. **Verify**: Previous "In Progress" tasks shifted to positions 1 and 2
5. **Verify**: "To Do" column now has 1 task at position 0

### Scenario 4: Error Recovery (FR-105)

1. Drag a task to a new column
2. Before the API response completes, stop the backend server
3. **Verify**: Task snaps back to original position
4. **Verify**: Error message appears (e.g., "Failed to move task")

### Scenario 5: Dropdown Still Works (FR-106)

1. Use the status dropdown on any task to change its status
2. **Verify**: Task moves to target column, appended to bottom
3. **Verify**: No visual glitches or conflicts with drag-and-drop

### Scenario 6: Drag Outside Column (FR-111)

1. Start dragging a task
2. Release it over an area outside any column (e.g., the header)
3. **Verify**: Task returns to original position — no change

### Scenario 7: Same-Position No-Op (FR-110)

1. Note the current position of a task
2. Drag it slightly and release at the exact same position
3. **Verify**: No visual flicker, no extra API call

### Scenario 8: Accessibility (FR-106)

1. Navigate the page using only keyboard (Tab key)
2. **Verify**: Status dropdown is reachable and functional
3. Change a task's status via keyboard + dropdown
4. **Verify**: Task moves correctly

### Scenario 9: Mobile/Tablet Touch (FR-107)

1. Open the dashboard on a tablet or use Chrome DevTools device emulation (iPad)
2. Touch-hold a task card, drag to another column
3. **Verify**: Touch drag works — task moves to target column
