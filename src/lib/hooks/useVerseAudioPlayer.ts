"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { VerseAudioSettings, QueueEntry } from "@/lib/types";

const VERSE_AUDIO_BASE = "https://verses.quran.foundation";

const DEFAULT_SETTINGS: VerseAudioSettings = {
  speed: 1,
  startVerse: 1,
  endVerse: 9999,
  timesPerVerse: 1,
  timesPerSet: 1,
};

function verseUrl(audioPath: string, chapterNumber: number, verseNumber: number): string {
  const ch = String(chapterNumber).padStart(3, "0");
  const v = String(verseNumber).padStart(3, "0");
  return `${VERSE_AUDIO_BASE}/${audioPath}/${ch}${v}.mp3`;
}

function buildQueue(
  audioPath: string,
  chapterNumber: number,
  versesCount: number,
  settings: VerseAudioSettings
): QueueEntry[] {
  const start = Math.max(1, settings.startVerse);
  const end = Math.min(versesCount, settings.endVerse === 9999 ? versesCount : settings.endVerse);

  const queue: QueueEntry[] = [];
  for (let setIdx = 0; setIdx < settings.timesPerSet; setIdx++) {
    for (let verseNum = start; verseNum <= end; verseNum++) {
      for (let repIdx = 0; repIdx < settings.timesPerVerse; repIdx++) {
        queue.push({
          verseKey: `${chapterNumber}:${verseNum}`,
          url: verseUrl(audioPath, chapterNumber, verseNum),
        });
      }
    }
  }
  return queue;
}

export function useVerseAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<QueueEntry[]>([]);
  const queueIndexRef = useRef<number>(0);
  const settingsRef = useRef<VerseAudioSettings>(DEFAULT_SETTINGS);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentVerseKey, setCurrentVerseKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueLength, setQueueLength] = useState(0);
  const [settingsState, setSettingsState] = useState<VerseAudioSettings>(DEFAULT_SETTINGS);

  function getAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
    }
    return audioRef.current;
  }

  const stopInternal = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentVerseKey(null);
    setQueuePosition(0);
    setQueueLength(0);
    queueRef.current = [];
    queueIndexRef.current = 0;
  }, []);

  const playEntry = useCallback((entry: QueueEntry, index: number) => {
    const audio = getAudio();
    audio.src = entry.url;
    audio.load();
    setCurrentVerseKey(entry.verseKey);
    setQueuePosition(index + 1);
    setIsLoading(true);
    setError(null);
  }, []);

  const advanceQueue = useCallback(() => {
    const nextIndex = queueIndexRef.current + 1;
    if (nextIndex >= queueRef.current.length) {
      stopInternal();
      return;
    }
    queueIndexRef.current = nextIndex;
    playEntry(queueRef.current[nextIndex], nextIndex);
  }, [playEntry, stopInternal]);

  useEffect(() => {
    const audio = getAudio();

    const onCanPlay = () => {
      setIsLoading(false);
      // Re-apply speed here — browsers reset playbackRate to 1 on src change
      audio.playbackRate = settingsRef.current.speed;
      audio.play().catch((err) => {
        setError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Autoplay blocked — tap play again."
            : "Could not play audio."
        );
        setIsPlaying(false);
        setIsLoading(false);
      });
    };
    const onPlaying = () => { setIsPlaying(true); setIsLoading(false); };
    const onEnded = () => advanceQueue();
    const onError = () => {
      setIsPlaying(false);
      setIsLoading(false);
      setError("Failed to load audio. Check your connection.");
    };

    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [advanceQueue]);

  const play = useCallback(
    (startVerseKey: string, audioPath: string, chapterNumber: number, versesCount: number) => {
      setError(null);
      const queue = buildQueue(audioPath, chapterNumber, versesCount, settingsRef.current);
      if (queue.length === 0) {
        setError("No verses in range.");
        return;
      }

      const startIndex = queue.findIndex((e) => e.verseKey === startVerseKey);
      const resolvedIndex = startIndex >= 0 ? startIndex : 0;

      queueRef.current = queue;
      queueIndexRef.current = resolvedIndex;
      setQueueLength(queue.length);

      playEntry(queue[resolvedIndex], resolvedIndex);
    },
    [playEntry]
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, []);

  const stop = useCallback(() => stopInternal(), [stopInternal]);

  const skipForward = useCallback(() => {
    const queue = queueRef.current;
    const currentKey = queue[queueIndexRef.current]?.verseKey;
    if (!currentKey) return;
    let nextIdx = queueIndexRef.current + 1;
    while (nextIdx < queue.length && queue[nextIdx].verseKey === currentKey) nextIdx++;
    if (nextIdx >= queue.length) { stopInternal(); return; }
    queueIndexRef.current = nextIdx;
    playEntry(queue[nextIdx], nextIdx);
  }, [playEntry, stopInternal]);

  const skipBack = useCallback(() => {
    const queue = queueRef.current;
    const currentKey = queue[queueIndexRef.current]?.verseKey;
    if (!currentKey) return;
    let firstOfCurrent = queueIndexRef.current;
    while (firstOfCurrent > 0 && queue[firstOfCurrent - 1].verseKey === currentKey) firstOfCurrent--;
    if (firstOfCurrent === 0) {
      queueIndexRef.current = 0;
      playEntry(queue[0], 0);
      return;
    }
    const prevKey = queue[firstOfCurrent - 1].verseKey;
    let prevStart = firstOfCurrent - 1;
    while (prevStart > 0 && queue[prevStart - 1].verseKey === prevKey) prevStart--;
    queueIndexRef.current = prevStart;
    playEntry(queue[prevStart], prevStart);
  }, [playEntry]);

  const updateSettings = useCallback((patch: Partial<VerseAudioSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettingsState(next);
    if (patch.speed !== undefined && audioRef.current) {
      audioRef.current.playbackRate = patch.speed;
    }
  }, []);

  return {
    isPlaying,
    isLoading,
    currentVerseKey,
    error,
    queuePosition,
    queueLength,
    settings: settingsState,
    play,
    pause,
    resume,
    stop,
    skipForward,
    skipBack,
    updateSettings,
  };
}
