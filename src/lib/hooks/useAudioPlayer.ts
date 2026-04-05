"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { RECITERS } from "@/lib/quran/reciters";

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChapter, setCurrentChapter] = useState<number | null>(null);
  const [reciterId, setReciterId] = useState<number>(RECITERS[0].id);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Lazily create the audio element once on the client
  function getAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
    }
    return audioRef.current;
  }

  useEffect(() => {
    const audio = getAudio();

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDurationChange = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      setError("Failed to load audio. Please try again.");
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [audioUrl]);

  const play = useCallback(async (chapterNumber: number, url: string) => {
    setError(null);
    const audio = getAudio();

    if (audio.src !== url) {
      audio.src = url;
      audio.load(); // explicitly trigger load before play
    }

    setCurrentChapter(chapterNumber);
    setAudioUrl(url);

    try {
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      // NotSupportedError or NotAllowedError
      setIsPlaying(false);
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Autoplay blocked — tap play again."
          : "Could not play audio."
      );
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else if (audio.src && audio.src !== window.location.href) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const changeReciter = useCallback((id: number) => {
    setReciterId(id);
    setIsPlaying(false);
    setAudioUrl(null);
    setError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, []);

  const setErrorMessage = useCallback((message: string | null) => {
    setError(message);
  }, []);

  return {
    isPlaying,
    currentChapter,
    reciterId,
    progress,
    duration,
    error,
    play,
    pause,
    toggle,
    seek,
    changeReciter,
    setErrorMessage,
  };
}
