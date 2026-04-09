export type RatingLevel = 0 | 1 | 2; // 0=wrong, 1=medium, 2=correct

export interface RatingEntry {
  timestamp: number;
  level: RatingLevel;
  pageNumber?: number;
  juzNumber?: number;
}

export interface VerseRecord {
  verseKey: string;
  surahId: number;
  ratings: RatingEntry[];
}

const STORAGE_KEY = "qalamspace_memorization_ratings";

function loadRecords(): Record<string, VerseRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, VerseRecord>) : {};
  } catch {
    return {};
  }
}

function saveRecords(records: Record<string, VerseRecord>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function addRating(
  verseKey: string,
  surahId: number,
  level: RatingLevel,
  extra?: { pageNumber?: number; juzNumber?: number }
): void {
  const records = loadRecords();
  if (!records[verseKey]) {
    records[verseKey] = { verseKey, surahId, ratings: [] };
  }
  records[verseKey].ratings.push({
    timestamp: Date.now(),
    level,
    ...extra,
  });
  saveRecords(records);
}

export function getAllRecords(): Record<string, VerseRecord> {
  return loadRecords();
}

// Returns average score (0–2) per surah, or null if no data
export function getSurahScores(): Record<number, number> {
  const records = loadRecords();
  const surahTotals: Record<number, { sum: number; count: number }> = {};

  for (const record of Object.values(records)) {
    if (record.ratings.length === 0) continue;
    const latestRating = record.ratings[record.ratings.length - 1];
    const s = record.surahId;
    if (!surahTotals[s]) surahTotals[s] = { sum: 0, count: 0 };
    surahTotals[s].sum += latestRating.level;
    surahTotals[s].count += 1;
  }

  const scores: Record<number, number> = {};
  for (const [surahId, { sum, count }] of Object.entries(surahTotals)) {
    scores[Number(surahId)] = sum / count;
  }
  return scores;
}

export function clearAllRecords(): void {
  localStorage.removeItem(STORAGE_KEY);
}
