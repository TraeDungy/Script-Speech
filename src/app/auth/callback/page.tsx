"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient, syncSessionCookie } from "@/lib/auth/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("Verifying your session…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase authentication is not configured.");
      setStatus("Unable to complete sign-in");
      return;
    }

    let cancelled = false;

    async function exchangeSession() {
      try {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href,
        );
        if (cancelled) {
          return;
        }

        if (exchangeError) {
          setError(exchangeError.message ?? "Unable to verify session");
          setStatus("Verification failed");
          return;
        }

        await syncSessionCookie(data.session ?? null);
        setStatus("Session established. Redirecting to the studio…");
        setTimeout(() => {
          router.replace("/studio");
        }, 1200);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to verify session");
        setStatus("Verification failed");
      }
    }

    void exchangeSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center text-white">
      <div className="max-w-md space-y-3">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">Auth callback</p>
        <h1 className="text-2xl font-semibold text-white">{status}</h1>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {!error ? (
          <p className="text-sm text-zinc-400">
            You’ll be routed back to the studio the moment we finish negotiating your credentials.
          </p>
        ) : (
          <p className="text-sm text-zinc-400">
            Use the session controls to retry or head back to the marketing site.
          </p>
        )}
      </div>
      <Link
        href="/"
        className="rounded-full border border-white/20 px-6 py-2 text-sm font-semibold text-white transition hover:border-white/40"
      >
        Return home
      </Link>
    </main>
  );
}
