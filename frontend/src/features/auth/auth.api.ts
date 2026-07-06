import { api, type ApiResponse } from '../../lib/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

export interface User {
  id: string;
  name: string;
  email: string;
  isPremium: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export function useRegister(): UseMutationResult<
  ApiResponse<AuthResponse>,
  Error,
  { name: string; email: string; password: string }
> {
  return useMutation({
    mutationFn: async (data) => api.post<AuthResponse>('/auth/register', data),
  });
}

export function useLogin(): UseMutationResult<
  ApiResponse<AuthResponse>,
  Error,
  { email: string; password: string }
> {
  return useMutation({
    mutationFn: async (data) => api.post<AuthResponse>('/auth/login', data),
  });
}

export function useMe(): UseQueryResult<ApiResponse<User>> {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => api.get<User>('/auth/me'),
    retry: false,
    refetchOnWindowFocus: false,
  });
}
