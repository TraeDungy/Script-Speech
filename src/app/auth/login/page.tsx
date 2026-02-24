'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const router = useRouter();

  // Check if in demo mode
  const hasSupabaseConfig = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    setDemoMode(!hasSupabaseConfig);
  }, [hasSupabaseConfig]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);

    try {
      if (demoMode) {
        // Demo mode: just store session and redirect
        sessionStorage.setItem('demoUserLoggedIn', 'true');
        localStorage.setItem('demoUserEmail', email);
        router.push('/dashboard');
      } else {
        // Production mode: use Supabase
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        );

        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginError) {
          setError(loginError.message);
          return;
        }

        if (data?.user) {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-black px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo/Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Script-Speech</h1>
          <p className="text-zinc-400">Welcome back</p>
          {demoMode && (
            <p className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-3 py-1 inline-block">
              Demo Mode
            </p>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-200">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg border border-zinc-600 bg-zinc-800/50 text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
              disabled={loading}
            />
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-200">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-zinc-600 bg-zinc-800/50 text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
              disabled={loading}
            />
          </div>

          {/* Remember Me / Forgot Password */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-zinc-600 bg-zinc-800 text-blue-600"
              />
              <span className="text-zinc-400">Remember me</span>
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-blue-400 hover:text-blue-300 transition"
            >
              Forgot password?
            </Link>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-zinc-600 disabled:to-zinc-700 text-white font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : demoMode ? 'Enter Demo' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-zinc-700"></div>
          <span className="text-xs text-zinc-500">or</span>
          <div className="flex-1 h-px bg-zinc-700"></div>
        </div>

        {/* Signup Link */}
        <div className="text-center space-y-2">
          <p className="text-sm text-zinc-400">
            Don't have an account?{' '}
            <Link
              href="/auth/signup"
              className="text-blue-400 hover:text-blue-300 font-semibold transition"
            >
              Create one
            </Link>
          </p>
          <p className="text-xs text-zinc-500">
            <Link
              href="/"
              className="text-zinc-400 hover:text-zinc-300 transition"
            >
              Back to home
            </Link>
          </p>
        </div>

        {/* Demo Info */}
        {demoMode && (
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs space-y-2">
            <p className="font-semibold">🎭 Demo Mode Active</p>
            <p>
              Login with any email to access demo features. No password validation required.
            </p>
            <p className="text-xs text-blue-300/70">
              Try email: demo@example.com
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
