import {
  isQuranSearchUnavailableError,
  searchQuran,
} from "@/lib/api";
import { SearchBar } from "@/components/search/SearchBar";
import Link from "next/link";
import type { SearchResponse, SearchResult } from "@/lib/types";

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function getVerseHref(result: SearchResult): string {
  const key = String(result.key);
  const [chapterId, ayah] = key.split(":");

  if (!chapterId || !ayah) return "/quran";

  return `/quran/surah/${chapterId}#ayah-${ayah}`;
}

function getNavigationHref(result: SearchResult): string {
  if (result.result_type === "surah") return `/quran/surah/${result.key}`;
  if (result.result_type === "page" || result.result_type === "search_page") {
    return `/quran/page-view/${result.key}`;
  }
  if (result.result_type === "ayah") return getVerseHref(result);

  return "/quran";
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, page } = await searchParams;
  const query = q || "";
  const currentPage = parseInt(page || "1", 10);
  let results: SearchResponse | null = null;
  let unavailableMessage: string | null = null;
  let errorMessage: string | null = null;

  if (query) {
    try {
      results = await searchQuran(query, currentPage);
    } catch (error) {
      if (isQuranSearchUnavailableError(error)) {
        unavailableMessage = error.message;
      } else {
        errorMessage =
          "Search could not be completed right now. Please try again later.";
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Search the Quran
      </h1>

      <SearchBar />

      {unavailableMessage && (
        <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          {unavailableMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {results && (
        <div className="mt-8">
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {results.pagination.total_records} results for &ldquo;{query}&rdquo;
          </p>

          {results.result.navigation.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Quick matches
              </h2>
              <div className="flex flex-wrap gap-2">
                {results.result.navigation.map((result, index) => (
                  <Link
                    key={`${result.result_type}-${result.key}-${index}`}
                    href={getNavigationHref(result)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:border-emerald-500 dark:border-gray-700 dark:text-gray-300 dark:hover:border-emerald-400"
                  >
                    {stripHtml(result.name)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {results.result.verses.map((result, index) => (
                <Link
                  key={`${result.key}-${index}`}
                  href={getVerseHref(result)}
                  className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-emerald-500 dark:border-gray-700 dark:hover:border-emerald-400"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {result.key}
                    </span>
                  </div>
                  {(result.arabic || result.isArabic) && (
                    <p
                      dir="rtl"
                      lang="ar"
                      translate="no"
                      className="font-amiri mb-2 text-lg leading-loose text-gray-900 dark:text-gray-100"
                    >
                      {stripHtml(result.arabic ?? result.name)}
                    </p>
                  )}
                  {!result.isArabic && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {stripHtml(result.name)}
                    </p>
                  )}
                </Link>
            ))}
          </div>

          {results.pagination.total_pages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              {currentPage > 1 && (
                <Link
                  href={`/quran/search?q=${encodeURIComponent(query)}&page=${currentPage - 1}`}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Previous
                </Link>
              )}
              {currentPage < results.pagination.total_pages && (
                <Link
                  href={`/quran/search?q=${encodeURIComponent(query)}&page=${currentPage + 1}`}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {query &&
        results &&
        !unavailableMessage &&
        !errorMessage &&
        results.pagination.total_records === 0 && (
        <p className="mt-8 text-center text-gray-500 dark:text-gray-400">
          No results found for &ldquo;{query}&rdquo;
        </p>
        )}
    </div>
  );
}
