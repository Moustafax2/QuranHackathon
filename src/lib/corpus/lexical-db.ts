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

  // Exact match
  const exact = cachedDB.find((entry) => entry.id === id);
  if (exact) return exact;

  // Fuzzy fallback for IDs that changed after a DB rebuild.
  // ID formats:
  //   verb:     v_{root_underscores}_{lemma_prefix3}
  //   noun:     n_{lemma_prefix5}_{root_prefix3}
  //   particle: p_{text_prefix5}_001
  // Roots are stable (come directly from corpus), so we match on root + type.
  const parts = id.split("_");
  if (parts.length >= 3) {
    const typePrefix = parts[0];
    if (typePrefix === "v") {
      // root is everything between v_ and the last _
      const rootJoined = parts.slice(1, -1).join("_");
      const rootNoSep = rootJoined.replace(/_/g, "");
      const match = cachedDB.find(
        (e) =>
          e.type === CardType.VERB &&
          e.root &&
          e.root.replace(/[\s_]/g, "") === rootNoSep
      );
      if (match) return match;
    } else if (typePrefix === "n") {
      // last part is the first 3 chars of the root
      const rootPrefix = parts[parts.length - 1];
      const match = cachedDB.find(
        (e) =>
          e.type === CardType.NOUN &&
          e.root &&
          e.root.replace(/\s/g, "").startsWith(rootPrefix)
      );
      if (match) return match;
    }
  }

  // Last resort: check mock data (covers cards saved when sample DB was active)
  const mockEntry = getMockData().find((entry) => entry.id === id);
  if (mockEntry) {
    // Try to find the equivalent real entry by root + type
    if (mockEntry.root) {
      const rootNoSep = mockEntry.root.replace(/[\s_]/g, "");
      const realEntry = cachedDB.find(
        (e) => e.type === mockEntry.type && e.root && e.root.replace(/[\s_]/g, "") === rootNoSep
      );
      if (realEntry) return realEntry;
    }
    return mockEntry;
  }

  return null;
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
    {
      id: "v_kataba_001",
      type: CardType.VERB,
      canonical_form: "كَتَبَ",
      root: "ك ت ب",
      forms: {
        past: "كَتَبَ",
        present: "يَكْتُبُ",
        imperative: "اكْتُبْ",
        verbal_noun: "كِتَابَةٌ",
      },
      translation: "to write",
      examples: [{ surah: 2, ayah: 282, position: 5 }],
      source: "mock",
      frequency: 50,
    },
    {
      id: "n_salat_001",
      type: CardType.NOUN,
      canonical_form: "صَلَاةٌ",
      root: "ص ل و",
      lemma: "صلاة",
      forms: {
        singular: "صَلَاةٌ",
        plural: "صَلَوَاتٌ",
      },
      translation: "prayer",
      examples: [{ surah: 2, ayah: 3, position: 5 }],
      source: "mock",
      frequency: 70,
    },
  ];
}
