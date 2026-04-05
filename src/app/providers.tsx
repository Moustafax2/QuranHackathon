"use client";

import { AudioProvider, AudioPlayerBar } from "@/components/quran/AudioPlayer";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { BookmarksProvider } from "@/lib/user-state/bookmarks";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <BookmarksProvider>
      <AudioProvider>
        {children}
        <AudioPlayerBar />
        <ServiceWorkerRegister />
      </AudioProvider>
    </BookmarksProvider>
  );
}
