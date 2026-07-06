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
    onMutate: async ({ taskId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks"]);

      // Optimistically update status only — let server refetch handle exact position
      queryClient.setQueryData<Task[]>(["tasks"], (oldTasks) => {
        if (!oldTasks) return [];
        return oldTasks.map((t) =>
          t.id === taskId ? { ...t, status } : t,
        );
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
