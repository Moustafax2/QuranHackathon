import "server-only";

import { pickTriviaQuestions } from "@/lib/data/trivia-questions";

const QURAN_API = "https://api.quran.com/api/v4";

interface Verse {
  verse_key: string;
  text_uthmani: string;
  page_number: number;
  juz_number: number;
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
  prompt_surah_id: number | null;
  prompt_juz_number: number | null;
  prompt_page_number: number | null;
  correct_verse_key: string;
  correct_text: string;
  options: { verse_key: string; text: string }[];
  game_mode: string;
}

type RawVerse = {
  verse_key: string;
  text_uthmani: string;
  page_number: number;
  juz_number: number;
  words?: {
    position: number;
    text_uthmani: string;
    translation?: { text?: string | null } | null;
  }[];
};

type QuranVersesResponse = {
  verses: RawVerse[];
  pagination?: {
    total_pages?: number;
  };
};

interface QuestionDistributionSettings {
  scope?: string;
  surah_filter?: number[] | null;
  juz_filter?: number[] | null;
}

type DistributionGroup =
  | { id: string; kind: "juz"; value: number }
  | { id: string; kind: "surah"; value: number };

interface GroupVerseData {
  group: DistributionGroup;
  verses: Verse[];
  versesWithWords?: VerseWithWords[];
}

async function fetchVersePage(
  path: string,
  page: number,
  includeWords: boolean
): Promise<QuranVersesResponse> {
  const params = new URLSearchParams({
    language: "en",
    fields: "text_uthmani,page_number,juz_number",
    per_page: "300",
    page: String(page),
  });

  if (includeWords) {
    params.set("words", "true");
    params.set("word_fields", "text_uthmani,translation_text");
  }

  const res = await fetch(`${QURAN_API}${path}?${params.toString()}`, {
    cache: "force-cache",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Quran verses (${res.status})`);
  }

  return await res.json() as QuranVersesResponse;
}

function normalizeVerse(v: RawVerse): Verse {
  return {
    verse_key: v.verse_key,
    text_uthmani: v.text_uthmani,
    page_number: v.page_number,
    juz_number: v.juz_number,
  };
}

function normalizeVerseWithWords(v: RawVerse): VerseWithWords {
  return {
    ...normalizeVerse(v),
    words: (v.words ?? []).map((w) => ({
      position: w.position,
      text_uthmani: w.text_uthmani,
      translation: w.translation?.text ? { text: w.translation.text } : null,
    })),
  };
}

async function fetchVerses(path: string): Promise<Verse[]> {
  const firstPage = await fetchVersePage(path, 1, false);
  const totalPages = firstPage.pagination?.total_pages ?? 1;
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      fetchVersePage(path, i + 2, false)
    )
  );

  return [firstPage, ...remainingPages]
    .flatMap((response) => response.verses)
    .map(normalizeVerse);
}

async function fetchVersesWithWords(path: string): Promise<VerseWithWords[]> {
  const firstPage = await fetchVersePage(path, 1, true);
  const totalPages = firstPage.pagination?.total_pages ?? 1;
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      fetchVersePage(path, i + 2, true)
    )
  );

  return [firstPage, ...remainingPages]
    .flatMap((response) => response.verses)
    .map(normalizeVerseWithWords);
}

async function fetchGroupVerses(
  group: DistributionGroup,
  includeWords: boolean
): Promise<GroupVerseData> {
  const path = group.kind === "juz"
    ? `/verses/by_juz/${group.value}`
    : `/verses/by_chapter/${group.value}`;
  const verses = includeWords ? await fetchVersesWithWords(path) : await fetchVerses(path);

  return {
    group,
    verses,
    versesWithWords: includeWords ? verses as VerseWithWords[] : undefined,
  };
}

function getPromptSurahId(promptVerseKey: string): number | null {
  const surahId = Number(promptVerseKey.split(":")[0]);
  return Number.isFinite(surahId) ? surahId : null;
}

function buildPromptMeta(prompt: Verse) {
  return {
    prompt_surah_id: getPromptSurahId(prompt.verse_key),
    prompt_juz_number: prompt.juz_number,
    prompt_page_number: prompt.page_number,
  };
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
const ALL_JUZ = Array.from({ length: 30 }, (_, i) => i + 1);

const JUZ_SURAH_RANGES: Record<number, { start: number; end: number }> = {
  1: { start: 1, end: 2 },
  2: { start: 2, end: 2 },
  3: { start: 2, end: 3 },
  4: { start: 3, end: 4 },
  5: { start: 4, end: 4 },
  6: { start: 4, end: 5 },
  7: { start: 5, end: 6 },
  8: { start: 6, end: 7 },
  9: { start: 7, end: 8 },
  10: { start: 8, end: 9 },
  11: { start: 9, end: 11 },
  12: { start: 11, end: 12 },
  13: { start: 12, end: 14 },
  14: { start: 15, end: 16 },
  15: { start: 17, end: 18 },
  16: { start: 18, end: 20 },
  17: { start: 21, end: 22 },
  18: { start: 23, end: 25 },
  19: { start: 25, end: 27 },
  20: { start: 27, end: 29 },
  21: { start: 29, end: 33 },
  22: { start: 33, end: 36 },
  23: { start: 36, end: 39 },
  24: { start: 39, end: 41 },
  25: { start: 41, end: 45 },
  26: { start: 46, end: 51 },
  27: { start: 51, end: 57 },
  28: { start: 58, end: 66 },
  29: { start: 67, end: 77 },
  30: { start: 78, end: 114 },
};

export function surahsForJuzList(juzList: number[]): number[] {
  const surahIds = new Set<number>();
  for (const juz of normalizeIds(juzList, 1, 30)) {
    const range = JUZ_SURAH_RANGES[juz];
    if (!range) continue;
    for (let surah = range.start; surah <= range.end; surah++) {
      surahIds.add(surah);
    }
  }
  return [...surahIds].sort((a, b) => a - b);
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

function normalizeIds(
  values: number[] | null | undefined,
  min: number,
  max: number
): number[] {
  return [...new Set(values ?? [])]
    .filter((value) => Number.isInteger(value) && value >= min && value <= max)
    .sort((a, b) => a - b);
}

function resolveDistributionGroups(settings: QuestionDistributionSettings): DistributionGroup[] {
  if (settings.scope === "surah") {
    const selectedSurahs = normalizeIds(settings.surah_filter, 1, 114);
    const surahs = selectedSurahs.length ? selectedSurahs : ALL_SURAHS;
    return surahs.map((surah) => ({
      id: `surah:${surah}`,
      kind: "surah",
      value: surah,
    }));
  }

  const selectedJuz = settings.scope === "juz"
    ? normalizeIds(settings.juz_filter, 1, 30)
    : [];
  const juzList = selectedJuz.length ? selectedJuz : ALL_JUZ;
  return juzList.map((juz) => ({
    id: `juz:${juz}`,
    kind: "juz",
    value: juz,
  }));
}

function buildEvenSequence<T>(items: T[], count: number): T[] {
  const sequence: T[] = [];
  if (items.length === 0 || count <= 0) return sequence;

  while (sequence.length < count) {
    sequence.push(...shuffle(items).slice(0, count - sequence.length));
  }

  return sequence;
}

function getSurahId(verse: Verse): number | null {
  return getPromptSurahId(verse.verse_key);
}

function hasSameSurahNextVerse(verses: Verse[], index: number): boolean {
  const prompt = verses[index];
  const next = verses[index + 1];
  return Boolean(prompt && next && getSurahId(prompt) === getSurahId(next));
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
  verseCache: Map<string, Verse[]>
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
    ...buildPromptMeta(prompt),
    correct_verse_key: correctKey,
    correct_text: blankWord,
    options,
    game_mode: "", // filled in by caller
  };
}

function makeWordMeaningQuestion(
  prompt: VerseWithWords,
  verseCache: Map<string, VerseWithWords[]>
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
    ...buildPromptMeta(prompt),
    correct_verse_key: correctKey,
    correct_text: correctMeaning,
    options,
    game_mode: "word-meaning",
  };
}

function hasMeaningCandidate(verse: VerseWithWords): boolean {
  return verse.words.some(
    (word) => word.text_uthmani && word.translation?.text && isContentMeaning(word.translation.text)
  );
}

function candidateIndexesForMode(
  data: GroupVerseData,
  gameMode: string,
  usedPrompts: Set<string>
): number[] {
  const verses = gameMode === "word-meaning"
    ? data.versesWithWords ?? []
    : data.verses;

  const indexes = verses
    .map((verse, index) => ({ verse, index }))
    .filter(({ verse, index }) => {
      if (gameMode === "multiple-choice" || gameMode === "buzzer") {
        return hasSameSurahNextVerse(verses, index);
      }
      if (gameMode === "word-meaning") {
        return hasMeaningCandidate(verse as VerseWithWords);
      }
      if (gameMode === "fill-in-blank") {
        return verse.text_uthmani.split(/\s+/).filter(Boolean).length >= 3;
      }
      return true;
    });

  const unusedIndexes = indexes.filter(({ verse }) => !usedPrompts.has(verse.verse_key));
  return shuffle(unusedIndexes.length ? unusedIndexes : indexes).map(({ index }) => index);
}

function collectDistractorVerses(
  primaryVerses: Verse[],
  prompt: Verse,
  correct: Verse,
  verseCache: Map<string, Verse[]>
): Verse[] {
  const seen = new Set([prompt.verse_key, correct.verse_key]);
  const distractors: Verse[] = [];

  const addVerse = (verse: Verse) => {
    if (seen.has(verse.verse_key)) return;
    seen.add(verse.verse_key);
    distractors.push(verse);
  };

  primaryVerses.forEach(addVerse);
  for (const verses of verseCache.values()) {
    verses.forEach(addVerse);
  }

  return distractors;
}

function buildQuestionForGroup(
  gameMode: string,
  data: GroupVerseData,
  verseCache: Map<string, Verse[]>,
  verseCacheWithWords: Map<string, VerseWithWords[]>,
  usedPrompts: Set<string>
): GeneratedQuestion | null {
  const promptIndexes = candidateIndexesForMode(data, gameMode, usedPrompts);

  for (const promptIdx of promptIndexes.slice(0, 20)) {
    const prompt = data.verses[promptIdx];
    if (!prompt) continue;

    if (gameMode === "buzzer" || gameMode === "multiple-choice") {
      const correct = data.verses[promptIdx + 1];
      if (!correct || getSurahId(prompt) !== getSurahId(correct)) continue;

      usedPrompts.add(prompt.verse_key);

      if (gameMode === "buzzer") {
        return {
          prompt_verse_key: prompt.verse_key,
          prompt_text: prompt.text_uthmani,
          ...buildPromptMeta(prompt),
          correct_verse_key: correct.verse_key,
          correct_text: correct.text_uthmani,
          options: [],
          game_mode: "buzzer",
        };
      }

      const distractors = shuffle(
        collectDistractorVerses(data.verses, prompt, correct, verseCache)
      ).slice(0, 3);
      const options = shuffle([
        { verse_key: correct.verse_key, text: correct.text_uthmani },
        ...distractors.map((d) => ({ verse_key: d.verse_key, text: d.text_uthmani })),
      ]);

      return {
        prompt_verse_key: prompt.verse_key,
        prompt_text: prompt.text_uthmani,
        ...buildPromptMeta(prompt),
        correct_verse_key: correct.verse_key,
        correct_text: correct.text_uthmani,
        options,
        game_mode: "multiple-choice",
      };
    }

    if (gameMode === "word-meaning") {
      const promptWithWords = data.versesWithWords?.[promptIdx];
      const q = promptWithWords
        ? makeWordMeaningQuestion(promptWithWords, verseCacheWithWords)
        : null;
      if (!q) continue;

      usedPrompts.add(q.prompt_verse_key);
      return q;
    }

    if (gameMode === "fill-in-blank") {
      const q = makeFillInBlankQuestion(prompt, verseCache);
      if (!q) continue;

      usedPrompts.add(q.prompt_verse_key);
      return { ...q, game_mode: "fill-in-blank" };
    }
  }

  return null;
}

export async function generateQuestions(
  numRounds: number,
  gameModes: string[],
  distributionSettings: QuestionDistributionSettings | number[] | null = null
): Promise<GeneratedQuestion[]> {
  const selectedModes = gameModes.length ? gameModes : ["multiple-choice"];
  const roundModes = Array.from(
    { length: numRounds },
    (_, index) => selectedModes[index % selectedModes.length]
  );
  const nonTriviaCount = roundModes.filter((mode) => mode !== "trivia").length;
  const settings = Array.isArray(distributionSettings)
    ? { scope: "surah", surah_filter: distributionSettings }
    : distributionSettings ?? {};
  const distributionGroups = resolveDistributionGroups(settings);
  const groupSequence = buildEvenSequence(distributionGroups, nonTriviaCount);
  const groupsToFetch = new Map(groupSequence.map((group) => [group.id, group]));
  const needsWordData = selectedModes.includes("word-meaning");
  const groupData = new Map<string, GroupVerseData>();
  const verseCache = new Map<string, Verse[]>();
  const verseCacheWithWords = new Map<string, VerseWithWords[]>();

  if (nonTriviaCount > 0) {
    const fetchedGroups = await Promise.all(
      [...groupsToFetch.values()].map((group) => fetchGroupVerses(group, needsWordData))
    );

    for (const data of fetchedGroups) {
      groupData.set(data.group.id, data);
      verseCache.set(data.group.id, data.verses);
      if (data.versesWithWords) {
        verseCacheWithWords.set(data.group.id, data.versesWithWords);
      }
    }
  }

  const triviaCount = roundModes.filter((mode) => mode === "trivia").length;
  const triviaPool = triviaCount > 0 ? pickTriviaQuestions(triviaCount + 5) : [];
  let triviaIdx = 0;

  const questions: GeneratedQuestion[] = [];
  const usedPrompts = new Set<string>();
  let nonTriviaIdx = 0;

  for (let i = 0; i < numRounds; i++) {
    const gameMode = roundModes[i];

    // Trivia rounds draw from the static bank; no API verse data needed.
    if (gameMode === "trivia") {
      if (triviaIdx < triviaPool.length) {
        const t = triviaPool[triviaIdx++];
        const options = t.options.map((text, j) => ({
          verse_key: `${t.id}:${j}`,
          text,
        }));
        questions.push({
          prompt_verse_key: t.id,
          prompt_text: t.question,
          prompt_surah_id: null,
          prompt_juz_number: null,
          prompt_page_number: null,
          correct_verse_key: `${t.id}:${t.correctIndex}`,
          correct_text: t.options[t.correctIndex],
          options: shuffle(options),
          game_mode: "trivia",
        });
      }
      continue;
    }

    const targetGroup = groupSequence[nonTriviaIdx++];
    const primaryData = targetGroup ? groupData.get(targetGroup.id) : null;
    const fallbackGroups = shuffle(
      [...groupData.values()].filter((data) => data.group.id !== targetGroup?.id)
    );
    const candidateGroups = [
      ...(primaryData ? [primaryData] : []),
      ...fallbackGroups,
    ];

    for (const data of candidateGroups) {
      const question = buildQuestionForGroup(
        gameMode,
        data,
        verseCache,
        verseCacheWithWords,
        usedPrompts
      );
      if (!question) continue;
      questions.push(question);
      break;
    }
  }

  return questions;
}
