"use client";

import { useBookmarks } from "@/lib/hooks/useBookmarks";
import { useAuth } from "@/lib/hooks/useAuth";
import Link from "next/link";

export default function BookmarksPage() {
  const { bookmarks, removeBookmark, loading, error, provider } = useBookmarks();
  const { isAuthenticated, loading: authLoading } = useAuth();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Bookmarks
      </h1>

      {authLoading || loading ? (
        <div className="rounded-lg border border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Loading bookmarks...
        </div>
      ) : (
        <>
          {!authLoading && !isAuthenticated && (
            <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              You are viewing local-only bookmarks. Sign in to use Quran Foundation bookmark sync.
              <Link href="/login?next=/quran/bookmarks" className="ml-2 underline">
                Sign in
              </Link>
            </div>
          )}

          {!authLoading && isAuthenticated && (
            <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              Synced bookmark source: {provider === "qf" ? "Quran Foundation" : "Local"}.
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {bookmarks.length === 0 ? (
            <div className="rounded-lg border border-gray-200 p-8 text-center dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">
                No bookmarks yet. Bookmark verses while reading to save them here.
              </p>
              <Link
                href="/quran"
                className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Browse Surahs
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.verseKey}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <Link
                    href={`/quran/surah/${bookmark.chapterId}`}
                    className="flex items-center gap-3 hover:text-emerald-600"
                  >
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {bookmark.verseKey}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Surah {bookmark.chapterId}, Verse {bookmark.verseNumber}
                    </span>
                  </Link>
                  <button
                    onClick={() => void removeBookmark(bookmark.verseKey)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
