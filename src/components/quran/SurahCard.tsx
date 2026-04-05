import Link from "next/link";

import type { Chapter } from "@/lib/types";

export function SurahCard({ chapter }: { chapter: Chapter }) {
  return (
    <Link
      href={`/surah/${chapter.id}`}
      className="group flex items-center gap-4 rounded-lg border border-gray-200 p-4 transition-all hover:border-emerald-500 hover:shadow-md dark:border-gray-700 dark:hover:border-emerald-400"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-700 group-hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">
        {chapter.id}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {chapter.name_simple}
          </h3>
          <span
            dir="rtl"
            lang="ar"
            translate="no"
            className="font-amiri text-lg text-gray-700 dark:text-gray-300"
          >
            {chapter.name_arabic}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>{chapter.translated_name.name}</span>
          <span>&middot;</span>
          <span>{chapter.verses_count} verses</span>
          <span>&middot;</span>
          <span className="capitalize">{chapter.revelation_place}</span>
        </div>
      </div>
    </Link>
  );
}
