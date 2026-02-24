'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const router = useRouter();

  // Check if in demo mode
  const hasSupabaseConfig = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  React.useEffect(() => {
    setDemoMode(!hasSupabaseConfig);
  }, [hasSupabaseConfig]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      if (demoMode) {
        // Demo mode: just store locally and redirect
        localStorage.setItem('demoUser', JSON.stringify({
          email,
          createdAt: new Date().toISOString(),
        }));
        sessionStorage.setItem('demoUserLoggedIn', 'true');
        router.push('/dashboard');
      } else {
        // Production mode: use Supabase
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        );

        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signupError) {
          setError(signupError.message);
          return;
        }

        if (data?.user) {
          // Account created, redirect to confirmation
          router.push('/auth/confirm?email=' + encodeURIComponent(email));
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
          <p className="text-zinc-400">Create your account</p>
          {demoMode && (
            <p className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-3 py-1 inline-block">
              Demo Mode - No account needed
            </p>
          )}
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-6">
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
            <p className="text-xs text-zinc-400">At least 6 characters</p>
          </div>

          {/* Confirm Password Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-200">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-zinc-600 bg-zinc-800/50 text-white placeholder-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition"
              disabled={loading}
            />
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
            {loading ? 'Creating account...' : demoMode ? 'Enter Demo' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-zinc-700"></div>
          <span className="text-xs text-zinc-500">or</span>
          <div className="flex-1 h-px bg-zinc-700"></div>
        </div>

        {/* Login Link */}
        <div className="text-center space-y-2">
          <p className="text-sm text-zinc-400">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="text-blue-400 hover:text-blue-300 font-semibold transition"
            >
              Sign in
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
              You're in demo mode. No Supabase credentials configured. You can explore all features without authentication.
            </p>
            <p className="text-xs text-blue-300/70">
              When you're ready to deploy, provide Supabase credentials for full authentication.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
