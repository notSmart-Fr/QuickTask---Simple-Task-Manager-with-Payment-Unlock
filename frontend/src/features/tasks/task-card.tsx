'use client';

import type { Task, TaskStatus } from '../../schemas/task.schema';
import { useDeleteTask, useUpdateTaskStatus } from './tasks.api';
import { useState } from 'react';

interface TaskCardProps {
  task: Task;
}

const statusLabels: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

export function TaskCard({ task }: TaskCardProps) {
  const deleteTask = useDeleteTask();
  const updateStatus = useUpdateTaskStatus();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (newStatus === task.status) return;
    await updateStatus.mutateAsync({ taskId: task.id, status: newStatus });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTask.mutateAsync(task.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-3">
      <h3 className="font-semibold text-gray-900 mb-2">{task.title}</h3>
      {task.description && (
        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div>
          <label htmlFor={`task-status-${task.id}`} className="sr-only">Status</label>
          <select
            id={`task-status-${task.id}`}
            name="status"
            value={task.status}
            onChange={(e) => { void handleStatusChange(e.target.value as TaskStatus); }}
            className="text-sm border rounded px-2 py-1"
            disabled={updateStatus.isPending}
          >
          <option value="TODO">{statusLabels.TODO}</option>
          <option value="IN_PROGRESS">{statusLabels.IN_PROGRESS}</option>
          <option value="DONE">{statusLabels.DONE}</option>
        </select>
        </div>
        <button
          onClick={() => { void handleDelete(); }}
          disabled={isDeleting || deleteTask.isPending}
          className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
