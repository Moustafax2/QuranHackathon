import { NextRequest, NextResponse } from "next/server";
import path from "path";

let db: import("better-sqlite3").Database | null = null;

function getDB() {
  if (!db) {
    const Database = require("better-sqlite3");
    const dbPath = path.join(process.cwd(), "public", "data", "hanswehr.sqlite");
    db = new Database(dbPath, { readonly: true });
  }
  return db;
}

function buildCandidates(root: string): string[] {
  // Base normalization: remove spaces, diacritics, hamza forms → plain alef
  const n = root
    .replace(/\s+/g, "")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627"); // أ إ آ ٱ → ا

  const seen = new Set<string>();
  const add = (s: string) => { if (s) seen.add(s); };

  add(n);

  // Weak verb root: final ي ↔ ى ↔ و
  if (n.endsWith("\u064A")) {            // ends in ي
    add(n.slice(0, -1) + "\u0649");      // → ى
    add(n.slice(0, -1) + "\u0648");      // → و
  } else if (n.endsWith("\u0649")) {     // ends in ى
    add(n.slice(0, -1) + "\u064A");      // → ي
    add(n.slice(0, -1) + "\u0648");      // → و
  } else if (n.endsWith("\u0648")) {     // ends in و
    add(n.slice(0, -1) + "\u064A");      // → ي
    add(n.slice(0, -1) + "\u0649");      // → ى
  }

  // Geminate root: last two letters identical → try without the doubled letter
  if (n.length >= 3 && n[n.length - 1] === n[n.length - 2]) {
    add(n.slice(0, -1));
  }

  // صرط ↔ سرط (borrowed word stored under سين in Hans Wehr)
  if (n.startsWith("\u0635")) {
    add("\u0633" + n.slice(1));
  }

  return [...seen];
}

export async function GET(request: NextRequest) {
  const root = request.nextUrl.searchParams.get("root");
  if (!root) {
    return NextResponse.json({ error: "root param required" }, { status: 400 });
  }

  try {
    const database = getDB()!;
    const stmt = database.prepare(
      "SELECT word, definition FROM DICTIONARY WHERE word = ? LIMIT 1"
    );

    for (const candidate of buildCandidates(root)) {
      const row = stmt.get(candidate) as { word: string; definition: string } | undefined;
      if (row) {
        return NextResponse.json({ word: row.word, definition: row.definition });
      }
    }

    return NextResponse.json({ definition: null });
  } catch (err) {
    console.error("Hans Wehr lookup error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
