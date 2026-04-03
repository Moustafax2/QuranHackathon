"use client";

import { AudioProvider, AudioPlayerBar } from "@/components/quran/AudioPlayer";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AudioProvider>
      {children}
      <AudioPlayerBar />
      <ServiceWorkerRegister />
    </AudioProvider>
  );
}
