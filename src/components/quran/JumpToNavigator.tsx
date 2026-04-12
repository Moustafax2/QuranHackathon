"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHAPTERS_DATA } from "@/lib/data/chapters-data";

type JumpType = "surah" | "page";

export function JumpToNavigator() {
  const router = useRouter();
  const [jumpType, setJumpType] = useState<JumpType>("surah");
  const [surahId, setSurahId] = useState(1);
  const [verseNumber, setVerseNumber] = useState(1);
  const [mode, setMode] = useState<"ayah" | "mushaf">("ayah");
  const [pageNumber, setPageNumber] = useState(1);

  const selectedSurah = CHAPTERS_DATA.find((c) => c.id === surahId)!;
  const maxVerses = selectedSurah.verses_count;

  function handleSurahChange(value: number) {
    setSurahId(value);
    setVerseNumber(1);
  }

  function handleVerseChange(value: number) {
    setVerseNumber(Math.max(1, Math.min(value, maxVerses)));
  }

  function handlePageChange(value: number) {
    setPageNumber(Math.max(1, Math.min(value, 604)));
  }

  function handleGo() {
    if (jumpType === "page") {
      router.push(`/quran/page-view/${pageNumber}`);
    } else if (mode === "mushaf") {
      router.push(`/quran/surah/${surahId}?mode=mushaf`);
    } else {
      router.push(`/quran/surah/${surahId}#ayah-${verseNumber}`);
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-gray-700 bg-gray-900 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Jump To
        </span>

        {/* Jump type toggle */}
        <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-0.5">
          <button
            type="button"
            onClick={() => setJumpType("surah")}
            className={`rounded-md px-2 py-1 text-sm font-medium transition-colors ${
              jumpType === "surah"
                ? "bg-emerald-900/60 text-emerald-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Surah
          </button>
          <button
            type="button"
            onClick={() => setJumpType("page")}
            className={`rounded-md px-2 py-1 text-sm font-medium transition-colors ${
              jumpType === "page"
                ? "bg-emerald-900/60 text-emerald-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Page
          </button>
        </div>

        {jumpType === "surah" ? (
          <>
            <select
              value={surahId}
              onChange={(e) => handleSurahChange(Number(e.target.value))}
              className="min-w-[160px] rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              {CHAPTERS_DATA.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.id}. {chapter.name_simple}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={1}
              max={maxVerses}
              value={verseNumber}
              onChange={(e) => handleVerseChange(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />

            <div className="flex rounded-lg border border-gray-700 bg-gray-800 p-0.5">
              <button
                type="button"
                onClick={() => setMode("ayah")}
                className={`rounded-md px-2 py-1 text-sm font-medium transition-colors ${
                  mode === "ayah"
                    ? "bg-emerald-900/60 text-emerald-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Ayah by Ayah
              </button>
              <button
                type="button"
                onClick={() => setMode("mushaf")}
                className={`rounded-md px-2 py-1 text-sm font-medium transition-colors ${
                  mode === "mushaf"
                    ? "bg-emerald-900/60 text-emerald-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Mushaf
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              type="number"
              min={1}
              max={604}
              value={pageNumber}
              onChange={(e) => handlePageChange(Number(e.target.value))}
              className="w-24 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
            <span className="text-xs text-gray-600">of 604</span>
            <span className="rounded-md bg-emerald-900/40 px-2 py-1 text-xs text-emerald-400">
              Mushaf
            </span>
          </>
        )}

        <button
          type="button"
          onClick={handleGo}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 active:bg-emerald-800"
        >
          Go
        </button>
      </div>
    </div>
  );
}
