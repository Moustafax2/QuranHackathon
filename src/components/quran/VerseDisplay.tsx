"use client";

import type { Verse } from "@/lib/types";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { useBookmarks } from "@/lib/hooks/useBookmarks";

export function VerseDisplay({ verses }: { verses: Verse[] }) {
  const { isBookmarked, addBookmark, removeBookmark } = useBookmarks();

  return (
    <div className="space-y-8">
      {verses.map((verse) => {
        const bookmarked = isBookmarked(verse.verse_key);
        return (
          <div
            key={verse.id}
            className="rounded-lg border border-gray-100 p-6 dark:border-gray-800"
          >
            <div className="mb-4 flex items-start justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {verse.verse_number}
              </span>
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
              className="font-amiri mb-4 text-right text-2xl leading-loose text-gray-900 dark:text-gray-100"
            >
              {verse.text_uthmani}
            </p>
            {verse.translations?.map((t) => (
              <p
                key={t.id}
                className="text-base leading-relaxed text-gray-600 dark:text-gray-400"
                dangerouslySetInnerHTML={{ __html: t.text }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
