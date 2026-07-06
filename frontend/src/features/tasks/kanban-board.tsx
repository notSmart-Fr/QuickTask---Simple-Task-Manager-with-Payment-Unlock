'use client';

import { useTasks, useUpdateTaskStatus } from './tasks.api';
import { SortableTaskCard } from './sortable-task-card';
import { TaskCard } from './task-card';
import type { Task, TaskStatus } from '../../schemas/task.schema';
import {
  DndContext,
  closestCenter,
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

function DroppableColumn({ status, label, children }: { status: TaskStatus; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`bg-gray-100 rounded-lg p-4 transition-colors ${isOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}>
      <h3 className="font-semibold text-gray-800 mb-3">{label}</h3>
      {children}
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

const columns: { status: TaskStatus; label: string }[] = [
  { status: 'TODO', label: 'To Do' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'DONE', label: 'Done' },
];

function findDropTarget(tasks: Task[], overId: string): { status: TaskStatus; index: number } | null {
  // ponytail: O(n²) scan for <50 tasks per column, fine
  if (columns.some((col) => col.status === overId)) {
    const status = overId as TaskStatus;
    return { status, index: tasks.filter((t) => t.status === status).length };
  }
  const overTask = tasks.find((t) => t.id === overId);
  if (!overTask) return null;
  const columnTasks = tasks.filter((t) => t.status === overTask.status);
  return { status: overTask.status, index: columnTasks.findIndex((t) => t.id === overId) };
}

export function KanbanBoard() {
  const tasksQuery = useTasks();
  const updateTask = useUpdateTaskStatus();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (updateTask.isError) {
      setToast(updateTask.error instanceof Error ? updateTask.error.message : 'Failed to move task. Please try again.');
      const timer = setTimeout(() => { setToast(null); }, 3000);
      return () => { clearTimeout(timer); };
    }
  }, [updateTask.isError, updateTask.error]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const activeTask = tasksQuery.data?.find((t) => t.id === active.id);
    if (!activeTask) return;
    const target = findDropTarget(tasksQuery.data ?? [], over.id.toString());
    if (!target) return;
    if (target.status === activeTask.status && target.index === activeTask.position) return;
    updateTask.mutate({ taskId: activeTask.id, status: target.status, position: target.index });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id.toString());
  };

  if (tasksQuery.isLoading) return <div className="p-4">Loading tasks...</div>;
  if (tasksQuery.isError) {
    return <div className="p-4 text-red-600">Error loading tasks: {tasksQuery.error instanceof Error ? tasksQuery.error.message : String(tasksQuery.error)}</div>;
  }

  const tasks = tasksQuery.data || [];
  const activeTask = tasks.find((t) => t.id === activeId);
  const groupedTasks = columns.reduce((acc, col) => {
    acc[col.status] = tasks.filter((t) => t.status === col.status).sort((a, b) => a.position - b.position);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => (
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
