import type { LexicalEntry, VerbForms, NounForms } from "@/lib/types/flashcard";
import { CardType } from "@/lib/types/flashcard";
import { ensureCompleteVerbForms } from "./verb-generator";
import { getQutrubConjugation, detectFutureType, isWeakRoot } from "./qutrub-integration";

interface RawWord {
  text: string;
  pos: string;
  root?: string;
  lemma?: string;
  buckwalter_root?: string;
  buckwalter_lemma?: string;
  verb_form?: string;
  tense?: "PERF" | "IMPF" | "IMPV";
  person?: string;
  is_passive?: boolean;
  features: string[];
  translation?: string;
  surah: number;
  ayah: number;
  position: number;
}

/**
 * Remove numeric suffix from lemma (e.g., "maE2" -> "maE")
 * The Quranic Corpus uses numeric suffixes to distinguish lemma variants
 */
function cleanLemma(lemma: string): string {
  return lemma.replace(/\d+$/, '');
}

function chooseVerbPast(verbWords: RawWord[]): string | undefined {
  const perfect3ms = verbWords.find(
    (w) => w.tense === "PERF" && w.person === "3MS" && !w.is_passive
  );
  if (perfect3ms) {
    return perfect3ms.text;
  }

  const perfectLemma = verbWords.find(
    (w) => w.tense === "PERF" && !w.is_passive && w.lemma
  );
  if (perfectLemma?.lemma) {
    const cleaned = cleanLemma(perfectLemma.lemma);
    const lastChar = cleaned[cleaned.length - 1];
    // If lemma ends in sukun (ْ), damma (ُ), or kasra (ِ), it's likely a stem form
    // Convert to fatha (َ) for 3MS past tense
    if (lastChar === 'ْ' || lastChar === 'ُ' || lastChar === 'ِ') {
      return cleaned.slice(0, -1) + 'َ';
    }
    
    return cleaned;
  }

  return undefined;
}

function chooseVerbPresent(verbWords: RawWord[]): string | undefined {
  const imperfect3ms = verbWords.find(
    (w) => w.tense === "IMPF" && w.person === "3MS" && !w.is_passive
  );
  if (imperfect3ms) {
    return imperfect3ms.text;
  }

  const imperfect = verbWords.find(
    (w) => w.tense === "IMPF" && !w.is_passive
  );
  if (imperfect) {
    return imperfect.text;
  }

  return undefined;
}

function chooseVerbImperative(verbWords: RawWord[]): string | undefined {
  const imperative2ms = verbWords.find(
    (w) => w.tense === "IMPV" && w.person === "2MS" && !w.is_passive
  );
  if (imperative2ms) {
    return imperative2ms.text;
  }

  const imperative = verbWords.find(
    (w) => w.tense === "IMPV" && !w.is_passive
  );
  if (imperative) {
    return imperative.text;
  }

  return undefined;
}

function chooseVerbalNoun(words: RawWord[]): string | undefined {
  const verbalNoun = words.find(
    (w) => w.pos.startsWith("N") && w.features.includes("VN")
  );

  if (verbalNoun) {
    return verbalNoun.text;
  }

  return undefined;
}

function chooseNounPlural(nounWords: RawWord[], singular: string): string | undefined {
  const pluralWord = nounWords.find(
    (w) =>
      (w.features.includes("MP") || w.features.includes("FP") || w.features.includes("PL")) &&
      w.text !== singular
  );

  if (pluralWord) {
    return pluralWord.text;
  }

  return undefined;
}

export function normalizeVerb(words: RawWord[]): LexicalEntry | null {
  const verbWords = words.filter((w) => w.pos?.startsWith("V"));
  if (verbWords.length === 0) return null;

  const root = verbWords[0].root || "";
  let past = chooseVerbPast(verbWords);
  let present = chooseVerbPresent(verbWords);
  let imperative = chooseVerbImperative(verbWords);
  const verbalNoun = chooseVerbalNoun(words);

  // OPTION 1 & 3: Use Qutrub as fallback for missing forms, especially weak verbs
  const hasMissingForms = past === undefined || present === undefined || imperative === undefined;
  const isWeak = root ? isWeakRoot(root) : false;
  
  if (hasMissingForms && root && (isWeak || hasMissingForms)) {
    try {
      const futureType = detectFutureType(present);
      const qutrubResult = getQutrubConjugation(root, futureType);
      
      if (qutrubResult.success) {
        // Use Qutrub for missing forms
        if (!past || past === '-') {
          past = qutrubResult.past_3ms !== '-' ? qutrubResult.past_3ms : past;
        }
        if (!present || present === '-') {
          present = qutrubResult.present_3ms !== '-' ? qutrubResult.present_3ms : present;
        }
        if (!imperative || imperative === '-') {
          imperative = qutrubResult.imperative_2ms !== '-' ? qutrubResult.imperative_2ms : imperative;
        }
      }
    } catch (error) {
      // Silently fail and continue with existing forms
      console.warn(`Qutrub fallback failed for root ${root}:`, error);
    }
  }
  
  // Use the verb generator to ensure all forms are present
  const completeForms = ensureCompleteVerbForms(root, {
    past,
    present,
    imperative,
    verbal_noun: verbalNoun,
  });
  
  const lemma = completeForms.past !== "-" ? completeForms.past : 
                completeForms.present !== "-" ? completeForms.present : 
                completeForms.imperative;
  
  const forms: VerbForms = completeForms;

  const translation = verbWords[0].translation || "";
  // Include all examples (will be deduplicated and limited per surah later)
  const examples = verbWords.map((w) => ({
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
  // Include both nouns and adjectives (ADJ are treated as nouns in Arabic)
  const nounWords = words.filter((w) => w.pos?.startsWith("N") || w.pos?.startsWith("ADJ"));
  if (nounWords.length === 0) return null;

  const rawLemma = nounWords[0].lemma || nounWords[0].text;
  const lemma = cleanLemma(rawLemma); // #agent: Remove numeric suffix
  const root = nounWords[0].root;
  const plural = chooseNounPlural(nounWords, lemma) || "-";
  
  const forms: NounForms = {
    singular: lemma,
    plural,
  };

  const translation = nounWords[0].translation || "";
  // Include all examples (will be deduplicated and limited per surah later)
  const examples = nounWords.map((w) => ({
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
  // Include all examples (will be deduplicated and limited per surah later)
  const examples = particleWords.map((w) => ({
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

  // Deduplicate examples and ensure all surahs are represented
  const deduplicated = Array.from(map.values());
  deduplicated.forEach((entry) => {
    // Remove duplicate examples
    const uniqueExamples = new Map<string, typeof entry.examples[0]>();
    entry.examples.forEach((ex) => {
      const key = `${ex.surah}:${ex.ayah}:${ex.position}`;
      if (!uniqueExamples.has(key)) {
        uniqueExamples.set(key, ex);
      }
    });
    
    // Get unique surahs and take up to 3 examples per surah
    const bySurah = new Map<number, typeof entry.examples>();
    Array.from(uniqueExamples.values()).forEach((ex) => {
      if (!bySurah.has(ex.surah)) {
        bySurah.set(ex.surah, []);
      }
      const surahExamples = bySurah.get(ex.surah)!;
      if (surahExamples.length < 3) {
        surahExamples.push(ex);
      }
    });
    
    // Flatten all examples (up to 3 per surah)
    entry.examples = Array.from(bySurah.values()).flat();
  });

  return deduplicated;
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
