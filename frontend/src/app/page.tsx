import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl w-full text-center p-8">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">QuickTask</h1>
        <p className="text-xl text-gray-600 mb-8">
          Simple personal task management. Unlock unlimited tasks for $5 one-time.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="px-8 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
