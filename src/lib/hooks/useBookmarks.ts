"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth";

export interface Bookmark {
  verseKey: string;
  chapterId: number;
  verseNumber: number;
  timestamp: number;
  remoteId?: string;
}

const STORAGE_KEY = "quran-bookmarks";
const STORAGE_EVENT = "quran-bookmarks-change";

function readLocalBookmarks(): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    return [];
  }
}

function writeLocalBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

interface RemoteBookmarkResponse {
  success: boolean;
  data: {
    id: string;
    createdAt: string;
    type: string;
    key: number;
    verseNumber?: number;
  }[];
}

export function useBookmarks() {
  const { isAuthenticated } = useAuth();
  const [localBookmarks, setLocalBookmarks] = useState<Bookmark[]>([]);
  const [remoteBookmarks, setRemoteBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const syncLocal = () => setLocalBookmarks(readLocalBookmarks());
    syncLocal();

    window.addEventListener("storage", syncLocal);
    window.addEventListener(STORAGE_EVENT, syncLocal);
    return () => {
      window.removeEventListener("storage", syncLocal);
      window.removeEventListener(STORAGE_EVENT, syncLocal);
    };
  }, []);

  const refreshRemote = useCallback(async () => {
    if (!isAuthenticated) {
      setRemoteBookmarks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/qf/bookmarks", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to fetch synced bookmarks.");
      }

      const payload = (await response.json()) as RemoteBookmarkResponse;
      const bookmarks = payload.data
        .filter((item) => item.type === "ayah" && item.verseNumber)
        .map((item) => ({
          verseKey: `${item.key}:${item.verseNumber}`,
          chapterId: item.key,
          verseNumber: item.verseNumber!,
          timestamp: Date.parse(item.createdAt) || Date.now(),
          remoteId: item.id,
        }));
      setRemoteBookmarks(bookmarks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch synced bookmarks.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshRemote();
  }, [refreshRemote]);

  const bookmarks = useMemo(
    () => (isAuthenticated ? remoteBookmarks : localBookmarks),
    [isAuthenticated, localBookmarks, remoteBookmarks]
  );

  const addBookmark = useCallback(
    async (chapterId: number, verseNumber: number) => {
      const verseKey = `${chapterId}:${verseNumber}`;

      if (!isAuthenticated) {
        const current = readLocalBookmarks();
        if (current.some((bookmark) => bookmark.verseKey === verseKey)) return;
        writeLocalBookmarks([
          ...current,
          { verseKey, chapterId, verseNumber, timestamp: Date.now() },
        ]);
        setLocalBookmarks(readLocalBookmarks());
        return;
      }

      const optimistic: Bookmark = {
        verseKey,
        chapterId,
        verseNumber,
        timestamp: Date.now(),
      };
      setRemoteBookmarks((current) =>
        current.some((bookmark) => bookmark.verseKey === verseKey)
          ? current
          : [...current, optimistic]
      );

      try {
        const response = await fetch("/api/auth/qf/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterId, verseNumber }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to save bookmark.");
        }
        await refreshRemote();
      } catch (err) {
        setRemoteBookmarks((current) =>
          current.filter((bookmark) => bookmark.verseKey !== verseKey)
        );
        setError(err instanceof Error ? err.message : "Failed to save bookmark.");
      }
    },
    [isAuthenticated, refreshRemote]
  );

  const removeBookmark = useCallback(
    async (verseKey: string) => {
      if (!isAuthenticated) {
        const next = readLocalBookmarks().filter((bookmark) => bookmark.verseKey !== verseKey);
        writeLocalBookmarks(next);
        setLocalBookmarks(next);
        return;
      }

      const target = remoteBookmarks.find((bookmark) => bookmark.verseKey === verseKey);
      if (!target?.remoteId) {
        setRemoteBookmarks((current) =>
          current.filter((bookmark) => bookmark.verseKey !== verseKey)
        );
        return;
      }

      const previous = remoteBookmarks;
      setRemoteBookmarks((current) =>
        current.filter((bookmark) => bookmark.verseKey !== verseKey)
      );

      try {
        const response = await fetch("/api/auth/qf/bookmarks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmarkId: target.remoteId }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to remove bookmark.");
        }
      } catch (err) {
        setRemoteBookmarks(previous);
        setError(err instanceof Error ? err.message : "Failed to remove bookmark.");
      }
    },
    [isAuthenticated, remoteBookmarks]
  );

  const isBookmarked = useCallback(
    (verseKey: string) => bookmarks.some((bookmark) => bookmark.verseKey === verseKey),
    [bookmarks]
  );

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    isBookmarked,
    loading,
    error,
    provider: isAuthenticated ? "qf" : "local",
    refresh: refreshRemote,
  };
}
