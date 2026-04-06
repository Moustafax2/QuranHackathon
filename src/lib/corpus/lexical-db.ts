import type { LexicalEntry } from "@/lib/types/flashcard";
import { CardType } from "@/lib/types/flashcard";

let cachedDB: LexicalEntry[] = [];

export async function loadLexicalDB(): Promise<LexicalEntry[]> {
  if (cachedDB.length > 0) return cachedDB;
  
  try {
    const response = await fetch("/data/lexical-db.json");
    if (!response.ok) {
      console.warn("Lexical DB not found, using mock data");
      cachedDB = getMockData();
      return cachedDB;
    }
    const data = await response.json();
    cachedDB = data.entries || [];
    return cachedDB;
  } catch (error) {
    console.error("Failed to load lexical DB:", error);
    cachedDB = getMockData();
    return cachedDB;
  }
}

export async function getWordById(id: string): Promise<LexicalEntry | null> {
  await loadLexicalDB();
  if (cachedDB.length === 0) return null;
  return cachedDB.find((entry) => entry.id === id) || null;
}

export async function getWordsBySurah(surahNumber: number): Promise<LexicalEntry[]> {
  await loadLexicalDB();
  if (cachedDB.length === 0) return [];
  return cachedDB.filter((entry) =>
    entry.examples.some((ex) => ex.surah === surahNumber)
  );
}

export async function searchWords(query: string): Promise<LexicalEntry[]> {
  await loadLexicalDB();
  if (cachedDB.length === 0) return [];
  const lowerQuery = query.toLowerCase();
  return cachedDB.filter(
    (entry) =>
      entry.canonical_form.includes(query) ||
      entry.translation.toLowerCase().includes(lowerQuery) ||
      entry.root?.includes(query)
  );
}

function getMockData(): LexicalEntry[] {
  return [
    {
      id: "v_amana_001",
      type: CardType.VERB,
      canonical_form: "آمَنَ",
      root: "ء م ن",
      forms: {
        past: "آمَنَ",
        present: "يُؤْمِنُ",
        imperative: "آمِنْ",
        verbal_noun: "إِيمَانٌ",
      },
      translation: "to believe",
      examples: [{ surah: 2, ayah: 3, position: 2 }],
      source: "mock",
      frequency: 100,
    },
    {
      id: "n_kitab_001",
      type: CardType.NOUN,
      canonical_form: "كِتَابٌ",
      root: "ك ت ب",
      lemma: "كتاب",
      forms: {
        singular: "كِتَابٌ",
        plural: "كُتُبٌ",
      },
      translation: "book",
      examples: [{ surah: 2, ayah: 2, position: 3 }],
      source: "mock",
      frequency: 80,
    },
    {
      id: "p_min_001",
      type: CardType.PARTICLE,
      canonical_form: "مِنْ",
      translation: "from",
      examples: [{ surah: 1, ayah: 1, position: 1 }],
      source: "mock",
      frequency: 200,
    },
  ];
}
