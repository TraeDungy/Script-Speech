"use client";

import React from "react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import {
  getSupabaseBrowserClient,
  isBrowserSupabaseConfigured,
  syncSessionCookie,
} from "@/lib/auth/client";

function formatUserLabel(session: Session): string {
  return (
    session.user.email ||
    (typeof session.user.user_metadata?.full_name === "string"
      ? session.user.user_metadata.full_name
      : null) ||
    session.user.id
  );
}

export function SessionControls() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const supabaseEnabled = isBrowserSupabaseConfigured();

  useEffect(() => {
    if (!supabaseEnabled || !supabase) {
      setIsReady(true);
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) {
        return;
      }
      setSession(data?.session ?? null);
      setIsReady(true);
      await syncSessionCookie(data?.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void syncSessionCookie(nextSession);
      if (!nextSession) {
        router.push("/");
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router, supabase, supabaseEnabled]);

  const handleMagicLink = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!supabase) {
        return;
      }
      setIsSubmitting(true);
      setError(null);
      setStatusMessage(null);

      try {
        const emailValue = email.trim();
        if (!emailValue) {
          setError("Enter your email address to receive a link.");
          return;
        }

        const redirectTo = `${window.location.origin}/auth/callback`;
        const { error: authError } = await supabase.auth.signInWithOtp({
          email: emailValue,
          options: { emailRedirectTo: redirectTo },
        });

        if (authError) {
          setError(authError.message ?? "Unable to send magic link");
          return;
        }

        setStatusMessage("Check your inbox for the magic link.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to send magic link");
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, supabase],
  );

  const handleOAuth = useCallback(
    async (provider: "google" | "github") => {
      if (!supabase) {
        return;
      }
      setError(null);
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });

      if (authError) {
        setError(authError.message ?? "Unable to start OAuth flow");
      }
    },
    [supabase],
  );

  const handleSignOut = useCallback(async () => {
    if (!supabase) {
      await syncSessionCookie(null);
      router.push("/");
      return;
    }

    try {
      await supabase.auth.signOut();
      await syncSessionCookie(null);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log out");
    }
  }, [router, supabase]);

  if (!supabaseEnabled) {
    return null;
  }

  return (
    <div className="pointer-events-auto fixed right-5 top-5 z-50 max-w-sm text-sm">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 text-white shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Session</p>
            <p className="text-base font-semibold text-white">
              {session ? "Active" : isReady ? "Offline" : "Checking"}
            </p>
          </div>
          <Link
            href={session ? "/studio" : "/"}
            className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white transition hover:border-white/50"
          >
            {session ? "Studio" : "Home"}
          </Link>
        </div>

        {session ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-zinc-300">
              Signed in as <span className="font-medium text-white">{formatUserLabel(session)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/studio")}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                Resume session
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-white/40"
              >
                Log out
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={handleMagicLink}>
            <label className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-400">
              Magic link
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none"
              placeholder="name@studio.com"
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full border border-white/20 bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-900 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Sending…" : "Email me access"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                className="flex-1 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:border-white/40"
              >
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => handleOAuth("github")}
                className="flex-1 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:border-white/40"
              >
                GitHub
              </button>
            </div>
          </form>
        )}

        {statusMessage ? (
          <p className="mt-3 text-xs text-emerald-300">{statusMessage}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-xs text-rose-300">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
