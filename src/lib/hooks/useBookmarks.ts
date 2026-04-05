"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface Bookmark {
  verseKey: string;
  chapterId: number;
  verseNumber: number;
  timestamp: number;
}

const STORAGE_KEY = "quran-bookmarks";
const STORAGE_EVENT = "quran-bookmarks-change";
const EMPTY_BOOKMARKS: Bookmark[] = [];

let cachedBookmarks: Bookmark[] = EMPTY_BOOKMARKS;
let cachedRawBookmarks: string | null | undefined = undefined;

function readBookmarksSnapshot(): Bookmark[] {
  if (typeof window === "undefined") return EMPTY_BOOKMARKS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw === cachedRawBookmarks) {
      return cachedBookmarks;
    }

    cachedRawBookmarks = raw;
    cachedBookmarks = raw ? (JSON.parse(raw) as Bookmark[]) : EMPTY_BOOKMARKS;
    return cachedBookmarks;
  } catch {
    cachedRawBookmarks = null;
    cachedBookmarks = EMPTY_BOOKMARKS;
    return cachedBookmarks;
  }
}

export function useBookmarks() {
  const bookmarks = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => undefined;
      }

      const handleChange = () => onStoreChange();

      window.addEventListener("storage", handleChange);
      window.addEventListener(STORAGE_EVENT, handleChange);

      return () => {
        window.removeEventListener("storage", handleChange);
        window.removeEventListener(STORAGE_EVENT, handleChange);
      };
    },
    readBookmarksSnapshot,
    () => EMPTY_BOOKMARKS
  );

  const save = useCallback((updated: Bookmark[]) => {
    const raw = JSON.stringify(updated);
    cachedRawBookmarks = raw;
    cachedBookmarks = updated;
    localStorage.setItem(STORAGE_KEY, raw);
    window.dispatchEvent(new Event(STORAGE_EVENT));
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
