import Link from "next/link";
import type { Chapter } from "@/lib/types";

export function SurahCard({ chapter }: { chapter: Chapter }) {
  return (
    <Link
      href={`/quran/surah/${chapter.id}`}
      className="group flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 p-4 transition-all hover:border-emerald-500/60 hover:bg-gray-800"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-900/40 text-sm font-semibold text-emerald-400 group-hover:bg-emerald-900/60">
        {chapter.id}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">
            {chapter.name_simple}
          </h3>
          <span className="font-amiri text-lg text-gray-300">
            {chapter.name_arabic}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{chapter.translated_name.name}</span>
          <span>·</span>
          <span>{chapter.verses_count} verses</span>
          <span>·</span>
          <span className="capitalize">{chapter.revelation_place}</span>
        </div>
      </div>
    </Link>
  );
}
