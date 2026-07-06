'use client';

import { useTasks } from './tasks.api';
import { TaskCard } from './task-card';
import type { Task, TaskStatus } from '../../schemas/task.schema';

const columns: { status: TaskStatus; label: string }[] = [
  { status: 'TODO', label: 'To Do' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'DONE', label: 'Done' },
];

export function KanbanBoard() {
  const tasksQuery = useTasks();

  if (tasksQuery.isLoading) {
    return <div className="p-4">Loading tasks...</div>;
  }

  if (tasksQuery.isError) {
    const errMsg = tasksQuery.error instanceof Error
      ? tasksQuery.error.message
      : String(tasksQuery.error);
    return (
      <div className="p-4 text-red-600">
        Error loading tasks: {errMsg}
      </div>
    );
  }

  const tasks = tasksQuery.data || [];

  const groupedTasks = columns.reduce(
    (acc, col) => {
      acc[col.status] = tasks.filter((t) => t.status === col.status);
      return acc;
    },
    {} as Record<TaskStatus, Task[]>,
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {columns.map((col) => (
        <div key={col.status} className="bg-gray-100 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">{col.label}</h3>
          {groupedTasks[col.status].length === 0 ? (
            <p className="text-gray-500 text-sm">No tasks</p>
          ) : (
            groupedTasks[col.status].map((task) => (
              <TaskCard key={task.id} task={task} />
            ))
          )}
        </div>
      ))}
    </div>
  );
}
