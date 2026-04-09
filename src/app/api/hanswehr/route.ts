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

export async function GET(request: NextRequest) {
  const root = request.nextUrl.searchParams.get("root");
  if (!root) {
    return NextResponse.json({ error: "root param required" }, { status: 400 });
  }

  // Strip diacritics and spaces from the root for matching
  // LexicalEntry root format: "ك ت ب" (spaced letters)
  const normalized = root.replace(/\s+/g, "").replace(/[\u064B-\u065F]/g, "");

  try {
    const database = getDB()!;
    const row = database
      .prepare("SELECT word, definition FROM DICTIONARY WHERE word = ? LIMIT 1")
      .get(normalized) as { word: string; definition: string } | undefined;

    if (!row) {
      return NextResponse.json({ definition: null });
    }

    return NextResponse.json({ word: row.word, definition: row.definition });
  } catch (err) {
    console.error("Hans Wehr lookup error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
