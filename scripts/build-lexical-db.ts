import { writeFileSync, mkdirSync, readFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import { normalizeVerb, normalizeNoun, normalizeParticle, deduplicateEntries } from "../src/lib/corpus/canonicalization";
import type { LexicalEntry } from "../src/lib/types/flashcard";
import { buckwalterToArabic, getUnmappedChars } from "./buckwalter-to-arabic";

// #region agent log
const logFile = 'debug-58567c.log';
function logDebug(location: string, message: string, data: any, hypothesisId: string) {
  try {
    appendFileSync(logFile, JSON.stringify({sessionId:'58567c',location,message,data,timestamp:Date.now(),hypothesisId}) + '\n');
  } catch(e) {}
}
// #endregion

console.log("Lexical Database Builder");
console.log("========================");
console.log("");

const BUILD_FULL_DATABASE = process.argv.includes("--full");

if (!BUILD_FULL_DATABASE) {
  console.log("NOTE: Running in SAMPLE mode. To build the full database:");
  console.log("  Run: npx tsx scripts/build-lexical-db.ts --full");
  console.log("");
  console.log("IMPORTANT: The Corpus API is currently unavailable.");
  console.log("For the full database, you'll need to:");
  console.log("  1. Download morphological data from https://corpus.quran.com/download");
  console.log("  2. Place the file in: public/data/quranic-corpus-morphology-0.4.txt");
  console.log("  3. Run: npx tsx scripts/build-lexical-db.ts --full");
  console.log("");
}

const sampleDatabase = {
  version: "1.0.0",
  generated_at: new Date().toISOString(),
  total_entries: 3,
  entries: [
    {
      id: "v_amana_001",
      type: "VERB",
      canonical_form: "آمَنَ",
      root: "ء م ن",
      forms: {
        past: "آمَنَ",
        present: "يُؤْمِنُ",
        imperative: "آمِنْ",
        verbal_noun: "إِيمَانٌ",
      },
      translation: "to believe",
      examples: [
        { surah: 2, ayah: 3, position: 2 },
        { surah: 2, ayah: 4, position: 1 },
        { surah: 2, ayah: 9, position: 2 },
      ],
      source: "corpus",
      frequency: 100,
    },
    {
      id: "n_kitab_001",
      type: "NOUN",
      canonical_form: "كِتَابٌ",
      root: "ك ت ب",
      lemma: "كتاب",
      forms: {
        singular: "كِتَابٌ",
        plural: "كُتُبٌ",
      },
      translation: "book",
      examples: [
        { surah: 2, ayah: 2, position: 3 },
        { surah: 2, ayah: 44, position: 4 },
        { surah: 2, ayah: 85, position: 6 },
      ],
      source: "corpus",
      frequency: 80,
    },
    {
      id: "p_min_001",
      type: "PARTICLE",
      canonical_form: "مِنْ",
      translation: "from",
      examples: [
        { surah: 1, ayah: 1, position: 1 },
        { surah: 2, ayah: 2, position: 4 },
        { surah: 2, ayah: 5, position: 3 },
      ],
      source: "corpus",
      frequency: 200,
    },
    {
      id: "v_kataba_001",
      type: "VERB",
      canonical_form: "كَتَبَ",
      root: "ك ت ب",
      forms: {
        past: "كَتَبَ",
        present: "يَكْتُبُ",
        imperative: "اكْتُبْ",
        verbal_noun: "كِتَابَةٌ",
      },
      translation: "to write",
      examples: [
        { surah: 2, ayah: 282, position: 5 },
      ],
      source: "corpus",
      frequency: 50,
    },
    {
      id: "n_salat_001",
      type: "NOUN",
      canonical_form: "صَلَاةٌ",
      root: "ص ل و",
      lemma: "صلاة",
      forms: {
        singular: "صَلَاةٌ",
        plural: "صَلَوَاتٌ",
      },
      translation: "prayer",
      examples: [
        { surah: 2, ayah: 3, position: 5 },
        { surah: 2, ayah: 43, position: 2 },
      ],
      source: "corpus",
      frequency: 70,
    },
  ],
};

type RawWord = {
  text: string;
  pos: string;
  root?: string;
  lemma?: string;
  buckwalter_root?: string;
  buckwalter_lemma?: string;
  verb_form?: string;
  tense?: "PERF" | "IMPF" | "IMPV";
  person?: string;
  is_passive?: boolean;
  features: string[];
  translation?: string;
  surah: number;
  ayah: number;
  position: number;
};

function normalizeBuckwalterLemma(lemma: string, features: string[]): string {
  let normalized = lemma.replace(/\d+$/, "");

  // The corpus sometimes stores masculine sound plurals as the lemma
  // (for example active participles like r~a`sixuwn). Strip the plural
  // ending for participles so the lexical DB stores a singular headword
  // without mangling regular singular lemmas like misokiyn.
  if (features.includes("MP") && features.includes("PCPL")) {
    normalized = normalized.replace(/(uwn|iyn)$/, "");
  }

  return normalized;
}

function getVerbForm(features: string[]): string | undefined {
  return features.find((feature) => /^\([IVX]+\)$/.test(feature));
}

function getVerbTense(features: string[]): "PERF" | "IMPF" | "IMPV" | undefined {
  if (features.includes("PERF")) return "PERF";
  if (features.includes("IMPF")) return "IMPF";
  if (features.includes("IMPV")) return "IMPV";
  return undefined;
}

function getPerson(features: string[]): string | undefined {
  return features.find((feature) => /^\d[MF]?[SPD]$/.test(feature));
}

function createGroupingKey(word: RawWord): string {
  if (word.pos.startsWith("V") || (word.pos.startsWith("N") && word.features.includes("VN"))) {
    return `verb:${word.buckwalter_root || word.root || ""}:${word.verb_form || ""}`;
  }

  return word.lemma || word.text;
}

function parseCorpusFile(filePath: string): RawWord[] {
  console.log("Reading morphological data file...");
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  
  const rawWords: RawWord[] = [];
  
  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") continue;
    
    // Format: (1:1:1:1)	{l	DET	PREFIX|Al+
    // Format: (surah:ayah:word:segment)	text	pos	features
    const match = line.match(/\((\d+):(\d+):(\d+):(\d+)\)\s+([^\s]+)\s+([^\s]+)\s+(.+)/);
    if (!match) continue;
    
    const [, surah, ayah, word, segment, text, pos, features] = match;
    
    // Parse features: STEM|POS:N|LEM:Hamod|ROOT:Hmd|M|NOM
    const featureParts = features.split("|");
    let lemma: string | undefined;
    let root: string | undefined;
    
    for (const feature of featureParts) {
      if (feature.startsWith("LEM:")) {
        lemma = feature.substring(4);
      } else if (feature.startsWith("ROOT:")) {
        root = feature.substring(5);
      }
    }
    
    // Only process STEM segments (not prefixes/suffixes)
    if (featureParts[0] === "STEM") {
      // #region agent log
      // Clean numeric suffixes from lemma BEFORE Buckwalter conversion
      // The corpus uses numeric suffixes (e.g., "maE2") to distinguish lemma variants
      const cleanedLemma = lemma ? normalizeBuckwalterLemma(lemma, featureParts) : undefined;
      const isEawth = root === 'Ew*';
      if (isEawth) {
        const arabicText = buckwalterToArabic(text);
        const arabicLemma = cleanedLemma ? buckwalterToArabic(cleanedLemma) : undefined;
        fetch('http://127.0.0.1:7928/ingest/072fcd97-088c-4485-ab8e-cc835b14d75c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8997fe'},body:JSON.stringify({sessionId:'8997fe',location:'build-lexical-db.ts:225',message:'H2: Processing عوذ word - before/after Buckwalter conversion',data:{buckwalter_text:text,arabic_text:arabicText,buckwalter_lemma:lemma,buckwalter_cleaned:cleanedLemma,arabic_lemma:arabicLemma,pos:pos,tense:getVerbTense(featureParts),person:getPerson(featureParts)},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      }
      // #endregion
      
      rawWords.push({
        text: buckwalterToArabic(text),
        pos: pos,
        root: root ? buckwalterToArabic(root) : undefined,
        lemma: cleanedLemma ? buckwalterToArabic(cleanedLemma) : undefined,
        buckwalter_root: root,
        buckwalter_lemma: cleanedLemma,
        verb_form: pos.startsWith("V") ? getVerbForm(featureParts) : undefined,
        tense: pos.startsWith("V") ? getVerbTense(featureParts) : undefined,
        person: pos.startsWith("V") ? getPerson(featureParts) : undefined,
        is_passive: featureParts.includes("PASS"),
        features: featureParts,
        translation: "", // Translations not in corpus file
        surah: parseInt(surah),
        ayah: parseInt(ayah),
        position: parseInt(word),
      });
    }
  }
  
  console.log(`  Parsed ${rawWords.length} word segments`);
  return rawWords;
}

async function buildFullDatabase() {
  const corpusFilePath = join(process.cwd(), "public", "data", "quranic-corpus-morphology-0.4.txt");
  
  if (!existsSync(corpusFilePath)) {
    console.error("ERROR: Morphological data file not found!");
    console.error(`Expected location: ${corpusFilePath}`);
    console.error("");
    console.error("Please download the file from:");
    console.error("  https://corpus.quran.com/download");
    console.error("");
    console.error("Then place it in:");
    console.error("  public/data/quranic-corpus-morphology-0.4.txt");
    console.error("");
    process.exit(1);
  }
  
  console.log("Building full lexical database from Quranic Arabic Corpus data...");
  console.log("");
  
  const rawWords = parseCorpusFile(corpusFilePath);
  
  console.log("Grouping and canonicalizing words...");
  
  const groupedByLemma = new Map<string, RawWord[]>();
  rawWords.forEach((word) => {
    const key = createGroupingKey(word);
    if (!groupedByLemma.has(key)) {
      groupedByLemma.set(key, []);
    }
    groupedByLemma.get(key)!.push(word);
  });
  
  console.log(`  Unique lemmas: ${groupedByLemma.size}`);
  
  const entries: LexicalEntry[] = [];
  
  groupedByLemma.forEach((words) => {
    const verb = normalizeVerb(words);
    if (verb) entries.push(verb);
    
    const noun = normalizeNoun(words);
    if (noun) entries.push(noun);
    
    const particle = normalizeParticle(words);
    if (particle) entries.push(particle);
  });
  
  const deduplicated = deduplicateEntries(entries);
  
  console.log(`  Canonical entries: ${deduplicated.length}`);
  console.log("");
  
  // #region agent log
  // Check for problematic characters in canonical forms
  const problematicChars = /[\^\[\]2#:@"!;,\.\-\+%]/;
  const problematicEntries = deduplicated.filter(e => problematicChars.test(e.canonical_form));
  if (problematicEntries.length > 0) {
    logDebug('build-lexical-db.ts:238', 'Found entries with problematic characters', {
      count: problematicEntries.length,
      samples: problematicEntries.slice(0, 5).map(e => ({
        id: e.id,
        canonical_form: e.canonical_form,
        type: e.type,
        lemma: e.lemma
      }))
    }, 'B,C');
    console.log(`  WARNING: Found ${problematicEntries.length} entries with problematic characters`);
  }
  
  // Log unmapped characters summary
  const unmapped = getUnmappedChars();
  if (unmapped.size > 0) {
    logDebug('build-lexical-db.ts:252', 'Unmapped characters summary', {
      count: unmapped.size,
      characters: Array.from(unmapped).map(c => ({char: c, code: c.charCodeAt(0)}))
    }, 'A,D');
    console.log(`  WARNING: Found ${unmapped.size} unmapped Buckwalter characters`);
  }
  // #endregion
  
  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    total_entries: deduplicated.length,
    entries: deduplicated,
  };
}

async function main() {
  try {
    const publicDir = join(process.cwd(), "public");
    const dataDir = join(publicDir, "data");
    
    mkdirSync(dataDir, { recursive: true });
    
    let database;
    
    if (BUILD_FULL_DATABASE) {
      database = await buildFullDatabase();
    } else {
      database = sampleDatabase;
    }
    
    const outputPath = join(dataDir, "lexical-db.json");
    writeFileSync(outputPath, JSON.stringify(database, null, 2));
    
    console.log("✓ Lexical database created successfully!");
    console.log(`  Location: ${outputPath}`);
    console.log(`  Entries: ${database.total_entries}`);
    
    if (!BUILD_FULL_DATABASE) {
      console.log("");
      console.log("The sample database contains a few example words for testing.");
      console.log("To build the complete database with all Quran words:");
      console.log("  Run: npx tsx scripts/build-lexical-db.ts --full");
    }
  } catch (error) {
    console.error("Error creating lexical database:", error);
    process.exit(1);
  }
}

main();
