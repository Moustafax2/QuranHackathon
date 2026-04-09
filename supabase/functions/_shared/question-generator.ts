const QURAN_API = "https://api.quran.com/api/v4";

interface Verse {
  verse_key: string;
  text_uthmani: string;
}

interface GeneratedQuestion {
  prompt_verse_key: string;
  prompt_text: string;
  correct_verse_key: string;
  correct_text: string;
  options: { verse_key: string; text: string }[];
}

/**
 * Fetch all verses for a surah from quran.com API.
 */
async function fetchSurahVerses(surahId: number): Promise<Verse[]> {
  const res = await fetch(
    `${QURAN_API}/verses/by_chapter/${surahId}?language=en&fields=text_uthmani&per_page=300`
  );
  const data = await res.json();
  return data.verses.map((v: { verse_key: string; text_uthmani: string }) => ({
    verse_key: v.verse_key,
    text_uthmani: v.text_uthmani,
  }));
}

/**
 * Pick a random integer in [min, max).
 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Shuffle array in place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Short surahs (Juz 30) are easier — weight them higher for casual play
const SHORT_SURAHS = Array.from({ length: 37 }, (_, i) => 78 + i); // 78-114

/**
 * Generate a fill-in-the-blank question from a verse.
 * Blanks one word and provides 3 Arabic word distractors.
 */
function makeFillInBlankQuestion(
  prompt: Verse,
  verseCache: Map<number, Verse[]>
): GeneratedQuestion | null {
  const words = prompt.text_uthmani.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 3) return null;

  // Pick a word from the middle (avoid first/last for readability)
  const wordIdx = randInt(1, words.length - 1);
  const blankWord = words[wordIdx];

  // Replace the chosen word with a blank
  const blankedText = words
    .map((w, i) => (i === wordIdx ? "___" : w))
    .join(" ");

  // Collect distractor words from other cached verses
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
  };
}

/**
 * Generate questions for a game.
 *
 * @param numRounds - Number of questions to generate
 * @param gameMode - 'multiple-choice' | 'fill-in-blank' | 'word-meaning' | 'buzzer'
 * @param surahFilter - Optional array of surah IDs to pick from
 */
export async function generateQuestions(
  numRounds: number,
  gameMode: string,
  surahFilter?: number[] | null
): Promise<GeneratedQuestion[]> {
  const questions: GeneratedQuestion[] = [];
  const pool = surahFilter?.length ? surahFilter : SHORT_SURAHS;

  // Pre-fetch verses for a selection of surahs
  const surahsToFetch = new Set<number>();
  for (let i = 0; i < numRounds; i++) {
    surahsToFetch.add(pool[randInt(0, pool.length)]);
  }
  // Always fetch a few extra surahs so we have distractors for fill-in-blank
  while (surahsToFetch.size < Math.min(3, pool.length)) {
    surahsToFetch.add(pool[randInt(0, pool.length)]);
  }

  const verseCache = new Map<number, Verse[]>();
  await Promise.all(
    [...surahsToFetch].map(async (surahId) => {
      const verses = await fetchSurahVerses(surahId);
      verseCache.set(surahId, verses);
    })
  );

  const usedPrompts = new Set<string>();

  for (let i = 0; i < numRounds; i++) {
    const surahIds = [...verseCache.keys()];
    const surahId = surahIds[randInt(0, surahIds.length)];
    const verses = verseCache.get(surahId)!;

    if (verses.length < 2) continue;

    // Pick a prompt verse (not the last one)
    let promptIdx: number;
    let attempts = 0;
    do {
      promptIdx = randInt(0, verses.length - 1);
      attempts++;
    } while (usedPrompts.has(verses[promptIdx].verse_key) && attempts < 20);

    const prompt = verses[promptIdx];
    const correct = verses[promptIdx + 1];
    usedPrompts.add(prompt.verse_key);

    if (gameMode === "buzzer") {
      questions.push({
        prompt_verse_key: prompt.verse_key,
        prompt_text: prompt.text_uthmani,
        correct_verse_key: correct.verse_key,
        correct_text: correct.text_uthmani,
        options: [],
      });
    } else if (gameMode === "fill-in-blank" || gameMode === "word-meaning") {
      // Both modes use fill-in-blank question format.
      // word-meaning shows the word and asks players to identify it in context.
      const q = makeFillInBlankQuestion(prompt, verseCache);
      if (q) {
        questions.push(q);
      } else {
        // Fallback to multiple-choice if the verse is too short
        i--; // retry this round slot
      }
    } else {
      // multiple-choice: pick 3 distractors (next verses from other spots)
      const distractorPool = verses.filter(
        (_, idx) => idx !== promptIdx && idx !== promptIdx + 1
      );

      if (distractorPool.length < 3) {
        const otherSurahId = surahIds.find((id) => id !== surahId);
        if (otherSurahId) {
          const otherVerses = verseCache.get(otherSurahId)!;
          distractorPool.push(...otherVerses.slice(0, 3 - distractorPool.length));
        }
      }

      const distractors = shuffle(distractorPool).slice(0, 3);

      const options = shuffle([
        { verse_key: correct.verse_key, text: correct.text_uthmani },
        ...distractors.map((d) => ({
          verse_key: d.verse_key,
          text: d.text_uthmani,
        })),
      ]);

      questions.push({
        prompt_verse_key: prompt.verse_key,
        prompt_text: prompt.text_uthmani,
        correct_verse_key: correct.verse_key,
        correct_text: correct.text_uthmani,
        options,
      });
    }
  }

  return questions;
}
