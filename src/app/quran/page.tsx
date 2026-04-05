import { getChapters } from "@/lib/api";
import { SurahCard } from "@/components/quran/SurahCard";
import Link from "next/link";

export default async function QuranHomePage() {
  const { chapters } = await getChapters();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center sm:justify-end">
          <Link
            href="/quran/settings"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-emerald-500/60 hover:text-white"
          >
            Integration Settings
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-white">
          The Holy Quran
        </h1>
        <p className="mt-2 text-gray-400">
          Read, listen, and explore all 114 surahs
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {chapters.map((chapter) => (
          <SurahCard key={chapter.id} chapter={chapter} />
        ))}
      </div>
    </div>
  );
}
