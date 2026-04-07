/**
 * Enriches lexical-db.json with English word-by-word translations
 * from the quran.com public API (word_fields=translation_text).
 *
 * Run once: npx tsx scripts/enrich-translations.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DB_PATH = join(process.cwd(), "public", "data", "lexical-db.json");
const BASE_URL = "https://api.quran.com/api/v4";
const PER_PAGE = 50;
const RATE_LIMIT_MS = 150; // between requests

type WordData = { position: number; translation: { text: string } | null };
type VerseData = { verse_number: number; words: WordData[] };

// translation cache: "surah:ayah:position" -> english text
const translationCache = new Map<string, string>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchVersesPage(
  surah: number,
  page: number
): Promise<{ verses: VerseData[]; hasNext: boolean }> {
  const url = `${BASE_URL}/verses/by_chapter/${surah}?words=true&word_fields=translation_text&per_page=${PER_PAGE}&page=${page}&fields=verse_number`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const data = (await res.json()) as {
    verses: VerseData[];
    pagination: { next_page: number | null };
  };
  return {
    verses: data.verses,
    hasNext: data.pagination.next_page !== null,
  };
}

async function loadSurahTranslations(surah: number): Promise<void> {
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const { verses, hasNext: next } = await fetchVersesPage(surah, page);
    for (const verse of verses) {
      for (const word of verse.words) {
        if (word.translation?.text) {
          const key = `${surah}:${verse.verse_number}:${word.position}`;
          translationCache.set(key, word.translation.text);
        }
      }
    }
    hasNext = next;
    page++;
    if (hasNext) await sleep(RATE_LIMIT_MS);
  }
}

function pickBestTranslation(
  examples: Array<{ surah: number; ayah: number; position: number }>
): string {
  // Collect all available translations for this word's occurrences
  const translations: string[] = [];
  for (const ex of examples) {
    const key = `${ex.surah}:${ex.ayah}:${ex.position}`;
    const t = translationCache.get(key);
    if (t) translations.push(t);
  }
  if (translations.length === 0) return "";

  // Strip determiners and pick the shortest meaningful translation
  const cleaned = translations.map((t) =>
    t.replace(/^(the |a |an |to )/i, "").toLowerCase()
  );

  // Frequency count - pick the most common base form
  const freq = new Map<string, number>();
  for (const t of cleaned) freq.set(t, (freq.get(t) ?? 0) + 1);
  let best = "";
  let bestFreq = 0;
  for (const [t, f] of freq) {
    if (f > bestFreq || (f === bestFreq && t.length < best.length)) {
      best = t;
      bestFreq = f;
    }
  }

  // Return the original (not lowercased) version of the best match
  const idx = cleaned.indexOf(best);
  return idx >= 0 ? translations[idx] : translations[0];
}

async function main() {
  console.log("Loading lexical DB...");
  const db = JSON.parse(readFileSync(DB_PATH, "utf-8")) as {
    entries: Array<{
      id: string;
      translation: string;
      examples: Array<{ surah: number; ayah: number; position: number }>;
    }>;
  };

  // Find which surahs are referenced
  const surahsNeeded = new Set<number>();
  for (const entry of db.entries) {
    for (const ex of entry.examples) surahsNeeded.add(ex.surah);
  }

  const surahList = Array.from(surahsNeeded).sort((a, b) => a - b);
  console.log(`Fetching translations for ${surahList.length} surahs...`);

  let done = 0;
  for (const surah of surahList) {
    process.stdout.write(`\r  Surah ${surah}/114 (${Math.round((done / surahList.length) * 100)}%)   `);
    try {
      await loadSurahTranslations(surah);
    } catch (err) {
      console.error(`\nFailed surah ${surah}:`, err);
    }
    done++;
    await sleep(RATE_LIMIT_MS);
  }
  console.log(`\nFetched ${translationCache.size} word translations.`);

  // Enrich entries
  let enriched = 0;
  for (const entry of db.entries) {
    if (entry.examples.length === 0) continue;
    const translation = pickBestTranslation(entry.examples);
    if (translation) {
      entry.translation = translation;
      enriched++;
    }
  }

  db.entries.sort((a, b) => 0); // preserve order
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log(`Done. Enriched ${enriched}/${db.entries.length} entries.`);
  console.log(`Saved to ${DB_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
