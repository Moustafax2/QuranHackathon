"use client";

import { useState } from "react";
import Link from "next/link";
import { CHAPTERS_DATA } from "@/lib/data/chapters-data";

export default function SelectSurahPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const chapters = CHAPTERS_DATA.filter(
    (ch) =>
      ch.name_arabic.includes(searchQuery) ||
      ch.name_simple.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.translated_name.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="mb-3 text-3xl font-bold text-white">
            Learn Words from the Quran
          </h1>
          <p className="text-gray-400">
            Select a surah to start learning its vocabulary
          </p>
        </div>

        <div className="mb-8">
          <input
            type="text"
            placeholder="Search surahs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter) => (
            <Link
              key={chapter.id}
              href={`/train/flashcards/intake?surah=${chapter.id}`}
              className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 transition-all hover:scale-105 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-xl font-bold text-emerald-400">
                  {chapter.id}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-800 px-2 py-1 text-xs text-gray-400">
                    {chapter.verses_count} verses
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      chapter.revelation_place === "makkah"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {chapter.revelation_place === "makkah" ? "🕋" : "🕌"}
                  </span>
                </div>
              </div>

              <div className="mb-2 font-amiri text-2xl font-bold text-white">
                {chapter.name_arabic}
              </div>

              <div className="mb-1 text-sm font-medium text-gray-300">
                {chapter.name_simple}
              </div>

              <div className="text-sm text-emerald-400">
                {chapter.translated_name.name}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
