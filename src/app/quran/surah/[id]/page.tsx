import { getChapter, getVersesByChapter } from "@/lib/api";
import { VerseDisplay } from "@/components/quran/VerseDisplay";
import { PlayChapterButton } from "@/components/quran/AudioPlayer";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SurahPage({ params }: Props) {
  const { id } = await params;
  const chapterNumber = parseInt(id, 10);
  const [{ chapter }, { verses }] = await Promise.all([
    getChapter(chapterNumber),
    getVersesByChapter(chapterNumber),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 text-center">
        <Link
          href="/quran"
          className="mb-4 inline-block text-sm text-emerald-400 hover:underline"
        >
          &larr; All Surahs
        </Link>
        <h1 className="text-3xl font-bold text-white">
          {chapter.name_simple}
        </h1>
        <p
          dir="rtl"
          lang="ar"
          translate="no"
          className="font-amiri mt-2 text-2xl text-gray-300"
        >
          {chapter.name_arabic}
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {chapter.translated_name.name} &middot; {chapter.verses_count} verses
          &middot;{" "}
          <span className="capitalize">{chapter.revelation_place}</span>
        </p>
        <div className="mt-4">
          <PlayChapterButton chapterNumber={chapterNumber} />
        </div>
      </div>

      {chapter.bismillah_pre && (
        <p
          dir="rtl"
          lang="ar"
          translate="no"
          className="font-amiri mb-8 text-center text-2xl text-gray-800 dark:text-gray-200"
        >
          بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
        </p>
      )}

      <VerseDisplay verses={verses} />

      <div className="mt-8 flex justify-between">
        {chapterNumber > 1 && (
          <Link
            href={`/quran/surah/${chapterNumber - 1}`}
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:border-gray-600 hover:bg-gray-800 hover:text-white"
          >
            &larr; Previous Surah
          </Link>
        )}
        <div />
        {chapterNumber < 114 && (
          <Link
            href={`/quran/surah/${chapterNumber + 1}`}
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 hover:border-gray-600 hover:bg-gray-800 hover:text-white"
          >
            Next Surah &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
