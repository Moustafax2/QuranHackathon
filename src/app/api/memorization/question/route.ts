import { NextRequest, NextResponse } from "next/server";
import type { Verse } from "@/lib/types";
import type { AyahQuestion, PageBlankQuestion } from "@/lib/memorization/types";

export type { AyahQuestion, PageBlankQuestion } from "@/lib/memorization/types";
export type { MemorizationQuestion } from "@/lib/memorization/types";

// ---------------------------------------------------------------------------
// Public Quran API — no credentials required
// ---------------------------------------------------------------------------

const QURAN_API = "https://api.quran.com/api/v4";

async function fetchVersesByJuz(juz: number): Promise<Verse[]> {
  const pages: Verse[] = [];
  let page = 1;
  while (true) {
    const url = `${QURAN_API}/verses/by_juz/${juz}?language=en&words=false&translations=131&fields=text_uthmani,page_number,juz_number&per_page=50&page=${page}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`Quran API error ${res.status}`);
    const data = (await res.json()) as { verses: Verse[]; pagination: { total_pages: number } };
    pages.push(...data.verses);
    if (page >= data.pagination.total_pages) break;
    page++;
  }
  return pages;
}

async function fetchVersesByChapter(surah: number): Promise<Verse[]> {
  const pages: Verse[] = [];
  let page = 1;
  while (true) {
    const url = `${QURAN_API}/verses/by_chapter/${surah}?language=en&words=false&translations=131&fields=text_uthmani,page_number,juz_number&per_page=50&page=${page}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`Quran API error ${res.status}`);
    const data = (await res.json()) as { verses: Verse[]; pagination: { total_pages: number } };
    pages.push(...data.verses);
    if (page >= data.pagination.total_pages) break;
    page++;
  }
  return pages;
}

async function fetchVersesByPage(pageNum: number): Promise<Verse[]> {
  const url = `${QURAN_API}/verses/by_page/${pageNum}?language=en&words=true&word_fields=line_number&fields=text_uthmani,verse_key&per_page=50`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Quran API error ${res.status}`);
  const data = (await res.json()) as { verses: Verse[] };
  return data.verses;
}

async function fetchChapterName(surahId: number): Promise<string> {
  const url = `${QURAN_API}/chapters/${surahId}?language=en`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`Quran API error ${res.status}`);
  const data = (await res.json()) as { chapter: { name_simple: string } };
  return data.chapter.name_simple;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("mode") ?? "ayah";
  const selectionType = searchParams.get("selectionType") ?? "juz";
  const selectionIdsParam = searchParams.get("selectionIds") ?? "";
  const difficulty = (searchParams.get("difficulty") ?? "medium") as "easy" | "medium" | "hard";

  const selectionIds = selectionIdsParam
    .split(",")
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);

  if (selectionIds.length === 0) {
    return NextResponse.json({ error: "selectionIds required" }, { status: 400 });
  }

  try {
    if (mode === "page-blank") {
      const id = pickRandom(selectionIds);
      const verses =
        selectionType === "surah"
          ? await fetchVersesByChapter(id)
          : await fetchVersesByJuz(id);
      if (verses.length === 0) {
        return NextResponse.json({ error: "No verses found" }, { status: 500 });
      }
      return NextResponse.json(buildPageBlankQuestion(verses));
    }

    // Ayah mode
    if (difficulty === "hard") {
      // Fetch all verses across all selected juz/surahs to compute unique prefixes
      const allVerseArrays = await Promise.all(
        selectionIds.map((id) =>
          selectionType === "surah" ? fetchVersesByChapter(id) : fetchVersesByJuz(id)
        )
      );
      const allVerses = allVerseArrays.flat();
      if (allVerses.length === 0) {
        return NextResponse.json({ error: "No verses found" }, { status: 500 });
      }
      return NextResponse.json(await buildAyahQuestion([pickRandom(allVerses)], "hard", allVerses));
    } else {
      const id = pickRandom(selectionIds);
      const verses =
        selectionType === "surah"
          ? await fetchVersesByChapter(id)
          : await fetchVersesByJuz(id);
      if (verses.length === 0) {
        return NextResponse.json({ error: "No verses found" }, { status: 500 });
      }
      return NextResponse.json(await buildAyahQuestion(verses, difficulty));
    }
  } catch (err) {
    console.error("Memorization question error:", err);
    return NextResponse.json({ error: "Failed to generate question" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Question builders
// ---------------------------------------------------------------------------

function findMinUniquePrefix(verseText: string, allTexts: string[]): string {
  const words = verseText.split(" ");
  for (let n = 1; n <= words.length; n++) {
    const prefix = words.slice(0, n).join(" ");
    const isUnique = allTexts.every((other) => {
      if (other === verseText) return true;
      return other.split(" ").slice(0, n).join(" ") !== prefix;
    });
    if (isUnique) return prefix;
  }
  return verseText;
}

async function buildAyahQuestion(
  verses: Verse[],
  difficulty: "easy" | "medium" | "hard",
  allSelectionVerses?: Verse[]
): Promise<AyahQuestion> {
  const verse = pickRandom(verses);
  const surahId = parseInt(verse.verse_key.split(":")[0]);

  const [surahName, pageVerses] = await Promise.all([
    fetchChapterName(surahId),
    fetchVersesByPage(verse.page_number),
  ]);

  // Use the first word's line_number for accurate visual positioning.
  // Madani mushaf has 15 lines per page; positionOnPage is 0 (top) → 1 (bottom).
  const targetVerse = pageVerses.find((v) => v.verse_key === verse.verse_key);
  const firstLineNumber = targetVerse?.words?.[0]?.line_number ?? null;
  const allLineNumbers = pageVerses.flatMap((v) => v.words?.map((w) => w.line_number ?? 0) ?? []).filter(Boolean);
  const maxLine = allLineNumbers.length > 0 ? Math.max(...allLineNumbers) : 15;
  const positionOnPage = firstLineNumber !== null ? (firstLineNumber - 1) / maxLine : 0.5;

  const words = verse.text_uthmani.split(" ");
  let displayText: string;
  if (difficulty === "easy") {
    displayText = verse.text_uthmani;
  } else if (difficulty === "hard") {
    const allTexts = (allSelectionVerses ?? verses).map((v) => v.text_uthmani);
    displayText = findMinUniquePrefix(verse.text_uthmani, allTexts);
  } else {
    displayText = words.slice(0, Math.ceil(words.length / 2)).join(" ");
  }

  return {
    mode: "ayah",
    verseKey: verse.verse_key,
    pageNumber: verse.page_number,
    surahName,
    surahId,
    juzNumber: verse.juz_number,
    displayText,
    fullText: verse.text_uthmani,
    positionOnPage,
  };
}

function buildPageBlankQuestion(verses: Verse[]): PageBlankQuestion {
  const pages = [...new Set(verses.map((v) => v.page_number))];
  const pageNumber = pickRandom(pages);
  const regions: Array<"top" | "middle" | "bottom"> = ["top", "middle", "bottom"];
  const pageVerses = verses.filter((verse) => verse.page_number === pageNumber);
  const pageJuzNumbers = [...new Set(pageVerses.map((verse) => verse.juz_number))];
  const pageSurahIds = [
    ...new Set(pageVerses.map((verse) => Number(verse.verse_key.split(":")[0]))),
  ];
  // A surah header appears on pages where verse 1 of any surah begins
  const hasSurahHeader = verses.some(
    (v) => v.page_number === pageNumber && v.verse_key.endsWith(":1")
  );
  return {
    mode: "page-blank",
    pageNumber,
    juzNumber: pageJuzNumbers.length === 1 ? pageJuzNumbers[0] : null,
    surahId: pageSurahIds.length === 1 ? pageSurahIds[0] : null,
    coverRegion: pickRandom(regions),
    hasSurahHeader,
  };
}
