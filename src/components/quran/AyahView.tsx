"use client";

import { useState } from "react";
import type { Verse } from "@/lib/types";
import { VerseDisplay } from "./VerseDisplay";

export function AyahView({ verses }: { verses: Verse[] }) {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => setShowTranslation((prev) => !prev)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            showTranslation
              ? "border-emerald-500/60 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50"
              : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-white"
          }`}
        >
          {showTranslation ? "Hide Translation" : "Show Translation"}
        </button>
      </div>
      <VerseDisplay verses={verses} showTranslation={showTranslation} />
    </div>
  );
}
