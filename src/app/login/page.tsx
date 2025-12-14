"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/auth/client";

type AuthMode = "magic-link" | "password";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("magic-link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase client not available");
      }

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signInError) {
        throw signInError;
      }

      setSuccess("Check your email for the magic link to sign in!");
    } catch (err: any) {
      console.error("Magic link error:", err);
      setError(err.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase client not available");
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.session) {
        // Set cookies for server-side auth
        await fetch("/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          }),
        });

        // Redirect to studio
        router.push("/studio");
        router.refresh();
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = mode === "magic-link" ? handleMagicLink : handlePasswordLogin;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Script Speech</h1>
          <p className="mt-2 text-sm text-zinc-400">Sign in to your account</p>
        </div>

        {/* Mode Toggle */}
        <div className="mb-6 flex gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setMode("magic-link")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "magic-link"
                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Magic Link
          </button>
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === "password"
                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Password
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
              {success}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          {mode === "password" && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? mode === "magic-link"
                ? "Sending link..."
                : "Signing in..."
              : mode === "magic-link"
                ? "Send Magic Link"
                : "Sign In"}
          </button>

          {mode === "magic-link" && (
            <p className="text-xs text-zinc-500 text-center">
              We'll send you an email with a link to sign in. No password needed!
            </p>
          )}
        </form>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-zinc-400 hover:text-white">
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
