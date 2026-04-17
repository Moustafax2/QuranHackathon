"use client";

import type {
  MemorizationAttempt,
  MemorizationAttemptInput,
} from "@/lib/memorization/types";

export type RatingLevel = 0 | 1 | 2;

export interface RatingEntry {
  timestamp: number;
  level: RatingLevel;
  pageNumber?: number;
  juzNumber?: number;
  clientAttemptId?: string;
}

export interface VerseRecord {
  verseKey: string;
  surahId: number;
  ratings: RatingEntry[];
}

const LEGACY_RECORDS_KEY = "qalamspace_memorization_ratings";
const ATTEMPTS_KEY = "qalamspace_memorization_attempts";
const MIGRATION_KEY_PREFIX = "qalamspace_memorization_synced_v1";

type LegacyRecords = Record<string, VerseRecord>;

type SyncAttemptsResponse = {
  player_id: string;
  attempts: Array<{
    id: string;
    client_attempt_id: string;
    mode: "ayah" | "page-blank";
    rating_level: number;
    verse_key: string | null;
    surah_id: number | null;
    ayah_number: number | null;
    juz_number: number | null;
    page_number: number | null;
    selection_type: "juz" | "surah" | null;
    cover_region: "top" | "middle" | "bottom" | null;
    tested_at: string;
  }>;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function normalizeAttempt(input: MemorizationAttemptInput): MemorizationAttempt {
  const testedAt = input.tested_at ?? new Date();
  const verseKey = input.verse_key ?? null;

  return {
    id: input.client_attempt_id ?? buildClientAttemptId({ ...input, tested_at: testedAt }),
    client_attempt_id:
      input.client_attempt_id ?? buildClientAttemptId({ ...input, tested_at: testedAt }),
    mode: input.mode,
    rating_level: input.rating_level,
    verse_key: verseKey,
    surah_id: input.surah_id ?? null,
    ayah_number:
      input.ayah_number ??
      (verseKey?.includes(":") ? Number(verseKey.split(":")[1]) || null : null),
    juz_number: input.juz_number ?? null,
    page_number: input.page_number ?? null,
    selection_type: input.selection_type ?? null,
    cover_region: input.cover_region ?? null,
    tested_at: testedAt,
  };
}

function hydrateAttempt(row: SyncAttemptsResponse["attempts"][number]): MemorizationAttempt {
  return {
    id: row.id,
    client_attempt_id: row.client_attempt_id,
    mode: row.mode,
    rating_level: row.rating_level as RatingLevel,
    verse_key: row.verse_key,
    surah_id: row.surah_id,
    ayah_number: row.ayah_number,
    juz_number: row.juz_number,
    page_number: row.page_number,
    selection_type: row.selection_type,
    cover_region: row.cover_region,
    tested_at: new Date(row.tested_at),
  };
}

function serializeAttempt(attempt: MemorizationAttempt) {
  return {
    client_attempt_id: attempt.client_attempt_id,
    mode: attempt.mode,
    rating_level: attempt.rating_level,
    verse_key: attempt.verse_key,
    surah_id: attempt.surah_id,
    ayah_number: attempt.ayah_number,
    juz_number: attempt.juz_number,
    page_number: attempt.page_number,
    selection_type: attempt.selection_type,
    cover_region: attempt.cover_region,
    tested_at: attempt.tested_at.toISOString(),
  };
}

function buildClientAttemptId(input: MemorizationAttemptInput): string {
  const testedAt = (input.tested_at ?? new Date()).toISOString();
  const verseKey = input.verse_key ?? "none";
  const pageNumber = input.page_number ?? "none";
  const coverRegion = input.cover_region ?? "none";
  return [
    input.mode,
    verseKey,
    pageNumber,
    input.rating_level,
    testedAt,
    coverRegion,
  ].join("|");
}

function loadLegacyRecords(): LegacyRecords {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(LEGACY_RECORDS_KEY);
    return raw ? (JSON.parse(raw) as LegacyRecords) : {};
  } catch {
    return {};
  }
}

function saveLegacyRecords(records: LegacyRecords): void {
  if (!isBrowser()) return;
  localStorage.setItem(LEGACY_RECORDS_KEY, JSON.stringify(records));
}

function loadStoredAttempts(): MemorizationAttempt[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      client_attempt_id: string;
      mode: "ayah" | "page-blank";
      rating_level: RatingLevel;
      verse_key: string | null;
      surah_id: number | null;
      ayah_number: number | null;
      juz_number: number | null;
      page_number: number | null;
      selection_type: "juz" | "surah" | null;
      cover_region: "top" | "middle" | "bottom" | null;
      tested_at: string;
    }>;

    return parsed.map((attempt) =>
      normalizeAttempt({
        ...attempt,
        tested_at: new Date(attempt.tested_at),
      })
    );
  } catch {
    return [];
  }
}

function legacyRecordsToAttempts(records: LegacyRecords): MemorizationAttempt[] {
  return Object.values(records).flatMap((record) =>
    record.ratings.map((rating) =>
      normalizeAttempt({
        client_attempt_id:
          rating.clientAttemptId ??
          buildClientAttemptId({
            mode: "ayah",
            verse_key: record.verseKey,
            surah_id: record.surahId,
            rating_level: rating.level,
            page_number: rating.pageNumber,
            juz_number: rating.juzNumber,
            tested_at: new Date(rating.timestamp),
          }),
        mode: "ayah",
        verse_key: record.verseKey,
        surah_id: record.surahId,
        rating_level: rating.level,
        page_number: rating.pageNumber,
        juz_number: rating.juzNumber,
        tested_at: new Date(rating.timestamp),
      })
    )
  );
}

function dedupeAttempts(attempts: MemorizationAttempt[]): MemorizationAttempt[] {
  const seen = new Map<string, MemorizationAttempt>();
  for (const attempt of attempts) {
    seen.set(attempt.client_attempt_id, attempt);
  }

  return Array.from(seen.values()).sort(
    (a, b) => a.tested_at.getTime() - b.tested_at.getTime()
  );
}

function saveLocalAttempts(attempts: MemorizationAttempt[]): void {
  if (!isBrowser()) return;

  localStorage.setItem(
    ATTEMPTS_KEY,
    JSON.stringify(
      attempts.map((attempt) => ({
        ...serializeAttempt(attempt),
      }))
    )
  );

  const records: LegacyRecords = {};
  for (const attempt of attempts) {
    if (attempt.mode !== "ayah" || !attempt.verse_key || attempt.surah_id == null) continue;
    if (!records[attempt.verse_key]) {
      records[attempt.verse_key] = {
        verseKey: attempt.verse_key,
        surahId: attempt.surah_id,
        ratings: [],
      };
    }

    records[attempt.verse_key].ratings.push({
      timestamp: attempt.tested_at.getTime(),
      level: attempt.rating_level,
      pageNumber: attempt.page_number ?? undefined,
      juzNumber: attempt.juz_number ?? undefined,
      clientAttemptId: attempt.client_attempt_id,
    });
  }

  saveLegacyRecords(records);
}

function readLocalAttempts(): MemorizationAttempt[] {
  const storedAttempts = loadStoredAttempts();
  const legacyAttempts = legacyRecordsToAttempts(loadLegacyRecords());
  return dedupeAttempts([...storedAttempts, ...legacyAttempts]);
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  const response = await fetch(url, options);
  if (response.status === 401) return null;
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(text || "Memorization request failed.");
  }
  return response.json() as Promise<T>;
}

async function maybeMigrateLocalAttempts(playerId: string): Promise<boolean> {
  if (!isBrowser()) return false;

  const migrationKey = `${MIGRATION_KEY_PREFIX}:${playerId}`;
  if (localStorage.getItem(migrationKey) === "true") return false;

  const attempts = readLocalAttempts();
  if (attempts.length === 0) {
    localStorage.setItem(migrationKey, "true");
    return false;
  }

  const result = await apiFetch<{ ok: boolean }>("/api/memorization/attempts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attempts.map(serializeAttempt)),
  });

  if (result === null) return false;
  localStorage.setItem(migrationKey, "true");
  return true;
}

async function getSyncedAttempts(): Promise<MemorizationAttempt[] | null> {
  const payload = await apiFetch<SyncAttemptsResponse>("/api/memorization/attempts");
  if (payload === null) return null;

  const migrated = await maybeMigrateLocalAttempts(payload.player_id).catch(() => false);
  if (!migrated) {
    return payload.attempts.map(hydrateAttempt);
  }

  const refreshed = await apiFetch<SyncAttemptsResponse>("/api/memorization/attempts");
  if (refreshed === null) return payload.attempts.map(hydrateAttempt);
  return refreshed.attempts.map(hydrateAttempt);
}

function buildRecordsFromAttempts(attempts: MemorizationAttempt[]): Record<string, VerseRecord> {
  const records: Record<string, VerseRecord> = {};

  for (const attempt of attempts) {
    if (attempt.mode !== "ayah" || !attempt.verse_key || attempt.surah_id == null) continue;

    if (!records[attempt.verse_key]) {
      records[attempt.verse_key] = {
        verseKey: attempt.verse_key,
        surahId: attempt.surah_id,
        ratings: [],
      };
    }

    records[attempt.verse_key].ratings.push({
      timestamp: attempt.tested_at.getTime(),
      level: attempt.rating_level,
      pageNumber: attempt.page_number ?? undefined,
      juzNumber: attempt.juz_number ?? undefined,
      clientAttemptId: attempt.client_attempt_id,
    });
  }

  return records;
}

export async function saveMemorizationAttempt(
  input: MemorizationAttemptInput
): Promise<MemorizationAttempt> {
  const attempt = normalizeAttempt(input);

  try {
    const result = await apiFetch<{ ok: boolean }>("/api/memorization/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serializeAttempt(attempt)),
    });

    if (result !== null) {
      return attempt;
    }
  } catch {
    // Fall through to local persistence so offline/local-only users still keep progress.
  }

  const attempts = dedupeAttempts([...readLocalAttempts(), attempt]);
  saveLocalAttempts(attempts);
  return attempt;
}

export async function addRating(
  verseKey: string,
  surahId: number,
  level: RatingLevel,
  extra?: { pageNumber?: number; juzNumber?: number }
): Promise<void> {
  await saveMemorizationAttempt({
    mode: "ayah",
    verse_key: verseKey,
    surah_id: surahId,
    rating_level: level,
    page_number: extra?.pageNumber ?? null,
    juz_number: extra?.juzNumber ?? null,
  });
}

export async function getMemorizationAttempts(): Promise<MemorizationAttempt[]> {
  const syncedAttempts = await getSyncedAttempts().catch(() => null);
  if (syncedAttempts !== null) return syncedAttempts;
  return readLocalAttempts();
}

export async function getAllRecords(): Promise<Record<string, VerseRecord>> {
  return buildRecordsFromAttempts(await getMemorizationAttempts());
}

export async function getSurahScores(): Promise<Record<number, number>> {
  const records = await getAllRecords();
  const surahTotals: Record<number, { sum: number; count: number }> = {};

  for (const record of Object.values(records)) {
    if (record.ratings.length === 0) continue;
    const latestRating = record.ratings[record.ratings.length - 1];
    const surahId = record.surahId;
    if (!surahTotals[surahId]) surahTotals[surahId] = { sum: 0, count: 0 };
    surahTotals[surahId].sum += latestRating.level;
    surahTotals[surahId].count += 1;
  }

  const scores: Record<number, number> = {};
  for (const [surahId, { sum, count }] of Object.entries(surahTotals)) {
    scores[Number(surahId)] = sum / count;
  }

  return scores;
}

export async function clearAllRecords(): Promise<void> {
  try {
    await apiFetch<{ ok: boolean }>("/api/memorization/attempts", {
      method: "DELETE",
    });
  } catch {
    // Ignore sync clear failures and still clear local state.
  }

  if (!isBrowser()) return;
  localStorage.removeItem(LEGACY_RECORDS_KEY);
  localStorage.removeItem(ATTEMPTS_KEY);
}
