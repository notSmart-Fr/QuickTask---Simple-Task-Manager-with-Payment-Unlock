import { api, type ApiResponse } from '../../lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { Task, TaskStatus } from '../../schemas/task.schema';

export function useTasks(): UseQueryResult<ApiResponse<Task[]>> {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => api.get<Task[]>('/tasks'),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateTask(): UseMutationResult<
  ApiResponse<Task>,
  Error,
  { title: string; description: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => api.post<Task>('/tasks', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask(): UseMutationResult<
  ApiResponse<Task>,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId) => api.delete<Task>(`/tasks/${taskId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTaskStatus(): UseMutationResult<
  ApiResponse<Task>,
  Error,
  { taskId: string; status: TaskStatus }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, status }) => 
      api.patch<Task>(`/tasks/${taskId}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
