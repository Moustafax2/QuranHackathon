"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Verse } from "@/lib/types";
import { useVersePlayer } from "@/contexts/VersePlayerContext";
import { MushafPlayButton } from "@/components/quran/verse-player/MushafPlayButton";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { useBookmarks } from "@/lib/hooks/useBookmarks";

function mushafPageUrl(page: number): string {
  return `https://files.quran.app/hafs/madani/width_1260/page${String(page).padStart(3, "0")}.png`;
}

interface Props {
  pageNumbers: number[];
  verses: Verse[];
  initialVerseKey?: string | null;
}

function getInitialPageIndex(
  pageNumbers: number[],
  verses: Verse[],
  initialVerseKey?: string | null
) {
  if (!initialVerseKey) return 0;

  const targetVerse = verses.find((verse) => verse.verse_key === initialVerseKey);
  if (!targetVerse) return 0;

  const pageIndex = pageNumbers.indexOf(targetVerse.page_number);
  return pageIndex === -1 ? 0 : pageIndex;
}

export function MushafView({ pageNumbers, verses, initialVerseKey = null }: Props) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    getInitialPageIndex(pageNumbers, verses, initialVerseKey)
  );
  const [imageLoaded, setImageLoaded] = useState(false);

  const { currentVerseKey, isPlaying, skipBack, skipForward } = useVersePlayer();
  const {
    bookmarks,
    isBookmarked,
    addBookmark,
    removeBookmark,
    provider,
    loading: bookmarksLoading,
    error: bookmarksError,
  } = useBookmarks();

  const currentPage = pageNumbers[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < pageNumbers.length - 1;
  const targetVerse = initialVerseKey
    ? verses.find((verse) => verse.verse_key === initialVerseKey) ?? null
    : null;

  const versesOnCurrentPage = verses.filter((v) => v.page_number === currentPage);
  const bookmarkedOnCurrentPage = versesOnCurrentPage.filter((verse) =>
    isBookmarked(verse.verse_key)
  );

  function goTo(index: number) {
    setCurrentIndex(index);
    setImageLoaded(false);
  }

  useEffect(() => {
    const initialPageIndex = getInitialPageIndex(pageNumbers, verses, initialVerseKey);
    if (initialPageIndex !== currentIndex) {
      goTo(initialPageIndex);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVerseKey]);

  // Auto-flip page when playing verse is on a different page
  useEffect(() => {
    if (!currentVerseKey || !isPlaying) return;
    const verse = verses.find((v) => v.verse_key === currentVerseKey);
    if (!verse) return;
    const pageIdx = pageNumbers.indexOf(verse.page_number);
    if (pageIdx !== -1 && pageIdx !== currentIndex) {
      goTo(pageIdx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVerseKey, isPlaying]);

  return (
    <div className="space-y-4">
      {/* Navigation bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => goTo(currentIndex + 1)}
          disabled={!hasNext}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          Page {hasNext ? pageNumbers[currentIndex + 1] : ""}
        </button>

        {/* Center: page info + play button */}
        <div className="flex items-center gap-2">
          <MushafPlayButton versesOnPage={versesOnCurrentPage} />
          <span className="text-sm font-medium text-gray-400">
            Page {currentPage}{" "}
            <span className="text-gray-600">
              ({currentIndex + 1} / {pageNumbers.length})
            </span>
          </span>
        </div>

        <button
          onClick={() => goTo(currentIndex - 1)}
          disabled={!hasPrev}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Page {hasPrev ? pageNumbers[currentIndex - 1] : ""}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Skip ayah buttons — only visible during playback */}
      {isPlaying && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={skipBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-emerald-700 hover:text-emerald-400"
            aria-label="Previous ayah"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M7.712 4.819A1.5 1.5 0 0 1 10 6.095v2.973c.104-.131.234-.248.389-.344l6.323-3.906A1.5 1.5 0 0 1 19 6.095v7.81a1.5 1.5 0 0 1-2.288 1.277l-6.323-3.906a1.505 1.505 0 0 1-.389-.344v2.973a1.5 1.5 0 0 1-2.288 1.277l-6.323-3.906a1.5 1.5 0 0 1 0-2.554L7.712 4.82Z" />
            </svg>
            Prev ayah
          </button>

          <span className="text-xs text-gray-600">
            {currentVerseKey ? `Ayah ${currentVerseKey.split(":")[1]}` : ""}
          </span>

          <button
            onClick={skipForward}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-emerald-700 hover:text-emerald-400"
            aria-label="Next ayah"
          >
            Next ayah
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M3 17a1.5 1.5 0 0 1-1.5-1.735l.365-2.528A1.5 1.5 0 0 1 3.353 11.5H9.5V9.095a1.5 1.5 0 0 1 2.288-1.277l6.323 3.906a1.5 1.5 0 0 1 0 2.554l-6.323 3.906A1.5 1.5 0 0 1 9.5 16.905V14.5H3.353A1.5 1.5 0 0 1 3 17Z" />
            </svg>
          </button>
        </div>
      )}

      {targetVerse && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-300">
            Viewing {targetVerse.verse_key}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Ayah {targetVerse.verse_number} is on mushaf page {targetVerse.page_number}.
          </p>
        </div>
      )}

      {/* Mushaf image */}
      <div className="overflow-hidden rounded-lg bg-black">
        {!imageLoaded && (
          <div className="flex items-center justify-center py-20 text-sm text-gray-600">
            Loading mushaf page…
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={currentPage}
          src={mushafPageUrl(currentPage)}
          alt={`Mushaf page ${currentPage}`}
          className="w-full"
          onLoad={() => setImageLoaded(true)}
          style={{
            display: imageLoaded ? "block" : "none",
            filter: "invert(1) brightness(0.9)",
          }}
        />
      </div>

      {imageLoaded && (
        <p className="text-center text-xs text-gray-600">Page {currentPage}</p>
      )}

      <section className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Ayah bookmarks on this page</h2>
            <p className="mt-1 text-xs text-gray-500">
              {bookmarksLoading
                ? "Loading bookmark sync..."
                : provider === "qf"
                  ? `Synced with Quran Foundation. ${bookmarks.length} total bookmarks loaded.`
                  : "Saved locally on this device until you sign in."}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {bookmarkedOnCurrentPage.length} of {versesOnCurrentPage.length} ayahs bookmarked on page {currentPage}.
            </p>
          </div>

          <Link
            href="/quran/bookmarks"
            className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
          >
            View all bookmarks
          </Link>
        </div>

        {bookmarksError && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {bookmarksError}
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {versesOnCurrentPage.map((verse) => {
            const bookmarked = isBookmarked(verse.verse_key);

            return (
              <div
                key={verse.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors ${
                  verse.verse_key === targetVerse?.verse_key
                    ? "border-emerald-400/70 bg-emerald-500/15"
                    : bookmarked
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-gray-800 bg-gray-900/70"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{verse.verse_key}</p>
                  <p className="text-xs text-gray-500">
                    Ayah {verse.verse_number} on page {currentPage}
                  </p>
                </div>

                <BookmarkButton
                  isBookmarked={bookmarked}
                  onToggle={() => {
                    if (bookmarked) {
                      void removeBookmark(verse.verse_key);
                      return;
                    }

                    const [chapterId, verseNumber] = verse.verse_key.split(":").map(Number);
                    void addBookmark(chapterId, verseNumber);
                  }}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
