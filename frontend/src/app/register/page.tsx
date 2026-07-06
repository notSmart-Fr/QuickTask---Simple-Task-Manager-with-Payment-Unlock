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
              id="reg-name" name="name" type="text" autoComplete="off" value={name}
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-sm"
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
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
