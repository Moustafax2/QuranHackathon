"use client";

import { addFlashcard } from "@/lib/storage/flashcard-storage-supabase";
import { createNewCard } from "@/lib/fsrs/scheduler";
import { WordStatus } from "@/lib/types/flashcard";
import type { UserFlashcard } from "@/lib/types/flashcard";

export async function addDemoCards(): Promise<void> {
  const demoWordIds = ["v_amana_001", "n_kitab_001", "p_min_001", "v_kataba_001", "n_salat_001"];
  
  const promises = demoWordIds.map(async (wordId) => {
    const card: UserFlashcard = {
      id: crypto.randomUUID(),
      word_id: wordId,
      fsrs_state: createNewCard(),
      created_at: new Date(),
      status: WordStatus.IN_BANK,
    };
    await addFlashcard(card);
  });

  await Promise.all(promises);
  console.log("✓ Added 5 demo cards to your deck!");
}
