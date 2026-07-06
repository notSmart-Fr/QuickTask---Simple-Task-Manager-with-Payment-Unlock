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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser =
      typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
    const storedToken =
      typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

    if (storedUser && storedToken) {
      const result = UserSchema.safeParse(JSON.parse(storedUser));
      if (result.success) {
        setUser(result.data);
      }
    }
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

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
