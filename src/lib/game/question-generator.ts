import "server-only";

const QURAN_API = "https://api.quran.com/api/v4";

interface Verse {
  verse_key: string;
  text_uthmani: string;
}

interface VerseWord {
  position: number;
  text_uthmani: string;
  translation: { text: string } | null;
}

interface VerseWithWords extends Verse {
  words: VerseWord[];
}

export interface GeneratedQuestion {
  prompt_verse_key: string;
  prompt_text: string;
  correct_verse_key: string;
  correct_text: string;
  options: { verse_key: string; text: string }[];
  game_mode: string;
}

async function fetchSurahVerses(surahId: number): Promise<Verse[]> {
  const res = await fetch(
    `${QURAN_API}/verses/by_chapter/${surahId}?language=en&fields=text_uthmani&per_page=300`,
    { cache: "force-cache" }
  );
  const data = await res.json() as { verses: { verse_key: string; text_uthmani: string }[] };
  return data.verses.map((v) => ({ verse_key: v.verse_key, text_uthmani: v.text_uthmani }));
}

async function fetchSurahVersesWithWords(surahId: number): Promise<VerseWithWords[]> {
  const res = await fetch(
    `${QURAN_API}/verses/by_chapter/${surahId}?language=en&words=true&word_fields=text_uthmani,translation_text&fields=text_uthmani&per_page=300`,
    { cache: "force-cache" }
  );
  const data = await res.json() as {
    verses: {
      verse_key: string;
      text_uthmani: string;
      words?: {
        position: number;
        text_uthmani: string;
        translation?: { text?: string | null } | null;
      }[];
    }[];
  };

  return data.verses.map((v) => ({
    verse_key: v.verse_key,
    text_uthmani: v.text_uthmani,
    words: (v.words ?? []).map((w) => ({
      position: w.position,
      text_uthmani: w.text_uthmani,
      translation: w.translation?.text ? { text: w.translation.text } : null,
    })),
  }));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL_SURAHS = Array.from({ length: 114 }, (_, i) => i + 1);

// Surah → primary juz (first juz the surah starts in)
const SURAH_JUZ: Record<number, number> = {
  1:1,2:1,3:3,4:4,5:6,6:7,7:8,8:9,9:10,10:11,11:11,12:12,13:13,14:13,15:14,
  16:14,17:15,18:15,19:16,20:16,21:17,22:17,23:18,24:18,25:18,26:19,27:19,
  28:20,29:20,30:21,31:21,32:21,33:21,34:22,35:22,36:22,37:23,38:23,39:23,
  40:24,41:24,42:25,43:25,44:25,45:25,46:26,47:26,48:26,49:26,50:26,51:27,
  52:27,53:27,54:27,55:27,56:27,57:27,58:28,59:28,60:28,61:28,62:28,63:28,
  64:28,65:28,66:28,67:29,68:29,69:29,70:29,71:29,72:29,73:29,74:29,75:29,
  76:29,77:29,78:30,79:30,80:30,81:30,82:30,83:30,84:30,85:30,86:30,87:30,
  88:30,89:30,90:30,91:30,92:30,93:30,94:30,95:30,96:30,97:30,98:30,99:30,
  100:30,101:30,102:30,103:30,104:30,105:30,106:30,107:30,108:30,109:30,
  110:30,111:30,112:30,113:30,114:30,
};

export function surahsForJuzList(juzList: number[]): number[] {
  const juzSet = new Set(juzList);
  return ALL_SURAHS.filter((s) => juzSet.has(SURAH_JUZ[s]));
}

export function resolveSurahPool(settings: {
  scope?: string;
  surah_filter?: number[] | null;
  juz_filter?: number[] | null;
}): number[] | null {
  if (settings.scope === "surah" && settings.surah_filter?.length) {
    return settings.surah_filter;
  }
  if (settings.scope === "juz" && settings.juz_filter?.length) {
    return surahsForJuzList(settings.juz_filter);
  }
  return null; // null = all Quran
}

const SKIP_MEANINGS = new Set([
  "and", "or", "but", "so", "then", "that", "the", "a", "an", "of", "in",
  "on", "to", "is", "are", "was", "were", "it", "he", "she", "they", "we",
  "not", "no", "with", "for", "from", "at", "by", "be", "as", "if",
]);

function normalizeMeaning(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function isContentMeaning(meaning: string): boolean {
  const cleaned = normalizeMeaning(meaning).toLowerCase();
  if (!cleaned || cleaned.length < 3) return false;
  if (SKIP_MEANINGS.has(cleaned)) return false;
  if (/^\(?\d+\)?$/.test(cleaned)) return false;
  return true;
}

function makeFillInBlankQuestion(
  prompt: Verse,
  verseCache: Map<number, Verse[]>
): GeneratedQuestion | null {
  const words = prompt.text_uthmani.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 3) return null;

  const wordIdx = randInt(1, words.length - 1);
  const blankWord = words[wordIdx];
  const blankedText = words.map((w, i) => (i === wordIdx ? "___" : w)).join(" ");

  const distractors: string[] = [];
  for (const verseList of verseCache.values()) {
    for (const v of verseList) {
      const ws = v.text_uthmani
        .split(/\s+/)
        .filter((w) => w.length > 2 && w !== blankWord);
      if (ws.length) distractors.push(ws[randInt(0, ws.length)]);
      if (distractors.length >= 9) break;
    }
    if (distractors.length >= 9) break;
  }

  const distractorWords = shuffle(distractors).slice(0, 3);
  if (distractorWords.length < 3) return null;

  const correctKey = `fill:${prompt.verse_key}:${wordIdx}`;

  const options = shuffle([
    { verse_key: correctKey, text: blankWord },
    ...distractorWords.map((w, i) => ({
      verse_key: `fill:wrong${i}:${prompt.verse_key}`,
      text: w,
    })),
  ]);

  return {
    prompt_verse_key: prompt.verse_key,
    prompt_text: blankedText,
    correct_verse_key: correctKey,
    correct_text: blankWord,
    options,
    game_mode: "", // filled in by caller
  };
}

function makeWordMeaningQuestion(
  prompt: VerseWithWords,
  verseCache: Map<number, VerseWithWords[]>
): GeneratedQuestion | null {
  const candidateWords = prompt.words.filter(
    (word) => word.text_uthmani && word.translation?.text && isContentMeaning(word.translation.text)
  );
  if (candidateWords.length === 0) return null;

  const chosenWord = candidateWords[randInt(0, candidateWords.length)];
  const correctMeaning = normalizeMeaning(chosenWord.translation!.text);
  const seenMeanings = new Set([correctMeaning.toLowerCase()]);
  const distractorMeanings: string[] = [];

  for (const verseList of verseCache.values()) {
    for (const verse of verseList) {
      for (const word of verse.words) {
        const meaning = word.translation?.text;
        if (!meaning || !isContentMeaning(meaning)) continue;
        const normalized = normalizeMeaning(meaning);
        const key = normalized.toLowerCase();
        if (seenMeanings.has(key)) continue;
        seenMeanings.add(key);
        distractorMeanings.push(normalized);
        if (distractorMeanings.length >= 3) break;
      }
      if (distractorMeanings.length >= 3) break;
    }
    if (distractorMeanings.length >= 3) break;
  }

  if (distractorMeanings.length < 3) return null;

  const correctKey = `meaning:${prompt.verse_key}:${chosenWord.position}`;
  const options = shuffle([
    { verse_key: correctKey, text: correctMeaning },
    ...distractorMeanings.slice(0, 3).map((meaning, index) => ({
      verse_key: `meaning:wrong${index}:${prompt.verse_key}:${chosenWord.position}`,
      text: meaning,
    })),
  ]);

  return {
    prompt_verse_key: prompt.verse_key,
    prompt_text: chosenWord.text_uthmani,
    correct_verse_key: correctKey,
    correct_text: correctMeaning,
    options,
    game_mode: "word-meaning",
  };
}

export async function generateQuestions(
  numRounds: number,
  gameModes: string[],
  surahFilter: number[] | null
): Promise<GeneratedQuestion[]> {
  const pool = surahFilter?.length ? surahFilter : ALL_SURAHS;

  // Pre-fetch a selection of surahs
  const surahsToFetch = new Set<number>();
  for (let i = 0; i < numRounds; i++) {
    surahsToFetch.add(pool[randInt(0, pool.length)]);
  }
  while (surahsToFetch.size < Math.min(3, pool.length)) {
    surahsToFetch.add(pool[randInt(0, pool.length)]);
  }

  const verseCache = new Map<number, Verse[]>();
  const verseCacheWithWords = new Map<number, VerseWithWords[]>();
  await Promise.all(
    [...surahsToFetch].map(async (surahId) => {
      const needsWordData = gameModes.includes("word-meaning");
      const verses = needsWordData
        ? await fetchSurahVersesWithWords(surahId)
        : await fetchSurahVerses(surahId);
      verseCache.set(surahId, verses);
      if (needsWordData) {
        verseCacheWithWords.set(surahId, verses as VerseWithWords[]);
      }
    })
  );

  const questions: GeneratedQuestion[] = [];
  const usedPrompts = new Set<string>();
  let retries = 0;

  for (let i = 0; i < numRounds; i++) {
    const surahIds = [...verseCache.keys()];
    const surahId = surahIds[randInt(0, surahIds.length)];
    const verses = verseCache.get(surahId)!;

    if (verses.length < 2) continue;

    let promptIdx: number;
    let attempts = 0;
    do {
      promptIdx = randInt(0, verses.length - 1);
      attempts++;
    } while (usedPrompts.has(verses[promptIdx].verse_key) && attempts < 20);

    const prompt = verses[promptIdx];
    const correct = verses[promptIdx + 1];
    usedPrompts.add(prompt.verse_key);

    // Deterministically assign modes: distribute evenly, not randomly, so you
    // always get a fair spread across all selected modes.
    const gameMode = gameModes[i % gameModes.length];

    if (gameMode === "buzzer") {
      questions.push({
        prompt_verse_key: prompt.verse_key,
        prompt_text: prompt.text_uthmani,
        correct_verse_key: correct.verse_key,
        correct_text: correct.text_uthmani,
        options: [],
        game_mode: "buzzer",
      });
    } else if (gameMode === "word-meaning") {
      const promptWithWords = verseCacheWithWords.get(surahId)?.[promptIdx];
      const q = promptWithWords
        ? makeWordMeaningQuestion(promptWithWords, verseCacheWithWords)
        : null;
      if (q) {
        retries = 0;
        questions.push(q);
      } else if (++retries <= numRounds * 3) {
        i--; // retry this slot
      }
    } else if (gameMode === "fill-in-blank") {
      const q = makeFillInBlankQuestion(prompt, verseCache);
      if (q) {
        retries = 0;
        questions.push({ ...q, game_mode: "fill-in-blank" });
      } else if (++retries <= numRounds * 3) {
        i--; // retry this slot
      }
    } else {
      // multiple-choice
      const distractorPool = verses.filter(
        (_, idx) => idx !== promptIdx && idx !== promptIdx + 1
      );

      if (distractorPool.length < 3) {
        const otherSurahId = surahIds.find((id) => id !== surahId);
        if (otherSurahId) {
          distractorPool.push(
            ...verseCache.get(otherSurahId)!.slice(0, 3 - distractorPool.length)
          );
        }
      }

      const distractors = shuffle(distractorPool).slice(0, 3);
      const options = shuffle([
        { verse_key: correct.verse_key, text: correct.text_uthmani },
        ...distractors.map((d) => ({ verse_key: d.verse_key, text: d.text_uthmani })),
      ]);

      questions.push({
        prompt_verse_key: prompt.verse_key,
        prompt_text: prompt.text_uthmani,
        correct_verse_key: correct.verse_key,
        correct_text: correct.text_uthmani,
        options,
        game_mode: "multiple-choice",
      });
    }
  }

  return questions;
}
