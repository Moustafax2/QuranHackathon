"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createPkceChallenge, createRandomString } from "@/lib/qf-user/pkce";

interface LoginPageClientProps {
  errorMessage: string | null;
  nextPath: string;
}

export default function LoginPageClient({
  errorMessage,
  nextPath,
}: LoginPageClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(errorMessage);
  const safeNextPath = useMemo(
    () => (nextPath.startsWith("/") ? nextPath : "/"),
    [nextPath]
  );

  async function handleLogin() {
    setLoading(true);
    setError(null);

    try {
      const state = createRandomString();
      const nonce = createRandomString();
      const codeVerifier = createRandomString(64);
      const codeChallenge = await createPkceChallenge(codeVerifier);

      const response = await fetch("/api/auth/qf/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          nonce,
          code_verifier: codeVerifier,
          code_challenge: codeChallenge,
          redirect_to: safeNextPath,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        authorizationUrl?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.authorizationUrl) {
        throw new Error(payload?.error ?? "Failed to start Quran.com login.");
      }

      window.location.href = payload.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start login.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-xl px-4 py-20">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8 shadow-2xl shadow-black/20">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            QuranArena
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight">
            Sign in with Quran.com
          </h1>
          <p className="mt-4 text-gray-400">
            Use your Quran Foundation account to sync bookmarks and unlock multiplayer identity.
          </p>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={() => void handleLogin()}
            disabled={loading}
            className="mt-8 flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? "Redirecting..." : "Continue with Quran.com"}
          </button>

          <p className="mt-6 text-sm text-gray-500">
            You will be redirected to the official Quran Foundation hosted login page.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block text-sm text-gray-400 hover:text-white"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
