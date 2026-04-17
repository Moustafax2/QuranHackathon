"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useVerseAudioPlayer } from "@/lib/hooks/useVerseAudioPlayer";
import type { VerseAudioSettings } from "@/lib/types";

export interface VersePlayerContextValue {
  isPlaying: boolean;
  isLoading: boolean;
  currentVerseKey: string | null;
  error: string | null;
  queuePosition: number;
  queueLength: number;
  chapterNumber: number;
  versesCount: number;
  settings: VerseAudioSettings;
  /** startVerseKey, reciterAudioPath */
  play: (startVerseKey: string, reciterAudioPath: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipForward: () => void;
  skipBack: () => void;
  updateSettings: (patch: Partial<VerseAudioSettings>) => void;
}

const VersePlayerContext = createContext<VersePlayerContextValue | null>(null);

export function useVersePlayer(): VersePlayerContextValue {
  const ctx = useContext(VersePlayerContext);
  if (!ctx) throw new Error("useVersePlayer must be used within VersePlayerProvider");
  return ctx;
}

interface VersePlayerProviderProps {
  chapterNumber: number;
  versesCount: number;
  children: ReactNode;
}

export function VersePlayerProvider({
  chapterNumber,
  versesCount,
  children,
}: VersePlayerProviderProps) {
  const player = useVerseAudioPlayer();

  const play = (startVerseKey: string, reciterAudioPath: string) => {
    player.play(startVerseKey, reciterAudioPath, chapterNumber, versesCount);
  };

  const value: VersePlayerContextValue = {
    isPlaying: player.isPlaying,
    isLoading: player.isLoading,
    currentVerseKey: player.currentVerseKey,
    error: player.error,
    queuePosition: player.queuePosition,
    queueLength: player.queueLength,
    settings: player.settings,
    chapterNumber,
    versesCount,
    play,
    pause: player.pause,
    resume: player.resume,
    stop: player.stop,
    skipForward: player.skipForward,
    skipBack: player.skipBack,
    updateSettings: player.updateSettings,
  };

  return (
    <VersePlayerContext.Provider value={value}>
      {children}
    </VersePlayerContext.Provider>
  );
}
