import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { VerbForms, NounForms, ExampleReference } from "@/lib/supabase/types";
import { readFile } from "fs/promises";
import path from "path";

const BATCH_SIZE = 200;

export async function POST() {
  const supabase = createAdminSupabaseClient();

  const { count } = await supabase
    .from("lexical_entries")
    .select("*", { count: "exact", head: true });

  const filePath = path.join(process.cwd(), "public", "data", "lexical-db.json");
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return NextResponse.json({ error: "lexical-db.json not found on disk." }, { status: 500 });
  }

  const db = JSON.parse(raw) as { entries: Array<Record<string, unknown>> };
  const entries = db.entries;

  if (!entries?.length) {
    return NextResponse.json({ error: "No entries found in lexical-db.json." }, { status: 400 });
  }

  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map((e) => ({
      word_id: e.id as string,
      type: e.type as "VERB" | "NOUN" | "PARTICLE",
      canonical_form: e.canonical_form as string,
      root: (e.root as string | null) ?? null,
      lemma: (e.lemma as string | null) ?? null,
      forms: (e.forms as VerbForms | NounForms | null) ?? null,
      translation: e.translation as string,
      arabic_explanation: (e.arabic_explanation as string | null) ?? null,
      examples: (e.examples as ExampleReference[]) ?? [],
      source: (e.source as string) ?? "corpus",
      frequency: (e.frequency as number | null) ?? null,
    }));

    const { error } = await supabase
      .from("lexical_entries")
      .upsert(batch, { onConflict: "word_id" });

    if (error) {
      errors.push(`Batch ${i}–${i + batch.length}: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  return NextResponse.json({
    total: entries.length,
    inserted,
    errors: errors.length ? errors : undefined,
    previously_in_db: count ?? 0,
  });
}
