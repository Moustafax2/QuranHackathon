"use client";

import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useBookmarks } from "@/lib/hooks/useBookmarks";

export default function AccountPage() {
  const { user, player, isAuthenticated, loading, logout } = useAuth();
  const { provider, bookmarks, loading: bookmarksLoading } = useBookmarks();

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-white">
        <p className="text-gray-400">Loading account...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user || !player) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-white">
        <h1 className="text-3xl font-bold">Account</h1>
        <p className="mt-3 text-gray-400">You need to sign in to view your account.</p>
        <Link
          href="/login?next=/account"
          className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-white">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Account</h1>
          <p className="mt-2 text-gray-400">Your Quran Foundation identity and local QuranArena profile.</p>
        </div>
        <button
          onClick={() => void logout()}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-500 hover:text-white"
        >
          Logout
        </button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="text-lg font-semibold">Quran Foundation</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Name</dt>
              <dd className="text-right text-white">{user.name ?? "Unavailable"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Email</dt>
              <dd className="text-right text-white">{user.email ?? "Unavailable"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Subject ID</dt>
              <dd className="truncate font-mono text-xs text-gray-300">{user.sub}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="text-lg font-semibold">QuranArena Player</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Display name</dt>
              <dd className="text-right text-white">{player.display_name}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Points</dt>
              <dd className="text-right text-white">{player.total_points}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-400">Wins</dt>
              <dd className="text-right text-white">{player.total_wins}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-lg font-semibold">Bookmark Sync</h2>
        <p className="mt-2 text-sm text-gray-400">
          Provider: <span className="text-white">{provider === "qf" ? "Quran Foundation" : "Local"}</span>
        </p>
        <p className="mt-1 text-sm text-gray-400">
          {bookmarksLoading ? "Loading bookmarks..." : `${bookmarks.length} bookmarks available.`}
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Global Progress</h2>
            <p className="mt-2 text-sm text-gray-400">
              Review your play results, flashcard momentum, memorization trends, and Quran coverage from
              one reflection-focused dashboard.
            </p>
          </div>
          <Link
            href="/progress"
            className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Open progress
          </Link>
        </div>
      </section>
    </div>
  );
}
