"use client";

import { useState } from "react";

function mushafPageUrl(page: number): string {
  return `https://files.quran.app/hafs/madani/width_1260/page${String(page).padStart(3, "0")}.png`;
}

export function MushafView({ pageNumbers }: { pageNumbers: number[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  const currentPage = pageNumbers[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < pageNumbers.length - 1;

  function goTo(index: number) {
    setCurrentIndex(index);
    setImageLoaded(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => goTo(currentIndex - 1)}
          disabled={!hasPrev}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          Page {hasPrev ? pageNumbers[currentIndex - 1] : ""}
        </button>

        <span className="text-sm font-medium text-gray-400">
          Page {currentPage}{" "}
          <span className="text-gray-600">
            ({currentIndex + 1} / {pageNumbers.length})
          </span>
        </span>

        <button
          onClick={() => goTo(currentIndex + 1)}
          disabled={!hasNext}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Page {hasNext ? pageNumbers[currentIndex + 1] : ""}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="overflow-hidden rounded-lg bg-black">
        {!imageLoaded && (
          <div className="flex items-center justify-center py-20 text-sm text-gray-600">
            Loading mushaf page…
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={currentPage}
          src={mushafPageUrl(currentPage)}
          alt={`Mushaf page ${currentPage}`}
          className="w-full"
          onLoad={() => setImageLoaded(true)}
          style={{
            display: imageLoaded ? "block" : "none",
            filter: "invert(1) brightness(0.9)",
          }}
        />
      </div>

      {imageLoaded && (
        <p className="text-center text-xs text-gray-600">Page {currentPage}</p>
      )}
    </div>
  );
}
