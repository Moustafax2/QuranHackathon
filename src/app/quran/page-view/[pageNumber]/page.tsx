import { getVersesByPage } from "@/lib/api";
import { AyahView } from "@/components/quran/AyahView";
import { PageNavigator } from "@/components/quran/PageNavigator";

interface Props {
  params: Promise<{ pageNumber: string }>;
  searchParams: Promise<{ translations?: string }>;
}

export default async function MushafPageView({ params, searchParams }: Props) {
  const { pageNumber } = await params;
  const { translations } = await searchParams;
  const page = parseInt(pageNumber, 10);
  const showTranslations =
    translations === "1" || translations === "true" || translations === "on";
  const { verses } = await getVersesByPage(page);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <PageNavigator currentPage={page} />
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
        <AyahView verses={verses} initialShowTranslation={showTranslations} />
      </div>

      <div className="mt-6">
        <PageNavigator currentPage={page} />
      </div>
    </div>
  );
}
