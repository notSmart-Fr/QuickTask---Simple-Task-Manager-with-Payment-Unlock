'use client';

import { useTasks, useUpdateTaskStatus } from './tasks.api';
import { SortableTaskCard } from './sortable-task-card';
import { TaskCard } from './task-card';
import type { Task, TaskStatus } from '../../schemas/task.schema';
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
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

// ── Sub-components ──

function DroppableColumn({ status, label, children }: { status: TaskStatus; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`bg-gray-100 rounded-lg p-4 transition-colors ${isOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}>
      <h3 className="font-semibold text-gray-800 mb-3">{label}</h3>
      {children}
      {isOver && (
        <div className="h-16 border-2 border-dashed border-blue-400 rounded-lg bg-blue-50 flex items-center justify-center">
          <p className="text-blue-500 text-sm">Drop here</p>
        </div>
      )}
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

// ── Cursor midpoint drop calculation ──
//
// Production-grade logic: use pointerWithin collision detection + 50% vertical
// threshold on the target card. Pointer above midpoint → insert before.
// Pointer below midpoint → insert after. Matches Trello/Jira/Linear feel.

function calcDropPosition(
  tasks: Task[],
  activeTask: Task,
  overId: string,
  overRect: { top: number; height: number },
  pointerY: number,
): { status: TaskStatus; position: number } | null {
  // Drop on a column → pointer in top half = position 0, bottom half = append
  if (COLUMNS.some((c) => c.status === overId)) {
    const columnTasks = tasks.filter((t) => t.status === overId);
    const pos = columnTasks.length === 0 ? 0 : pointerY < overRect.top + overRect.height / 2 ? 0 : columnTasks.length;
    return { status: overId as TaskStatus, position: pos };
  }

  // Drop on a task card → 50% threshold determines insert-before or insert-after
  const overTask = tasks.find((t) => t.id === overId);
  if (!overTask || overTask.id === activeTask.id) return null;
  const targetPos = pointerY > overRect.top + overRect.height / 2 ? overTask.position + 1 : overTask.position;
  return { status: overTask.status, position: targetPos };
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
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id.toString());
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over, delta, activatorEvent } = event;
    if (!over) return;
    const tasks = tasksQuery.data ?? [];
    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;
    const pointerY = (activatorEvent as PointerEvent).clientY + delta.y;
    const target = calcDropPosition(tasks, activeTask, over.id.toString(), over.rect, pointerY);
    if (!target || (activeTask.status === target.status && activeTask.position === target.position)) return;
    updateTask.mutate({ taskId: activeTask.id, status: target.status, position: target.position });
  };

  if (tasksQuery.isLoading) return <div className="p-4">Loading tasks...</div>;
  if (tasksQuery.isError) return <div className="p-4 text-red-600">Error loading tasks.</div>;

  const tasks = tasksQuery.data || [];
  const activeTask = tasks.find((t) => t.id === activeId);
  const groupedTasks = {} as Record<TaskStatus, Task[]>;
  for (const col of COLUMNS) groupedTasks[col.status] = tasks.filter((t) => t.status === col.status).sort((a, b) => a.position - b.position);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => (
          <DroppableColumn key={col.status} status={col.status} label={col.label}>
            <SortableContext items={groupedTasks[col.status].map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {groupedTasks[col.status].length === 0
                ? <p className="text-gray-500 text-sm">No tasks</p>
                : groupedTasks[col.status].map((task) => <SortableTaskCard key={task.id} task={task} />)}
            </SortableContext>
          </DroppableColumn>
        ))}
      </div>
      <DragPreview task={activeTask} />
      <ErrorToast message={toast} />
    </DndContext>
  );
}
