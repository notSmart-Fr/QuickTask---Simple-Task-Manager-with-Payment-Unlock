'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { useRouter } from 'next/navigation';
import { AddTaskForm } from '../../features/tasks/add-task-form';
import { KanbanBoard } from '../../features/tasks/kanban-board';
import { useTasks } from '../../features/tasks/tasks.api';
import { UnlockButton } from '../../features/payment/unlock-button';
import { fetchMeEffect } from '../../core/api/auth.effect';
import { Effect, Either } from 'effect';

function FreeTierBanner({ taskCount }: { taskCount: number }) {
  return (
    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
      <p className="text-yellow-800">
        Tasks: {taskCount}/3 used.{' '}
        {taskCount >= 3 && (
          <span className="font-semibold">Upgrade to premium for unlimited tasks!</span>
        )}
      </p>
      <UnlockButton />
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const tasksQuery = useTasks();

  useEffect(() => {
    if (!user && !isLoading) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // Refresh auth state on mount — catches Stripe webhook premium updates
  useEffect(() => {
    if (!user) return;
    void Effect.runPromise(Effect.either(fetchMeEffect())).then((either) => {
      if (Either.isRight(either) && either.right.isPremium !== user.isPremium) {
        refreshUser(either.right);
      }
    });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const taskCount = (tasksQuery.data || []).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">QuickTask Dashboard</h1>
          <div className="flex items-center gap-4">
            <p className="text-gray-700">
              Hello, <span className="font-medium">{user.name}</span>
              {user.isPremium && (
                <span className="ml-2 inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Premium
                </span>
              )}
            </p>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700"
            >
              Log Out
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {!user.isPremium && <FreeTierBanner taskCount={taskCount} />}
        {limitMessage && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">{limitMessage}</p>
            <button
              onClick={() => { setLimitMessage(null); }}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Close
            </button>
          </div>
        )}
        <AddTaskForm onLimitError={setLimitMessage} />
        <KanbanBoard />
      </main>
    </div>
  );
}
