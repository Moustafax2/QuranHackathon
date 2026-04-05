"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export interface Bookmark {
  verseKey: string;
  chapterId: number;
  verseNumber: number;
  timestamp: number;
}

export interface BookmarkStore {
  source: "localStorage";
  bookmarks: Bookmark[];
  addBookmark: (chapterId: number, verseNumber: number) => void;
  removeBookmark: (verseKey: string) => void;
  isBookmarked: (verseKey: string) => boolean;
}

const STORAGE_KEY = "quran-bookmarks";
const BOOKMARKS_UPDATED_EVENT = "quran-bookmarks-updated";
const BookmarksContext = createContext<BookmarkStore | null>(null);
const EMPTY_BOOKMARKS: Bookmark[] = [];

let cachedBookmarksRaw: string | null = null;
let cachedBookmarksSnapshot: Bookmark[] = EMPTY_BOOKMARKS;

function loadBookmarks(): Bookmark[] {
  if (typeof window === "undefined") {
    return EMPTY_BOOKMARKS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      cachedBookmarksRaw = null;
      cachedBookmarksSnapshot = EMPTY_BOOKMARKS;
      return cachedBookmarksSnapshot;
    }

    if (raw === cachedBookmarksRaw) {
      return cachedBookmarksSnapshot;
    }

    cachedBookmarksRaw = raw;
    cachedBookmarksSnapshot = JSON.parse(raw) as Bookmark[];
    return cachedBookmarksSnapshot;
  } catch {
    cachedBookmarksRaw = null;
    cachedBookmarksSnapshot = EMPTY_BOOKMARKS;
    return cachedBookmarksSnapshot;
  }
}

function saveBookmarks(bookmarks: Bookmark[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    window.dispatchEvent(new Event(BOOKMARKS_UPDATED_EVENT));
  } catch {
    // Ignore localStorage persistence errors and keep the UI responsive.
  }
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };
  const handleLocalChange = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(BOOKMARKS_UPDATED_EVENT, handleLocalChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(BOOKMARKS_UPDATED_EVENT, handleLocalChange);
  };
}

function getBookmarksSnapshot(): Bookmark[] {
  return loadBookmarks();
}

function getServerSnapshot(): Bookmark[] {
  return EMPTY_BOOKMARKS;
}

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const bookmarks = useSyncExternalStore(
    subscribe,
    getBookmarksSnapshot,
    getServerSnapshot
  );

  const addBookmark = useCallback(
    (chapterId: number, verseNumber: number) => {
      const verseKey = `${chapterId}:${verseNumber}`;

      if (bookmarks.some((bookmark) => bookmark.verseKey === verseKey)) {
        return;
      }

      saveBookmarks([
        ...bookmarks,
        {
          verseKey,
          chapterId,
          verseNumber,
          timestamp: Date.now(),
        },
      ]);
    },
    [bookmarks]
  );

  const removeBookmark = useCallback(
    (verseKey: string) => {
      saveBookmarks(
        bookmarks.filter((bookmark) => bookmark.verseKey !== verseKey)
      );
    },
    [bookmarks]
  );

  const isBookmarked = useCallback(
    (verseKey: string) =>
      bookmarks.some((bookmark) => bookmark.verseKey === verseKey),
    [bookmarks]
  );

  const value: BookmarkStore = {
    source: "localStorage",
    bookmarks,
    addBookmark,
    removeBookmark,
    isBookmarked,
  };

  return (
    <BookmarksContext.Provider value={value}>
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks(): BookmarkStore {
  const context = useContext(BookmarksContext);

  if (!context) {
    throw new Error("useBookmarks must be used within BookmarksProvider");
  }

  return context;
}
