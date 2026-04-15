import type { LexicalEntry, VerbForms, NounForms } from "@/lib/types/flashcard";
import { CardType } from "@/lib/types/flashcard";
import { ensureCompleteVerbForms, derive3MSPresent } from "./verb-generator";
import { getQutrubConjugation, detectFutureType } from "./qutrub-integration";

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
  // Only use PERF 3MS — other persons/numbers are not the canonical past form.
  // If absent, return undefined so the fallback chain (Qutrub/verb-generator) derives it.
  const perfect3ms = verbWords.find(
    (w) => w.tense === "PERF" && w.person === "3MS" && !w.is_passive
  );
  return perfect3ms?.text;
}

function chooseVerbPresent(verbWords: RawWord[]): string | undefined {
  const imperfect3ms = verbWords.find(
    (w) => w.tense === "IMPF" && w.person === "3MS" && !w.is_passive
  );
  if (imperfect3ms) {
    return imperfect3ms.text;
  }

  // No 3MS in corpus — try to derive it from any other IMPF active form
  const imperfect = verbWords.find(
    (w) => w.tense === "IMPF" && !w.is_passive
  );
  if (imperfect) {
    return derive3MSPresent(imperfect.text) ?? imperfect.text;
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

// Hard-coded corrections for verbs where the corpus + fallback chain produces wrong forms.
// Hollow/weak verbs whose 3MS perfect never appears in the Quran are the main culprits.
// Key: Arabic root as stored in the DB (no spaces for roots stored that way).
const VERB_FORM_OVERRIDES: Record<string, Partial<VerbForms>> = {
  "عوذ": { past: "عَاذَ", present: "يَعُوذُ", imperative: "عُذْ" },
};

// PHASE 1: Extract verb forms directly from corpus data (primary source).
// Mapping: past → PERF, present → IMPF, command → IMPV, masdar → noun with VN feature.
function extractCorpusForms(verbWords: RawWord[], allWords: RawWord[]): Partial<VerbForms> {
  return {
    past: chooseVerbPast(verbWords),
    present: chooseVerbPresent(verbWords),
    imperative: chooseVerbImperative(verbWords),
    verbal_noun: chooseVerbalNoun(allWords),
  };
}

// PHASE 2: Fallback enrichment — fills any forms still missing after corpus extraction.
// Uses Qutrub conjugation (for weak/defective verbs) then verb-generator as final backup.
function enrichWithFallbacks(
  root: string,
  corpusForms: Partial<VerbForms>
): VerbForms {
  let { past, present, imperative, verbal_noun: verbalNoun } = corpusForms;

  const hasMissingForms = past === undefined || present === undefined || imperative === undefined;

  if (hasMissingForms && root) {
    try {
      const futureType = detectFutureType(present);
      console.log(`    [qutrub] root=${root} futureType=${futureType} missing=${[!past && "past", !present && "present", !imperative && "imp"].filter(Boolean).join(",")}`);
      const qutrubResult = getQutrubConjugation(root, futureType);

      if (qutrubResult.success) {
        const filled: string[] = [];
        if (!past || past === "-") { past = qutrubResult.past_3ms !== "-" ? qutrubResult.past_3ms : past; if (past && past !== "-") filled.push(`past=${past}`); }
        if (!present || present === "-") { present = qutrubResult.present_3ms !== "-" ? qutrubResult.present_3ms : present; if (present && present !== "-") filled.push(`present=${present}`); }
        if (!imperative || imperative === "-") { imperative = qutrubResult.imperative_2ms !== "-" ? qutrubResult.imperative_2ms : imperative; if (imperative && imperative !== "-") filled.push(`imp=${imperative}`); }
        console.log(`    [qutrub] ✓ filled: ${filled.length ? filled.join(" ") : "(nothing new)"}`);
      } else {
        console.log(`    [qutrub] ✗ failed: ${qutrubResult.error}`);
      }
    } catch (error) {
      console.warn(`    [qutrub] ✗ exception for root ${root}:`, error);
    }
  }

  return ensureCompleteVerbForms(root, { past, present, imperative, verbal_noun: verbalNoun });
}

export function normalizeVerb(words: RawWord[]): LexicalEntry | null {
  const verbWords = words.filter((w) => w.pos?.startsWith("V"));
  if (verbWords.length === 0) return null;

  const root = verbWords[0].root || "";

  // Phase 1: source from corpus
  const corpusForms = extractCorpusForms(verbWords, words);

  // Phase 2: fill any gaps via Qutrub + verb-generator (backup)
  const completeForms = enrichWithFallbacks(root, corpusForms);

  // Phase 3: apply manual overrides for roots where the pipeline produces wrong forms
  const override = VERB_FORM_OVERRIDES[root];
  if (override) Object.assign(completeForms, override);

  const lemma = completeForms.past !== "-" ? completeForms.past :
                completeForms.present !== "-" ? completeForms.present :
                completeForms.imperative;

  const translation = verbWords[0].translation || "";
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
    forms: completeForms,
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
