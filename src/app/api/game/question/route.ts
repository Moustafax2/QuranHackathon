import { NextRequest, NextResponse } from "next/server";
import { getVersesByJuz, getVersesByJuzWithWords } from "@/lib/api/verses";
import { getChapter } from "@/lib/api/chapters";
import type { Verse } from "@/lib/types";
import type { GameQuestion, QuestionType } from "@/lib/types/game";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const juzesParam = searchParams.get("juzes");
  const type = (searchParams.get("type") ?? "next-ayah-mc") as QuestionType;

  if (!juzesParam) {
    return NextResponse.json({ error: "juzes param required" }, { status: 400 });
  }

  const juzes = juzesParam
    .split(",")
    .map(Number)
    .filter((n) => n >= 1 && n <= 30);

  if (juzes.length === 0) {
    return NextResponse.json({ error: "No valid juzes provided" }, { status: 400 });
  }

  const juzNumber = pickRandom(juzes);

  if (type === "word-meaning-mc") {
    return generateWordMeaningQuestion(juzNumber);
  }

  if (type === "blank-word-mc") {
    return generateBlankWordQuestion(juzNumber);
  }

  return generateNextAyahQuestion(juzNumber);
}

// ---------------------------------------------------------------------------
// Next Ayah — Multiple Choice
// ---------------------------------------------------------------------------

async function generateNextAyahQuestion(juzNumber: number) {
  const { verses } = await getVersesByJuz(juzNumber);

  // Group verses by surah
  const bySurah = new Map<number, Verse[]>();
  for (const verse of verses) {
    const [surahNum] = verse.verse_key.split(":").map(Number);
    if (!bySurah.has(surahNum)) bySurah.set(surahNum, []);
    bySurah.get(surahNum)!.push(verse);
  }
  for (const [, sv] of bySurah) sv.sort((a, b) => a.verse_number - b.verse_number);

  // Valid prompts: not the last verse of their surah chunk
  const validPrompts: Verse[] = [];
  for (const [, sv] of bySurah) {
    for (let i = 0; i < sv.length - 1; i++) validPrompts.push(sv[i]);
  }

  if (validPrompts.length === 0) {
    return NextResponse.json({ error: "Not enough verses to generate question" }, { status: 500 });
  }

  const prompt = pickRandom(validPrompts);
  const [surahNum] = prompt.verse_key.split(":").map(Number);
  const surahVerses = bySurah.get(surahNum)!;
  const promptIdx = surahVerses.findIndex((v) => v.verse_key === prompt.verse_key);
  const correctVerse = surahVerses[promptIdx + 1];

  const seenTexts = new Set([prompt.text_uthmani, correctVerse.text_uthmani]);

  let distractorPool = surahVerses.filter(
    (v) => v.verse_key !== prompt.verse_key && v.verse_key !== correctVerse.verse_key
  );
  if (distractorPool.length < 3) {
    const others = verses.filter(
      (v) =>
        v.verse_key !== prompt.verse_key &&
        v.verse_key !== correctVerse.verse_key &&
        !distractorPool.some((d) => d.verse_key === v.verse_key)
    );
    distractorPool = [...distractorPool, ...others];
  }

  const distractors: Verse[] = [];
  for (const v of distractorPool.sort(() => Math.random() - 0.5)) {
    if (!seenTexts.has(v.text_uthmani)) {
      seenTexts.add(v.text_uthmani);
      distractors.push(v);
    }
    if (distractors.length === 3) break;
  }

  if (distractors.length < 3) {
    return NextResponse.json({ error: "Not enough distractors available" }, { status: 500 });
  }

  const optionVerses = [correctVerse, ...distractors].sort(() => Math.random() - 0.5);
  const correctIndex = optionVerses.findIndex((v) => v.verse_key === correctVerse.verse_key);

  const chapter = await getChapter(surahNum);

  const question: GameQuestion = {
    type: "next-ayah-mc",
    promptVerse: {
      text_uthmani: prompt.text_uthmani,
      verse_key: prompt.verse_key,
      surah_name: chapter.chapter.name_simple,
    },
    options: optionVerses.map((v) => ({
      text_uthmani: v.text_uthmani,
      verse_key: v.verse_key,
    })),
    correctIndex,
  };

  return NextResponse.json(question);
}

// ---------------------------------------------------------------------------
// Word Meaning — Multiple Choice
// ---------------------------------------------------------------------------

// Words to skip: very short/generic translations that make bad questions
const SKIP_MEANINGS = new Set([
  "and", "or", "but", "so", "then", "that", "the", "a", "an", "of", "in",
  "on", "to", "is", "are", "was", "were", "it", "he", "she", "they", "we",
  "not", "no", "with", "for", "from", "at", "by", "be", "as", "if",
]);

function isContentWord(meaning: string): boolean {
  const cleaned = meaning.trim().toLowerCase();
  if (!cleaned || cleaned.length < 3) return false;
  if (SKIP_MEANINGS.has(cleaned)) return false;
  // Filter out bare numbers or parenthesized numbers like "(5)", "(12)"
  if (/^\(?\d+\)?$/.test(cleaned)) return false;
  return true;
}

async function generateWordMeaningQuestion(juzNumber: number) {
  const { verses } = await getVersesByJuzWithWords(juzNumber);

  // Collect all content words across all verses in the juz
  type WordEntry = { word: string; meaning: string; verse_key: string; surah_name_promise: number };
  const allWords: WordEntry[] = [];

  for (const verse of verses) {
    if (!verse.words) continue;
    for (const w of verse.words) {
      if (!w.translation?.text) continue;
      if (!isContentWord(w.translation.text)) continue;
      allWords.push({
        word: w.text_uthmani,
        meaning: w.translation.text,
        verse_key: verse.verse_key,
        surah_name_promise: parseInt(verse.verse_key.split(":")[0]),
      });
    }
  }

  if (allWords.length < 4) {
    return NextResponse.json({ error: "Not enough words to generate question" }, { status: 500 });
  }

  // Pick a random word as the prompt
  const correctEntry = pickRandom(allWords);

  // Build distractor pool: words with different meanings (deduplicated by meaning text)
  const seenMeanings = new Set([correctEntry.meaning.toLowerCase()]);
  const distractors: WordEntry[] = [];

  for (const w of allWords.sort(() => Math.random() - 0.5)) {
    if (w.verse_key === correctEntry.verse_key && w.word === correctEntry.word) continue;
    const key = w.meaning.toLowerCase();
    if (seenMeanings.has(key)) continue;
    seenMeanings.add(key);
    distractors.push(w);
    if (distractors.length === 3) break;
  }

  if (distractors.length < 3) {
    return NextResponse.json({ error: "Not enough distractors available" }, { status: 500 });
  }

  const allOptions = [correctEntry, ...distractors].sort(() => Math.random() - 0.5);
  const correctIndex = allOptions.findIndex((o) => o === correctEntry);

  const surahNum = correctEntry.surah_name_promise;
  const chapter = await getChapter(surahNum);

  const question: GameQuestion = {
    type: "word-meaning-mc",
    promptVerse: {
      text_uthmani: correctEntry.word,
      verse_key: correctEntry.verse_key,
      surah_name: chapter.chapter.name_simple,
    },
    promptWord: correctEntry.word,
    options: allOptions.map((o) => ({
      text_uthmani: o.word,
      verse_key: o.verse_key,
      meaning: o.meaning,
    })),
    correctIndex,
  };

  return NextResponse.json(question);
}

// ---------------------------------------------------------------------------
// Blank Word — Multiple Choice
// ---------------------------------------------------------------------------

async function generateBlankWordQuestion(juzNumber: number) {
  const { verses } = await getVersesByJuzWithWords(juzNumber);

  // Only use verses that have enough content words to build 4 options
  const eligibleVerses = verses.filter(
    (v) => v.words && v.words.filter((w) => isContentWord(w.text_uthmani ?? "")).length >= 4
  );

  if (eligibleVerses.length === 0) {
    return NextResponse.json({ error: "Not enough eligible verses" }, { status: 500 });
  }

  const verse = pickRandom(eligibleVerses);
  const allWords = verse.words!;

  // Content words only (for picking the blank and distractors)
  const contentWords = allWords.filter((w) => isContentWord(w.text_uthmani ?? ""));

  // Pick the blank word
  const blankWord = pickRandom(contentWords);
  const blankWordIndex = allWords.findIndex((w) => w.id === blankWord.id);

  // Distractors: other content words from the same verse, then fallback to other verses
  const seenTexts = new Set([blankWord.text_uthmani]);
  const distractors: string[] = [];

  for (const w of contentWords.filter((w) => w.id !== blankWord.id).sort(() => Math.random() - 0.5)) {
    if (!seenTexts.has(w.text_uthmani)) {
      seenTexts.add(w.text_uthmani);
      distractors.push(w.text_uthmani);
    }
    if (distractors.length === 3) break;
  }

  if (distractors.length < 3) {
    for (const v of verses) {
      if (v.verse_key === verse.verse_key || !v.words) continue;
      for (const w of v.words.sort(() => Math.random() - 0.5)) {
        if (!w.text_uthmani || !isContentWord(w.text_uthmani)) continue;
        if (!seenTexts.has(w.text_uthmani)) {
          seenTexts.add(w.text_uthmani);
          distractors.push(w.text_uthmani);
        }
        if (distractors.length === 3) break;
      }
      if (distractors.length === 3) break;
    }
  }

  if (distractors.length < 3) {
    return NextResponse.json({ error: "Not enough distractors available" }, { status: 500 });
  }

  const optionTexts = [blankWord.text_uthmani, ...distractors].sort(() => Math.random() - 0.5);
  const correctIndex = optionTexts.indexOf(blankWord.text_uthmani);

  const surahNum = parseInt(verse.verse_key.split(":")[0]);
  const chapter = await getChapter(surahNum);

  const question: GameQuestion = {
    type: "blank-word-mc",
    promptVerse: {
      text_uthmani: verse.text_uthmani,
      verse_key: verse.verse_key,
      surah_name: chapter.chapter.name_simple,
    },
    ayahWords: allWords.map((w) => w.text_uthmani ?? ""),
    blankWordIndex,
    options: optionTexts.map((t) => ({ text_uthmani: t, verse_key: verse.verse_key })),
    correctIndex,
  };

  return NextResponse.json(question);
}
