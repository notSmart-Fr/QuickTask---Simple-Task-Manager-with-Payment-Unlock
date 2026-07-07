'use client';

import { useTasks, useUpdateTaskStatus } from './tasks.api';
import { SortableTaskCard } from './sortable-task-card';
import { TaskCard } from './task-card';
import type { Task, TaskStatus } from './task.schema';
import {
  DndContext,
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  useDndContext,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState, useEffect } from 'react';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'TODO', label: 'To Do' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'DONE', label: 'Done' },
];

const columnStatuses = new Set<string>(COLUMNS.map((c) => c.status));

// Spacer droppable IDs — positioned below the last card in each column
// so users see a visible "drop here" zone instead of card replacement.
const spacerIds = new Set<string>(COLUMNS.map((c) => `${c.status}-spacer`));

// Layered collision strategy: pointerWithin checks exact cursor position first,
// giving priority to sortable card items. Falls back to closestCorners for empty columns.
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const cardCollisions = pointerCollisions.filter((c) => !columnStatuses.has(c.id.toString()));
  if (cardCollisions.length > 0) return cardCollisions;
  return closestCorners(args);
};

// ── Sub-components ──

function DroppableColumn({ status, label, children }: { status: TaskStatus; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`bg-gray-100 rounded-lg p-4 pb-2 min-h-[120px] transition-colors ${
        isOver ? 'border-2 border-blue-400 bg-blue-50' : 'border-2 border-transparent'
      }`}
    >
      <h3 className="font-semibold text-gray-800 mb-3">{label}</h3>
      {children}
    </div>
  );
}

// ponytail: fixed-height drop spacer so layout never shifts during drag.
// Only toggles border + background — no height animation, no flicker.
function DropSpacer({ status }: { status: TaskStatus }) {
  const id = `${status}-spacer`;
  const { setNodeRef, isOver } = useDroppable({ id });
  const { active } = useDndContext();
  const isDragging = active !== null;

  // Hide "Drop here" label when the dragged task is from this same column.
  // The spacer is still a valid droppable for cross-column drops.
  const activeStatus = active?.data?.current?.status as TaskStatus | undefined;
  const sameColumn = isDragging && activeStatus === status;

  return (
    <div
      ref={setNodeRef}
      className={`mt-1 ${
        isDragging ? 'h-12 border-2 rounded-lg flex items-center justify-center' : 'h-0.5'
      } ${
        isOver && !sameColumn ? 'border-blue-400 bg-blue-50' : 'border-transparent'
      }`}
    >
      {isDragging && isOver && !sameColumn && <span className="text-sm text-blue-600 font-medium">Drop here</span>}
    </div>
  );
}

function DragPreview({ task }: { task: Task | undefined }) {
  if (!task) return null;
  return (
    <DragOverlay>
      <div className="shadow-2xl rotate-2"><TaskCard task={task} variant="overlay" /></div>
    </DragOverlay>
  );
}

function ErrorToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg transition-opacity" role="alert">
      {message}
    </div>
  );
}

// ── Helpers ──

function sortedColumnTasks(tasks: Task[], status: TaskStatus): Task[] {
  return tasks
    .filter((t) => t.status === status)
    .sort((a, b) => a.position - b.position);
}

// ponytail: @dnd-kit's arrayMove is an inline 3-liner — no need to hunt for the export.
function arrayMove<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...arr];
  const [item] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, item);
  return result;
}

type DropTarget = { status: TaskStatus; position: number };

function tryColumnDrop(tasks: Task[], activeTask: Task, overId: string): DropTarget | null {
  // Handle column droppable and spacer droppable
  const statusFromId = columnStatuses.has(overId)
    ? (overId as TaskStatus)
    : spacerIds.has(overId)
      ? overId.replace("-spacer", "") as TaskStatus
      : null;
  if (!statusFromId) return null;

  const colTasks = sortedColumnTasks(tasks, statusFromId).filter((t) => t.id !== activeTask.id);
  // Guard: dropping on own column at the end is a no-op
  if (activeTask.status === statusFromId &&
      sortedColumnTasks(tasks, activeTask.status).indexOf(activeTask) === colTasks.length) return null;

  // Append past the last task in the column
  const position = colTasks.length > 0 ? colTasks[colTasks.length - 1].position + 100 : 100;
  return { status: statusFromId, position };
}

function trySameColumnDrop(tasks: Task[], activeTask: Task, overId: string): DropTarget | null {
  const colTasks = sortedColumnTasks(tasks, activeTask.status);
  const oldIndex = colTasks.findIndex((t) => t.id === activeTask.id);
  const overIndex = colTasks.findIndex((t) => t.id === overId);
  if (oldIndex === -1 || overIndex === -1 || oldIndex === overIndex) return null;

  const moved = arrayMove(colTasks, oldIndex, overIndex);
  const targetIndex = moved.findIndex((t) => t.id === activeTask.id);

  // Compute fractional position from neighbors in the moved array
  let position: number;
  if (targetIndex === 0) {
    position = moved[1].position / 2;
  } else if (targetIndex === moved.length - 1) {
    position = moved[moved.length - 2].position + 100;
  } else {
    position = (moved[targetIndex - 1].position + moved[targetIndex + 1].position) / 2;
  }

  return { status: activeTask.status, position };
}

function tryCrossColumnDrop(tasks: Task[], activeTask: Task, overId: string): DropTarget | null {
  const overTask = tasks.find((t) => t.id === overId);
  if (!overTask) return null;
  if (activeTask.status === overTask.status) return null;

  const targetCol = sortedColumnTasks(tasks, overTask.status).filter((t) => t.id !== activeTask.id);
  const overIndex = targetCol.findIndex((t) => t.id === overId);

  // Compute fractional position in the target column
  let position: number;
  if (targetCol.length === 0) {
    position = 100;
  } else if (overIndex <= 0) {
    position = targetCol[0].position / 2;
  } else if (overIndex >= targetCol.length) {
    position = targetCol[targetCol.length - 1].position + 100;
  } else {
    position = (targetCol[overIndex - 1].position + targetCol[overIndex].position) / 2;
  }

  return { status: overTask.status, position };
}

function computeDropTarget(tasks: Task[], activeId: string, overId: string): DropTarget | null {
  const activeTask = tasks.find((t) => t.id === activeId);
  if (!activeTask) return null;

  return tryColumnDrop(tasks, activeTask, overId)
    ?? trySameColumnDrop(tasks, activeTask, overId)
    ?? tryCrossColumnDrop(tasks, activeTask, overId);
}

// ── Main ──

export function KanbanBoard() {
  const tasksQuery = useTasks();
  const updateTask = useUpdateTaskStatus();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (updateTask.isError) {
      setToast(updateTask.error instanceof Error ? updateTask.error.message : 'Failed to move task.');
      const timer = setTimeout(() => { setToast(null); }, 3000);
      return () => { clearTimeout(timer); };
    }
  }, [updateTask.isError, updateTask.error]);

  const sensors = useSensors(
    // ponytail: separate sensors for mouse and touch — on mobile, a 250ms
    // hold delay lets users scroll freely without accidentally dragging.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id.toString());
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const target = computeDropTarget(
      tasksQuery.data ?? [],
      active.id.toString(),
      over.id.toString(),
    );
    if (!target) return;

    updateTask.mutate({ taskId: active.id.toString(), status: target.status, position: target.position });
  };

  if (tasksQuery.isLoading) return <div className="p-4">Loading tasks...</div>;
  if (tasksQuery.isError) return <div className="p-4 text-red-600">Error loading tasks.</div>;

  const tasks = tasksQuery.data || [];
  const activeTask = tasks.find((t) => t.id === activeId);
  const groupedTasks = {} as Record<TaskStatus, Task[]>;
  for (const col of COLUMNS) {
    groupedTasks[col.status] = sortedColumnTasks(tasks, col.status);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-nowrap overflow-x-auto overflow-y-hidden md:grid md:grid-cols-3 gap-4 pb-2">
        {COLUMNS.map((col) => (
          <DroppableColumn key={col.status} status={col.status} label={col.label}>
            <SortableContext items={groupedTasks[col.status].map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {groupedTasks[col.status].length === 0
                ? <p className="text-gray-500 text-sm">No tasks</p>
                : groupedTasks[col.status].map((task) => <SortableTaskCard key={task.id} task={task} />)}
            </SortableContext>
            <DropSpacer status={col.status} />
          </DroppableColumn>
        ))}
      </div>
      <DragPreview task={activeTask} />
      <ErrorToast message={toast} />
    </DndContext>
  );
}
