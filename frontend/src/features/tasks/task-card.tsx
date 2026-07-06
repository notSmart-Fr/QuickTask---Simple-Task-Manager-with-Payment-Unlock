'use client';

import type { Task, TaskStatus } from '../../schemas/task.schema';
import { useDeleteTask, useUpdateTaskStatus } from './tasks.api';
import { useState, useId } from 'react';

interface TaskCardProps {
  task: Task;
  variant?: 'default' | 'overlay';
}

const statusLabels: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  return `${String(Math.floor(hours / 24))}d ago`;
}

export function TaskCard({ task, variant = 'default' }: TaskCardProps) {
  const deleteTask = useDeleteTask();
  const updateStatus = useUpdateTaskStatus();
  const [isDeleting, setIsDeleting] = useState(false);
  const uid = useId();

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
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-gray-900">{task.title}</h3>
        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{timeAgo(task.createdAt)}</span>
      </div>
      {task.description && (
        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
      )}
      <div className="flex items-center justify-between gap-2">
        {variant === 'default' && (
          <>
            <div>
              <label htmlFor={`task-status-${uid}`} className="sr-only">Status</label>
              <select
                id={`task-status-${uid}`}
                name="status"
                value={task.status}
                onPointerDown={(e) => { e.stopPropagation(); }}
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
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); }}
              onClick={() => { void handleDelete(); }}
              disabled={isDeleting || deleteTask.isPending}
              className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
