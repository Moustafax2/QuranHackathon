import Link from "next/link";

interface PageNavigatorProps {
  currentPage: number;
  totalPages?: number;
}

export function PageNavigator({
  currentPage,
  totalPages = 604,
}: PageNavigatorProps) {
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div className="flex items-center justify-between">
      {hasPrev ? (
        <Link
          href={`/quran/page-view/${currentPage - 1}`}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          Page {currentPage - 1}
        </Link>
      ) : (
        <div />
      )}

      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
        Page {currentPage} of {totalPages}
      </span>

      {hasNext ? (
        <Link
          href={`/quran/page-view/${currentPage + 1}`}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
        >
          Page {currentPage + 1}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
