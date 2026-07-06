'use client';

import { useState } from 'react';
import { useCreateTask } from './tasks.api';
import { CreateTaskInputSchema } from '../../schemas/task.schema';

interface AddTaskFormProps {
  onLimitError?: (message: string) => void;
}

function handleTaskError(
  err: unknown,
  onLimitError: ((message: string) => void) | undefined,
  setError: (message: string) => void,
): void {
  const msg =
    err instanceof Error ? err.message : "An unexpected error occurred";
  const isApiError =
    typeof err === "object" &&
    err !== null &&
    "_tag" in err &&
    (err as { _tag: string })._tag === "HttpError";
  if (isApiError) {
    onLimitError?.(msg);
  } else {
    setError(msg);
  }
}

export function AddTaskForm({ onLimitError }: AddTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createTask = useCreateTask();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validated = CreateTaskInputSchema.safeParse({ title, description });
    if (!validated.success) {
      setError("Invalid task data");
      return;
    }
    try {
      await createTask.mutateAsync(validated.data);
      setTitle("");
      setDescription("");
    } catch (err: unknown) {
      handleTaskError(err, onLimitError, setError);
    }
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="mb-6 p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-3">Add New Task</h3>
      {error && (
        <div className="mb-3 p-2 bg-red-100 text-red-700 rounded">{error}</div>
      )}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); }}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Enter task title"
          disabled={createTask.isPending}
        />
      </div>
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); }}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Enter task description"
          rows={3}
          disabled={createTask.isPending}
        />
      </div>
      <button
        type="submit"
        disabled={createTask.isPending}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {createTask.isPending ? 'Adding...' : 'Add Task'}
      </button>
    </form>
  );
}
