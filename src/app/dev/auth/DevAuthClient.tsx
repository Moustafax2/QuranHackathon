"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DevPlayer {
  id: string;
  quran_foundation_uid: string | null;
  display_name: string;
  qf_email?: string | null;
  created_at: string;
}

export default function DevAuthClient({ players }: { players: DevPlayer[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loginAs(playerId: string) {
    setLoadingId(playerId);
    setError(null);

    try {
      const response = await fetch("/api/auth/qf/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to create dev session.");
      }

      router.push("/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create dev session.");
      setLoadingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 text-white">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
          Dev Only
        </p>
        <h1 className="mt-3 text-3xl font-bold">Auth Session Bootstrap</h1>
        <p className="mt-2 text-gray-400">
          Pick an existing linked player to mint a local auth session without repeating the Quran Foundation OAuth flow.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {players.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-sm text-gray-400">
          No linked players found yet. Sign in once through the real OAuth flow first.
        </div>
      ) : (
        <div className="space-y-4">
          {players.map((player) => (
            <div
              key={player.id}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-white">{player.display_name}</p>
                  <p className="mt-1 text-sm text-gray-400">
                    {player.qf_email || "No email stored"}
                  </p>
                  <p className="mt-2 truncate font-mono text-xs text-gray-500">
                    player_id: {player.id}
                  </p>
                  <p className="truncate font-mono text-xs text-gray-500">
                    qf_sub: {player.quran_foundation_uid || "Not linked"}
                  </p>
                </div>

                <button
                  onClick={() => void loginAs(player.id)}
                  disabled={loadingId === player.id}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                >
                  {loadingId === player.id ? "Signing in..." : "Login as this user"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
