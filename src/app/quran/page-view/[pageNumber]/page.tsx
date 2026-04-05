import { getVersesByPage } from "@/lib/api";
import { VerseDisplay } from "@/components/quran/VerseDisplay";
import { PageNavigator } from "@/components/quran/PageNavigator";

interface Props {
  params: Promise<{ pageNumber: string }>;
}

export default async function MushafPageView({ params }: Props) {
  const { pageNumber } = await params;
  const page = parseInt(pageNumber, 10);
  const { verses } = await getVersesByPage(page);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <PageNavigator currentPage={page} />
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
        <VerseDisplay verses={verses} />
      </div>

      <div className="mt-6">
        <PageNavigator currentPage={page} />
      </div>
    </div>
  );
}
