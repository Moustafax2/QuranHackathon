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
 * Generate questions for a game.
 *
 * @param numRounds - Number of questions to generate
 * @param gameMode - 'multiple-choice' or 'buzzer'
 * @param surahFilter - Optional array of surah IDs to pick from
 */
export async function generateQuestions(
  numRounds: number,
  gameMode: string,
  surahFilter?: number[] | null
): Promise<GeneratedQuestion[]> {
  const questions: GeneratedQuestion[] = [];
  const pool = surahFilter?.length ? surahFilter : SHORT_SURAHS;

  // Pre-fetch verses for a selection of surahs to avoid too many API calls
  const surahsToFetch = new Set<number>();
  for (let i = 0; i < numRounds; i++) {
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
    // Pick a random surah from our fetched set
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
      // Buzzer mode: no options needed
      questions.push({
        prompt_verse_key: prompt.verse_key,
        prompt_text: prompt.text_uthmani,
        correct_verse_key: correct.verse_key,
        correct_text: correct.text_uthmani,
        options: [],
      });
    } else {
      // Multiple choice: pick 3 distractors
      const distractorPool = verses.filter(
        (_, idx) => idx !== promptIdx && idx !== promptIdx + 1
      );

      // If surah is too short for 3 distractors, fill from another surah
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
