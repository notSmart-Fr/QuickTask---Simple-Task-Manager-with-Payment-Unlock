'use client';

import { useState } from 'react';
import { PasswordToggleIcon } from './password-toggle-icon';

interface PasswordInputProps {
  id: string;
  name?: string;
  autoComplete?: string;
  minLength?: number;
  value: string;
  onChange: (value: string) => void;
}

export function PasswordInput({ id, name, autoComplete, minLength, value, onChange }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">Password</label>
      <div className="relative">
        <input
          id={id} name={name} type={showPassword ? 'text' : 'password'} autoComplete={autoComplete}
          minLength={minLength} value={value} onChange={(e) => { onChange(e.target.value); }} required
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
          <PasswordToggleIcon visible={showPassword} />
        </button>
      </div>
    </div>
  );
}
