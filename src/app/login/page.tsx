'use client';

import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-12">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-2 text-center">
          <h1 className="text-3xl font-bold text-gray-800">
            OptiCell
          </h1>
          <p className="mt-2 text-gray-600 text-sm">Welcome back! Sign in to continue</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded text-center text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pt-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none pr-12"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
              <span className="text-gray-600">Remember me</span>
            </label>
            <a href="#" className="text-blue-600 hover:text-blue-700">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-300 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Google Button */}
        <div className="px-8 pb-6">
          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 py-3 rounded font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <img
              src="https://tse2.mm.bing.net/th/id/OIP.l_99OX5tPaQVrmvw32McRQHaHa?rs=1&pid=ImgDetMain&o=7&rm=3"
              alt="Google"
              className="w-6 h-6"
            />
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Footer link */}
        <div className="px-8 py-6 text-center text-sm text-gray-600 border-t border-gray-100 bg-gray-50">
          Don't have an account?{' '}
          <Link
            href="/signup"
            className="text-blue-600 font-medium hover:text-blue-700 hover:underline"
          >
            Create one now
          </Link>
        </div>
      </div>
    </div>
  );
}