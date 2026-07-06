import { Effect, Either } from "effect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import type { Task, TaskStatus } from "../../schemas/task.schema";
import type { HttpError, NetworkError } from "../../core/errors";
import {
  fetchTasksEffect,
  createTaskEffect,
  deleteTaskEffect,
  updateTaskStatusEffect,
} from "../../core/api/task.effect";

type TaskError = HttpError | NetworkError;

function runEffect<T>(program: Effect.Effect<T, TaskError>): Promise<T> {
  return Effect.runPromise(
    Effect.either(program),
  ).then((either) => {
    if (Either.isLeft(either)) {
      throw either.left;
    }
    return either.right;
  });
}

export function useTasks(): UseQueryResult<Task[], TaskError> {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => runEffect(fetchTasksEffect()),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateTask(): UseMutationResult<
  Task,
  TaskError,
  { title: string; description: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) =>
      runEffect(createTaskEffect(data.title, data.description)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTask(): UseMutationResult<Task, TaskError, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId) => runEffect(deleteTaskEffect(taskId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTaskStatus(): UseMutationResult<
  Task,
  TaskError,
  { taskId: string; status: TaskStatus; position?: number }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, status, position }) =>
      runEffect(updateTaskStatusEffect(taskId, status, position)),
    onMutate: async ({ taskId, status, position }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks"]);

      // Optimistically update status and position
      queryClient.setQueryData<Task[]>(["tasks"], (oldTasks) => {
        if (!oldTasks) return [];
        const updated = oldTasks.map((t) =>
          t.id === taskId ? { ...t, status, position: position ?? t.position } : t,
        );
        // Re-sort by status then position for immediate visual correctness
        const order: Record<string, number> = { TODO: 0, IN_PROGRESS: 1, DONE: 2 };
        updated.sort((a, b) => {
          const sa = order[a.status] ?? 0;
          const sb = order[b.status] ?? 0;
          if (sa !== sb) return sa - sb;
          return a.position - b.position;
        });
        return updated;
      });

      // Return a context object with the snapshotted value
      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
