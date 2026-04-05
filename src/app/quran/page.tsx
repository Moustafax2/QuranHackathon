import { getChapters } from "@/lib/api";
import { SurahCard } from "@/components/quran/SurahCard";

export default async function QuranHomePage() {
  const { chapters } = await getChapters();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 text-center">
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
