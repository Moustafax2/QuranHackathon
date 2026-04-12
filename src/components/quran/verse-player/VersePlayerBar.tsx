"use client";

import { useVersePlayer } from "@/contexts/VersePlayerContext";

export function VersePlayerBar() {
  const {
    isPlaying,
    isLoading,
    currentVerseKey,
    queuePosition,
    queueLength,
    stop,
    pause,
    resume,
  } = useVersePlayer();

  if (!currentVerseKey) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-900/60 bg-gray-950/95 px-4 py-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={isPlaying ? pause : resume}
          disabled={isLoading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
          aria-label={isPlaying ? "Pause recitation" : "Resume recitation"}
        >
          {isLoading ? (
            <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-medium text-emerald-400">
            Verse {currentVerseKey}
          </span>
          {queueLength > 0 && (
            <span className="text-[10px] text-gray-500">
              {queuePosition} / {queueLength} in queue
            </span>
          )}
        </div>

        {/* Stop */}
        <button
          onClick={stop}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-700 text-gray-400 transition-colors hover:border-red-700 hover:text-red-400"
          aria-label="Stop recitation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
