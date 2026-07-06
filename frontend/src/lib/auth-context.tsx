'use client';

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { z } from 'zod';
import type { User } from '../features/auth/auth.api';
import { NameSchema, EmailSchema } from '../schemas/index';

const UserSchema = z.object({
  id: z.string(),
  name: NameSchema,
  email: EmailSchema,
  isPremium: z.boolean(),
});

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  refreshUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ponytail: Initialize state synchronously from localStorage so AuthProvider has
  // the user immediately on mount — no async useEffect race with router.push.
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const storedUser = localStorage.getItem(USER_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedUser || !storedToken) return null;
    const result = UserSchema.safeParse(JSON.parse(storedUser));
    return result.success ? result.data : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Finish loading once the effect runs (marks hydration complete)
  useEffect(() => {
    setIsLoading(false);
  }, []);

  const login = useCallback((newUser: User, token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback((updatedUser: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
