import { Effect } from "effect";
import { HttpError, NetworkError } from "../errors";
import { effectApi } from "../../lib/effect-client";
import type { Task, TaskStatus } from "../../schemas/task.schema";

export function fetchTasksEffect(): Effect.Effect<
  Task[],
  HttpError | NetworkError
> {
  return effectApi.get<Task[]>("/tasks");
}

export function createTaskEffect(
  title: string,
  description: string,
): Effect.Effect<Task, HttpError | NetworkError> {
  return effectApi.post<Task>("/tasks", { title, description });
}

export function deleteTaskEffect(
  taskId: string,
): Effect.Effect<Task, HttpError | NetworkError> {
  return effectApi.delete<Task>(`/tasks/${taskId}`);
}

export function updateTaskStatusEffect(
  taskId: string,
  status: TaskStatus,
  position?: number,
): Effect.Effect<Task, HttpError | NetworkError> {
  const body: { status: TaskStatus; position?: number } = { status };
  if (position !== undefined) {
    body.position = position;
  }
  return effectApi.patch<Task>(`/tasks/${taskId}/status`, body);
}
