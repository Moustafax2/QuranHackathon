import {
  isQuranSearchUnavailableError,
  searchQuran,
} from "@/lib/api";
import { SearchBar } from "@/components/search/SearchBar";
import Link from "next/link";
import type { SearchResponse } from "@/lib/types";

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
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
            {results.search.total_results} results for &ldquo;{query}&rdquo;
          </p>

          <div className="space-y-4">
            {results.search.results.map((result) => {
              const [chapterId] = result.verse_key.split(":");
              return (
                <Link
                  key={result.verse_id}
                  href={`/quran/surah/${chapterId}`}
                  className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-emerald-500 dark:border-gray-700 dark:hover:border-emerald-400"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {result.verse_key}
                    </span>
                  </div>
                  <p
                    dir="rtl"
                    lang="ar"
                    translate="no"
                    className="font-amiri mb-2 text-lg leading-loose text-gray-900 dark:text-gray-100"
                  >
                    {result.text}
                  </p>
                  {result.translations?.[0] && (
                    <p
                      className="text-sm text-gray-600 dark:text-gray-400"
                      dangerouslySetInnerHTML={{
                        __html: result.translations[0].text,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {results.search.total_pages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              {currentPage > 1 && (
                <Link
                  href={`/quran/search?q=${encodeURIComponent(query)}&page=${currentPage - 1}`}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Previous
                </Link>
              )}
              {currentPage < results.search.total_pages && (
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
        results.search.total_results === 0 && (
        <p className="mt-8 text-center text-gray-500 dark:text-gray-400">
          No results found for &ldquo;{query}&rdquo;
        </p>
        )}
    </div>
  );
}
