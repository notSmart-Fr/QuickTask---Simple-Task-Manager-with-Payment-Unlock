'use client';

import React, { useState } from 'react';
import { useRegister } from '../../features/auth/auth.api';
import { useAuth } from '../../lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RegisterInputSchema } from '../../schemas/auth.schema';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const registerMutation = useRegister();
  const { login: authLogin } = useAuth();
  const router = useRouter();

  const clearErrors = () => {
    setValidationError(null);
    registerMutation.reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    registerMutation.reset();
    const parsed = RegisterInputSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setValidationError(firstIssue.message);
      return;
    }
    registerMutation.mutate(parsed.data, {
      onSuccess: (data) => {
        authLogin(data.user, data.token);
        router.push('/dashboard');
      },
    });
  };

  const serverError = registerMutation.error?.message;
  const errorMessage = serverError ?? validationError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Create a QuickTask Account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              id="reg-name" name="name" type="text" autoComplete="name" value={name}
              onChange={(e) => { setName(e.target.value); clearErrors(); }} required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="reg-email" name="email" type="email" autoComplete="email" value={email}
              onChange={(e) => { setEmail(e.target.value); clearErrors(); }} required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                id="reg-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8}
                value={password} onChange={(e) => { setPassword(e.target.value); clearErrors(); }} required
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => { setShowPassword((v) => !v); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                tabIndex={-1}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}
          <button
            type="submit" disabled={registerMutation.isPending}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {registerMutation.isPending ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="text-center mt-4 text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Log In</Link>
        </p>
      </div>
    </div>
  );
}
