"use client";

import { useState } from "react";
import type { Verse } from "@/lib/types";
import { RECITERS } from "@/lib/quran/reciters";
import { useVersePlayer } from "@/contexts/VersePlayerContext";
import { AdvancedSettingsPanel } from "./AdvancedSettingsPanel";

interface Props {
  versesOnPage: Verse[];
  onClose: () => void;
}

export function MushafReciterDropdown({ versesOnPage, onClose }: Props) {
  const { play, stop, isPlaying, updateSettings, settings, versesCount } =
    useVersePlayer();
  const [selectedReciterId, setSelectedReciterId] = useState<number>(RECITERS[0].id);
  const [selectedVerseKey, setSelectedVerseKey] = useState(
    versesOnPage[0]?.verse_key ?? ""
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handlePlay = () => {
    if (isPlaying) {
      stop();
      onClose();
      return;
    }
    if (!selectedVerseKey) return;
    const reciter = RECITERS.find((r) => r.id === selectedReciterId) ?? RECITERS[0];
    play(selectedVerseKey, reciter.audioPath);
    onClose();
  };

  return (
    <div className="w-64 rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl">
      {/* Reciter */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Reciter
        </label>
        <select
          value={selectedReciterId}
          onChange={(e) => setSelectedReciterId(Number(e.target.value))}
          className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200"
        >
          {RECITERS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}{r.style ? ` (${r.style})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Starting Ayah */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Start from ayah
        </label>
        <select
          value={selectedVerseKey}
          onChange={(e) => setSelectedVerseKey(e.target.value)}
          className="w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200"
        >
          {versesOnPage.map((v) => (
            <option key={v.verse_key} value={v.verse_key}>
              Ayah {v.verse_number}
            </option>
          ))}
        </select>
      </div>

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced((p) => !p)}
        className="mb-3 flex w-full items-center justify-between text-xs text-gray-500 hover:text-gray-300"
      >
        <span>Advanced settings</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
        >
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {showAdvanced && (
        <AdvancedSettingsPanel
          settings={settings}
          versesCount={versesCount}
          onChange={updateSettings}
        />
      )}

      {/* Play / Stop button */}
      <button
        onClick={handlePlay}
        disabled={!selectedVerseKey}
        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {isPlaying ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
            </svg>
            Stop
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
            </svg>
            Play
          </>
        )}
      </button>
    </div>
  );
}
