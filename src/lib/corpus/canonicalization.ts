import type { LexicalEntry, VerbForms, NounForms } from "@/lib/types/flashcard";
import { CardType } from "@/lib/types/flashcard";

interface RawWord {
  text: string;
  pos: string;
  root?: string;
  lemma?: string;
  translation?: string;
  surah: number;
  ayah: number;
  position: number;
}

// #region agent log
/**
 * Remove numeric suffix from lemma (e.g., "maE2" -> "maE")
 * The Quranic Corpus uses numeric suffixes to distinguish lemma variants
 */
function cleanLemma(lemma: string): string {
  return lemma.replace(/\d+$/, '');
}
// #endregion

export function normalizeVerb(words: RawWord[]): LexicalEntry | null {
  const verbWords = words.filter((w) => w.pos?.startsWith("V"));
  if (verbWords.length === 0) return null;

  const root = verbWords[0].root || "";
  const rawLemma = verbWords[0].lemma || verbWords[0].text;
  const lemma = cleanLemma(rawLemma); // #agent: Remove numeric suffix
  
  const forms: VerbForms = {
    past: lemma,
    present: lemma,
  };

  const translation = verbWords[0].translation || "";
  const examples = verbWords.slice(0, 3).map((w) => ({
    surah: w.surah,
    ayah: w.ayah,
    position: w.position,
  }));

  return {
    id: `v_${root.replace(/\s/g, "_")}_${lemma.substring(0, 3)}`,
    type: CardType.VERB,
    canonical_form: lemma,
    root,
    lemma,
    forms,
    translation,
    examples,
    source: "corpus",
    frequency: verbWords.length,
  };
}

export function normalizeNoun(words: RawWord[]): LexicalEntry | null {
  const nounWords = words.filter((w) => w.pos?.startsWith("N"));
  if (nounWords.length === 0) return null;

  const rawLemma = nounWords[0].lemma || nounWords[0].text;
  const lemma = cleanLemma(rawLemma); // #agent: Remove numeric suffix
  const root = nounWords[0].root;
  
  const forms: NounForms = {
    singular: lemma,
  };

  const translation = nounWords[0].translation || "";
  const examples = nounWords.slice(0, 3).map((w) => ({
    surah: w.surah,
    ayah: w.ayah,
    position: w.position,
  }));

  return {
    id: `n_${lemma.substring(0, 5)}_${root?.substring(0, 3) || "000"}`,
    type: CardType.NOUN,
    canonical_form: lemma,
    root,
    lemma,
    forms,
    translation,
    examples,
    source: "corpus",
    frequency: nounWords.length,
  };
}

export function normalizeParticle(words: RawWord[]): LexicalEntry | null {
  const particleWords = words.filter((w) => w.pos?.startsWith("P"));
  if (particleWords.length === 0) return null;

  // Use lemma if available (cleaned), otherwise use text
  const rawLemma = particleWords[0].lemma || particleWords[0].text;
  const text = cleanLemma(rawLemma); // #agent: Remove numeric suffix
  
  if (hasAttachedPronoun(text)) {
    return null;
  }

  const translation = particleWords[0].translation || "";
  const examples = particleWords.slice(0, 3).map((w) => ({
    surah: w.surah,
    ayah: w.ayah,
    position: w.position,
  }));

  return {
    id: `p_${text.substring(0, 5)}_001`,
    type: CardType.PARTICLE,
    canonical_form: text,
    translation,
    examples,
    source: "corpus",
    frequency: particleWords.length,
  };
}

function hasAttachedPronoun(text: string): boolean {
  const pronounSuffixes = ["ه", "ها", "هم", "هن", "ك", "كم", "كن", "ي", "نا"];
  return pronounSuffixes.some((suffix) => text.endsWith(suffix) && text.length > 2);
}

export function deduplicateEntries(entries: LexicalEntry[]): LexicalEntry[] {
  const map = new Map<string, LexicalEntry>();

  entries.forEach((entry) => {
    const existing = map.get(entry.id);
    if (!existing) {
      map.set(entry.id, entry);
    } else {
      existing.examples.push(...entry.examples);
      existing.frequency = (existing.frequency || 0) + (entry.frequency || 0);
    }
  });

  return Array.from(map.values());
}

export function createCanonicalKey(
  type: CardType,
  root?: string,
  lemma?: string,
  text?: string
): string {
  if (type === CardType.VERB && root) {
    return `v_${root}`;
  }
  if (type === CardType.NOUN && lemma) {
    return `n_${lemma}`;
  }
  if (type === CardType.PARTICLE && text) {
    return `p_${text}`;
  }
  return `unknown_${Date.now()}`;
}
