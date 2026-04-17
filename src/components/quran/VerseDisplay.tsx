"use client";

import { useEffect } from "react";
import type { Verse } from "@/lib/types";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { useBookmarks } from "@/lib/hooks/useBookmarks";
import { useVersePlayer } from "@/contexts/VersePlayerContext";
import { VersePlayButton } from "@/components/quran/verse-player/VersePlayButton";

export function VerseDisplay({
  verses,
  showTranslation,
}: {
  verses: Verse[];
  showTranslation: boolean;
}) {
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();
  const { currentVerseKey, isPlaying } = useVersePlayer();

  // Auto-scroll to the active verse while playing
  useEffect(() => {
    if (!currentVerseKey || !isPlaying) return;
    const verseNum = currentVerseKey.split(":")[1];
    document
      .getElementById(`ayah-${verseNum}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentVerseKey, isPlaying]);

  return (
    <div className="space-y-8">
      {verses.map((verse) => {
        const bookmarked = isBookmarked(verse.verse_key);
        const isActive = currentVerseKey === verse.verse_key;
        return (
          <div
            key={verse.id}
            id={`ayah-${verse.verse_number}`}
            className={`scroll-mt-8 rounded-lg border p-6 transition-colors ${
              isActive
                ? "border-emerald-500/60 bg-emerald-900/20 ring-1 ring-emerald-500/30"
                : "border-gray-800 bg-gray-900/50"
            }`}
          >
            {/* Top row: ayah number + play button on left, bookmark on right */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-900/40 text-xs font-semibold text-emerald-400">
                  {verse.verse_number}
                </span>
                <VersePlayButton verse={verse} />
              </div>
              <BookmarkButton
                isBookmarked={bookmarked}
                onToggle={() => {
                  if (bookmarked) {
                    removeBookmark(verse.verse_key);
                  } else {
                    const [ch, v] = verse.verse_key.split(":").map(Number);
                    addBookmark(ch, v);
                  }
                }}
              />
            </div>
            <p
              dir="rtl"
              lang="ar"
              translate="no"
              className="font-amiri mb-4 text-right leading-loose text-white"
              style={{ fontSize: "1.8rem" }}
            >
              {verse.text_uthmani}
            </p>
            {showTranslation && verse.translations?.map((t) => (
              <p
                key={t.id}
                className="text-base leading-relaxed text-gray-400"
                dangerouslySetInnerHTML={{ __html: t.text }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
