import { NextRequest, NextResponse } from "next/server";
import { getVersesByJuz } from "@/lib/api/verses";
import { getChapter } from "@/lib/api/chapters";
import type { Verse } from "@/lib/types";
import type { GameQuestion } from "@/lib/types/game";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number, exclude: T[]): T[] {
  const pool = arr.filter((item) => !exclude.includes(item));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const juzesParam = searchParams.get("juzes");

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

  // Pick a random juz and fetch all its verses
  const juzNumber = pickRandom(juzes);
  const { verses } = await getVersesByJuz(juzNumber);

  // Group verses by surah
  const bySurah = new Map<number, Verse[]>();
  for (const verse of verses) {
    const [surahNum] = verse.verse_key.split(":").map(Number);
    if (!bySurah.has(surahNum)) bySurah.set(surahNum, []);
    bySurah.get(surahNum)!.push(verse);
  }

  // Sort each surah's verses by verse_number
  for (const [, surahVerses] of bySurah) {
    surahVerses.sort((a, b) => a.verse_number - b.verse_number);
  }

  // Build pool of valid prompt verses (not the last verse of their surah in this juz)
  // A verse is valid if the next verse (verse_number + 1) exists in the same surah within our set
  const validPrompts: Verse[] = [];
  for (const [, surahVerses] of bySurah) {
    // All but the last verse in this surah's chunk are valid prompts
    for (let i = 0; i < surahVerses.length - 1; i++) {
      validPrompts.push(surahVerses[i]);
    }
  }

  if (validPrompts.length === 0) {
    return NextResponse.json({ error: "Not enough verses to generate question" }, { status: 500 });
  }

  // Pick prompt and derive correct answer
  const prompt = pickRandom(validPrompts);
  const [surahNum] = prompt.verse_key.split(":").map(Number);
  const surahVerses = bySurah.get(surahNum)!;
  const promptIdx = surahVerses.findIndex((v) => v.verse_key === prompt.verse_key);
  const correctVerse = surahVerses[promptIdx + 1];

  // Pick 3 distractors from the same surah, excluding prompt and correct
  // Also exclude any verse with the same text as the correct answer (e.g. repeated ayahs in Al-Rahman)
  const seenTexts = new Set([prompt.text_uthmani, correctVerse.text_uthmani]);

  let distractorPool = surahVerses.filter(
    (v) => v.verse_key !== prompt.verse_key && v.verse_key !== correctVerse.verse_key
  );

  // If not enough in this surah, pull from other surahs in the juz
  if (distractorPool.length < 3) {
    const otherVerses = verses.filter(
      (v) =>
        v.verse_key !== prompt.verse_key &&
        v.verse_key !== correctVerse.verse_key &&
        !distractorPool.some((d) => d.verse_key === v.verse_key)
    );
    distractorPool = [...distractorPool, ...otherVerses];
  }

  // Deduplicate by text so repeated ayahs (e.g. Al-Rahman 55:13) don't appear twice
  const distractors: typeof distractorPool = [];
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

  // Build options array and shuffle, tracking where correct answer lands
  const optionVerses = [correctVerse, ...distractors].sort(() => Math.random() - 0.5);
  const correctIndex = optionVerses.findIndex((v) => v.verse_key === correctVerse.verse_key);

  // Fetch surah name
  const chapter = await getChapter(surahNum);
  const surahName = chapter.chapter.name_simple;

  const question: GameQuestion = {
    type: "next-ayah-mc",
    promptVerse: {
      text_uthmani: prompt.text_uthmani,
      verse_key: prompt.verse_key,
      surah_name: surahName,
    },
    options: optionVerses.map((v) => ({
      text_uthmani: v.text_uthmani,
      verse_key: v.verse_key,
    })),
    correctIndex,
  };

  return NextResponse.json(question);
}
