import { getChapter, getVersesByChapter } from "@/lib/api";
import { AyahView } from "@/components/quran/AyahView";
import { MushafView } from "@/components/quran/MushafView";
import { VersePlayerProvider } from "@/contexts/VersePlayerContext";
import { VersePlayerBar } from "@/components/quran/verse-player/VersePlayerBar";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}

export default async function SurahPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { mode = "ayah" } = await searchParams;
  const chapterNumber = parseInt(id, 10);
  const [{ chapter }, { verses }] = await Promise.all([
    getChapter(chapterNumber),
    getVersesByChapter(chapterNumber),
  ]);

  const pageNumbers = [...new Set(verses.map((v) => v.page_number))].sort(
    (a, b) => a - b
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 text-center">
        <Link
          href="/quran"
          className="mb-4 inline-block text-sm text-emerald-400 hover:underline"
        >
          &larr; All Surahs
        </Link>
        <h1 className="mb-6 text-3xl font-bold text-white">
          {chapter.name_simple}
        </h1>
        <div className="flex justify-center gap-2">
          <Link
            href={`/quran/surah/${chapterNumber}?mode=mushaf`}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              mode === "mushaf"
                ? "border-emerald-500/60 bg-emerald-900/30 text-emerald-400"
                : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-white"
            }`}
          >
            Mushaf View
          </Link>
          <Link
            href={`/quran/surah/${chapterNumber}`}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              mode !== "mushaf"
                ? "border-emerald-500/60 bg-emerald-900/30 text-emerald-400"
                : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-white"
            }`}
          >
            Ayah by Ayah
          </Link>
        </div>
      </div>

      <VersePlayerProvider
        chapterNumber={chapterNumber}
        versesCount={chapter.verses_count}
      >
        {mode === "mushaf" ? (
          <MushafView pageNumbers={pageNumbers} verses={verses} />
        ) : (
          <AyahView verses={verses} />
        )}
        <VersePlayerBar />
      </VersePlayerProvider>
    </div>
  );
}
