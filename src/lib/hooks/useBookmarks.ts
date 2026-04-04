"use client";

import { useState, useEffect, useCallback } from "react";

export interface Bookmark {
  verseKey: string;
  chapterId: number;
  verseNumber: number;
  timestamp: number;
}

const STORAGE_KEY = "quran-bookmarks";

function loadBookmarks(): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    setBookmarks(loadBookmarks());
  }, []);

  const save = useCallback((updated: Bookmark[]) => {
    setBookmarks(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addBookmark = useCallback(
    (chapterId: number, verseNumber: number) => {
      const verseKey = `${chapterId}:${verseNumber}`;
      if (bookmarks.some((b) => b.verseKey === verseKey)) return;
      save([...bookmarks, { verseKey, chapterId, verseNumber, timestamp: Date.now() }]);
    },
    [bookmarks, save]
  );

  const removeBookmark = useCallback(
    (verseKey: string) => {
      save(bookmarks.filter((b) => b.verseKey !== verseKey));
    },
    [bookmarks, save]
  );

  const isBookmarked = useCallback(
    (verseKey: string) => bookmarks.some((b) => b.verseKey === verseKey),
    [bookmarks]
  );

  return { bookmarks, addBookmark, removeBookmark, isBookmarked };
}
