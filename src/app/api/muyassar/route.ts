import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

interface MuyassarRawEntry {
  text: string;
}

export interface MuyassarParsedEntry {
  quranicWord: string;
  explanation: string;
  isSingleWord: boolean;
}

let cachedDB: Record<string, MuyassarRawEntry> | null = null;

function getDB(): Record<string, MuyassarRawEntry> {
  if (cachedDB) return cachedDB;
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "al-muyassar-fi-al-gharib.json",
    "al-muyassar-fi-al-gharib.json"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedDB = JSON.parse(raw);
  return cachedDB!;
}

// Parse HTML like:
// <p><span class="qpc-hafs">﴿word﴾</span>: explanation.</p>
function parseEntries(html: string): MuyassarParsedEntry[] {
  const results: MuyassarParsedEntry[] = [];
  // Match each span + following colon + explanation
  const spanRegex = /﴿([^﴾]+)﴾<\/span>\s*:\s*([\s\S]*?)(?=<\/p>|<p>|$)/g;
  let match: RegExpExecArray | null;
  while ((match = spanRegex.exec(html)) !== null) {
    const quranicWord = match[1].trim();
    // Strip any HTML tags from explanation
    const explanation = match[2].replace(/<[^>]+>/g, "").trim();
    if (!quranicWord || !explanation) continue;
    const isSingleWord = !quranicWord.includes(" ");
    results.push({ quranicWord, explanation, isSingleWord });
  }
  return results;
}

export async function GET(request: NextRequest) {
  const surah = request.nextUrl.searchParams.get("surah");
  const ayah = request.nextUrl.searchParams.get("ayah");

  if (!surah || !ayah) {
    return NextResponse.json({ error: "surah and ayah params required" }, { status: 400 });
  }

  try {
    const db = getDB();
    const key = `${surah}:${ayah}`;
    const entry = db[key];

    if (!entry || !entry.text) {
      return NextResponse.json({ entries: [] });
    }

    const entries = parseEntries(entry.text);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error("Muyassar lookup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
