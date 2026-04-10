"use client";

import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import type { LexicalEntry, Rating } from "@/lib/types/flashcard";
import { CardType } from "@/lib/types/flashcard";
import { ensureCompleteVerbForms } from "@/lib/corpus/verb-generator";
import type { MuyassarParsedEntry } from "@/app/api/muyassar/route";

interface MuyassarMatch extends MuyassarParsedEntry {
  surah: number;
  ayah: number;
}

interface FlashcardReviewProps {
  word: LexicalEntry;
  onReview: (rating: Rating, durationMs: number) => void;
  showRoot?: boolean;
  showExamples?: boolean;
  showHansWehr?: boolean;
  showMuyassar?: boolean;
  onMuyassarAvailable?: (available: boolean) => void;
}

// ── Arabic normalization helpers ──────────────────────────────────────────────

function stripDiacritics(s: string): string {
  return s
    .replace(/\u0670/g, "\u0627") // superscript alef → regular alef
    .replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u08D3-\u08FF]/g, "")
    .replace(/\u0640/g, ""); // tatweel
}

function normalizeArabic(s: string): string {
  return s
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627") // أ إ آ ٱ → ا
    .replace(/\u0649/g, "\u064A") // ى → ي
    .replace(/\u0629/g, "\u0647"); // ة → ه
}

function normalizeWord(s: string): string {
  return normalizeArabic(stripDiacritics(s.trim()))
    .replace(/^ال/, ""); // strip definite article
}

function highlightWordInVerse(verseText: string, canonicalForm: string): React.ReactNode {
  const words = verseText.split(" ");
  const nodes: React.ReactNode[] = [];
  words.forEach((word, i) => {
    if (wordMatchesCanonical(word, canonicalForm)) {
      nodes.push(<strong key={i} className="text-white font-bold">{word}</strong>);
    } else {
      nodes.push(word);
    }
    if (i < words.length - 1) nodes.push(" ");
  });
  return <>{nodes}</>;
}

function wordMatchesCanonical(quranicWord: string, canonicalForm: string): boolean {
  const q = normalizeWord(quranicWord);
  const c = normalizeWord(canonicalForm);
  if (!q || !c || c.length < 2) return false;
  if (q === c) return true;
  // Substring match: canonical contained in quranic (handles case/number inflections)
  if (c.length >= 3 && q.includes(c)) return true;
  if (q.length >= 3 && c.includes(q)) return true;
  return false;
}

// Surah names (1-indexed)
const SURAH_NAMES: Record<number, string> = {
  1:"Al-Fatihah",2:"Al-Baqarah",3:"Ali 'Imran",4:"An-Nisa",5:"Al-Ma'idah",
  6:"Al-An'am",7:"Al-A'raf",8:"Al-Anfal",9:"At-Tawbah",10:"Yunus",
  11:"Hud",12:"Yusuf",13:"Ar-Ra'd",14:"Ibrahim",15:"Al-Hijr",
  16:"An-Nahl",17:"Al-Isra",18:"Al-Kahf",19:"Maryam",20:"Ta-Ha",
  21:"Al-Anbiya",22:"Al-Hajj",23:"Al-Mu'minun",24:"An-Nur",25:"Al-Furqan",
  26:"Ash-Shu'ara",27:"An-Naml",28:"Al-Qasas",29:"Al-'Ankabut",30:"Ar-Rum",
  31:"Luqman",32:"As-Sajdah",33:"Al-Ahzab",34:"Saba",35:"Fatir",
  36:"Ya-Sin",37:"As-Saffat",38:"Sad",39:"Az-Zumar",40:"Ghafir",
  41:"Fussilat",42:"Ash-Shura",43:"Az-Zukhruf",44:"Ad-Dukhan",45:"Al-Jathiyah",
  46:"Al-Ahqaf",47:"Muhammad",48:"Al-Fath",49:"Al-Hujurat",50:"Qaf",
  51:"Adh-Dhariyat",52:"At-Tur",53:"An-Najm",54:"Al-Qamar",55:"Ar-Rahman",
  56:"Al-Waqi'ah",57:"Al-Hadid",58:"Al-Mujadila",59:"Al-Hashr",60:"Al-Mumtahanah",
  61:"As-Saf",62:"Al-Jumu'ah",63:"Al-Munafiqun",64:"At-Taghabun",65:"At-Talaq",
  66:"At-Tahrim",67:"Al-Mulk",68:"Al-Qalam",69:"Al-Haqqah",70:"Al-Ma'arij",
  71:"Nuh",72:"Al-Jinn",73:"Al-Muzzammil",74:"Al-Muddaththir",75:"Al-Qiyamah",
  76:"Al-Insan",77:"Al-Mursalat",78:"An-Naba",79:"An-Nazi'at",80:"'Abasa",
  81:"At-Takwir",82:"Al-Infitar",83:"Al-Mutaffifin",84:"Al-Inshiqaq",85:"Al-Buruj",
  86:"At-Tariq",87:"Al-A'la",88:"Al-Ghashiyah",89:"Al-Fajr",90:"Al-Balad",
  91:"Ash-Shams",92:"Al-Layl",93:"Ad-Duhah",94:"Ash-Sharh",95:"At-Tin",
  96:"Al-'Alaq",97:"Al-Qadr",98:"Al-Bayyinah",99:"Az-Zalzalah",100:"Al-'Adiyat",
  101:"Al-Qari'ah",102:"At-Takathur",103:"Al-'Asr",104:"Al-Humazah",105:"Al-Fil",
  106:"Quraysh",107:"Al-Ma'un",108:"Al-Kawthar",109:"Al-Kafirun",110:"An-Nasr",
  111:"Al-Masad",112:"Al-Ikhlas",113:"Al-Falaq",114:"An-Nas",
};

function surahRef(surah: number, ayah: number): string {
  const name = SURAH_NAMES[surah] ?? `Surah ${surah}`;
  return `Surah ${name} ${ayah}`;
}

// Simple module-level cache so we don't re-fetch the same verse across cards
const verseTextCache = new Map<string, string>();

export function FlashcardReview({
  word,
  onReview,
  showRoot = true,
  showExamples = true,
  showHansWehr = false,
  showMuyassar = false,
  onMuyassarAvailable,
}: FlashcardReviewProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAlternateMeanings, setShowAlternateMeanings] = useState(false);
  const [startTime] = useState(Date.now());
  const [hansWehrDef, setHansWehrDef] = useState<string | null>(null);
  const [hansWehrLoading, setHansWehrLoading] = useState(false);
  const [verseTexts, setVerseTexts] = useState<Record<string, string>>({});
  const [muyassarMatch, setMuyassarMatch] = useState<MuyassarMatch | null>(null);
  const [muyassarVerseText, setMuyassarVerseText] = useState<string | null>(null);

  useEffect(() => {
    if (!showHansWehr || !word.root) {
      setHansWehrDef(null);
      return;
    }
    setHansWehrLoading(true);
    fetch(`/api/hanswehr?root=${encodeURIComponent(word.root)}`)
      .then((r) => r.json())
      .then((data) => setHansWehrDef(data.definition ?? null))
      .catch(() => setHansWehrDef(null))
      .finally(() => setHansWehrLoading(false));
  }, [showHansWehr, word.root]);

  // Fetch muyassar match whenever the word changes
  useEffect(() => {
    setMuyassarMatch(null);
    setMuyassarVerseText(null);
    if (!word.examples || word.examples.length === 0) return;

    let cancelled = false;

    async function findMatch() {
      for (const ex of word.examples.slice(0, 8)) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/muyassar?surah=${ex.surah}&ayah=${ex.ayah}`);
          const data = await res.json();
          const entries: MuyassarParsedEntry[] = data.entries ?? [];
          for (const entry of entries) {
            if (!entry.isSingleWord) continue;
            if (wordMatchesCanonical(entry.quranicWord, word.canonical_form)) {
              if (!cancelled) {
                setMuyassarMatch({ ...entry, surah: ex.surah, ayah: ex.ayah });
                onMuyassarAvailable?.(true);
              }
              return;
            }
          }
        } catch {
          // ignore
        }
      }
      if (!cancelled) onMuyassarAvailable?.(false);
    }

    findMatch();
    return () => { cancelled = true; };
  }, [word]);

  // Fetch the verse text for the muyassar match
  useEffect(() => {
    if (!muyassarMatch) return;
    const key = `${muyassarMatch.surah}:${muyassarMatch.ayah}`;
    if (verseTextCache.has(key)) {
      setMuyassarVerseText(verseTextCache.get(key)!);
      return;
    }
    fetch(`https://api.quran.com/api/v4/verses/by_key/${key}?fields=text_uthmani`)
      .then((r) => r.json())
      .then((data) => {
        const text: string = data?.verse?.text_uthmani ?? "";
        verseTextCache.set(key, text);
        setMuyassarVerseText(text);
      })
      .catch(() => {});
  }, [muyassarMatch]);

  // Fetch verse texts for examples when card is flipped
  useEffect(() => {
    if (!isFlipped || !showExamples || word.examples.length === 0) return;

    const toFetch = word.examples.slice(0, 3).filter((ex) => {
      const key = `${ex.surah}:${ex.ayah}`;
      return !verseTextCache.has(key);
    });

    if (toFetch.length === 0) {
      // All already cached, populate local state
      const texts: Record<string, string> = {};
      word.examples.slice(0, 3).forEach((ex) => {
        const key = `${ex.surah}:${ex.ayah}`;
        if (verseTextCache.has(key)) texts[key] = verseTextCache.get(key)!;
      });
      setVerseTexts(texts);
      return;
    }

    Promise.all(
      toFetch.map((ex) =>
        fetch(
          `https://api.quran.com/api/v4/verses/by_key/${ex.surah}:${ex.ayah}?fields=text_uthmani`
        )
          .then((r) => r.json())
          .then((data) => {
            const text: string = data?.verse?.text_uthmani ?? "";
            const key = `${ex.surah}:${ex.ayah}`;
            verseTextCache.set(key, text);
            return { key, text };
          })
          .catch(() => null)
      )
    ).then((results) => {
      const texts: Record<string, string> = {};
      word.examples.slice(0, 3).forEach((ex) => {
        const key = `${ex.surah}:${ex.ayah}`;
        if (verseTextCache.has(key)) texts[key] = verseTextCache.get(key)!;
      });
      results.forEach((r) => {
        if (r) texts[r.key] = r.text;
      });
      setVerseTexts(texts);
    });
  }, [isFlipped, showExamples, word.examples]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleReview = useCallback(
    (rating: Rating) => {
      const duration = Date.now() - startTime;
      onReview(rating, duration);
      setIsFlipped(false);
    },
    [onReview, startTime]
  );

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        handleFlip();
      } else if (isFlipped) {
        if (e.key === "1") handleReview(1);
        else if (e.key === "2") handleReview(2);
        else if (e.key === "3") handleReview(3);
        else if (e.key === "4") handleReview(4);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isFlipped, handleFlip, handleReview]);

  const getCardTypeBadge = () => {
    const colors = {
      [CardType.VERB]: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      [CardType.NOUN]: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      [CardType.PARTICLE]: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    };

    return (
      <span
        className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${
          colors[word.type]
        }`}
      >
        {word.type}
      </span>
    );
  };

  const renderVerbForms = () => {
    if (word.type !== CardType.VERB) return null;

    const forms = ensureCompleteVerbForms(
      word.root,
      word.forms && "past" in word.forms ? word.forms : undefined
    );

    const val = (v: string) => (!v || v === "-" ? "—" : v);

    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <div className="mb-3 text-xs font-medium text-gray-500 text-center">
          ماضي / مضارع / أمر — مصدر
        </div>
        <div dir="rtl" className="font-amiri text-2xl text-white text-center whitespace-nowrap">
          {val(forms.past)} / {val(forms.present)} / {val(forms.imperative)}{forms.verbal_noun && forms.verbal_noun !== "-" ? ` — ${forms.verbal_noun}` : ""}
        </div>
      </div>
    );
  };

  const renderNounForms = () => {
    if (word.type !== CardType.NOUN || !word.forms || !("singular" in word.forms)) return null;
    const forms = word.forms;
    const hasPlural = forms.plural && forms.plural !== "-";

    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
        <div dir="rtl" className="font-amiri text-2xl text-white text-center whitespace-nowrap">
          {forms.singular}
          {hasPlural ? ` (${forms.plural})` : " (n/a)"}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl">
      {/* Card flip wrapper — uses CSS grid so both faces share the same cell
          and the container naturally sizes to content height */}
      <div
        className="cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={handleFlip}
      >
        <div
          style={{
            display: "grid",
            transformStyle: "preserve-3d",
            transition: "transform 600ms",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front face */}
          <div
            className="flex flex-col items-center justify-center rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-12 shadow-2xl"
            style={{ gridArea: "1/1", backfaceVisibility: "hidden", minHeight: "260px" }}
          >
            <div className="mb-6">{getCardTypeBadge()}</div>
            <div className="mb-8 font-amiri text-6xl font-bold text-white">
              {word.canonical_form}
            </div>
            <div className="text-sm text-gray-500">
              Click or press Space to reveal
            </div>
          </div>

          {/* Back face */}
          <div
            className="flex flex-col rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-gray-900 to-gray-950 p-8 shadow-2xl shadow-emerald-500/10"
            style={{
              gridArea: "1/1",
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="mb-6 flex items-center justify-between">
              {getCardTypeBadge()}
              {showRoot && word.root && (
                <div className="text-sm text-gray-500">
                  Root: <span className="font-amiri text-emerald-400">{word.root}</span>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {word.type === CardType.VERB && renderVerbForms()}
              {word.type === CardType.NOUN && renderNounForms()}
              {word.type === CardType.PARTICLE && (
                <div className="text-center font-amiri text-5xl text-white">
                  {word.canonical_form}
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <div className="text-center text-xl font-medium text-emerald-400">
                  {word.translation}
                </div>
                {word.alternate_meanings && word.alternate_meanings.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAlternateMeanings(v => !v); }}
                    className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                      showAlternateMeanings
                        ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    alt
                  </button>
                )}
              </div>

              {showAlternateMeanings && word.alternate_meanings && word.alternate_meanings.length > 0 && (
                <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                  <div className="mb-2 text-xs font-medium text-gray-500">Alternate meanings</div>
                  <ul className="space-y-1">
                    {word.alternate_meanings.map((m, i) => (
                      <li key={i} className="text-sm text-gray-300">{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {showHansWehr && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="mb-2 text-xs font-medium text-amber-500/70">Hans Wehr</div>
                  {hansWehrLoading ? (
                    <div className="text-sm text-gray-500">Loading...</div>
                  ) : hansWehrDef ? (
                    <div
                      className="max-h-32 overflow-y-auto text-sm leading-relaxed text-gray-300"
                      dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(
                            hansWehrDef
                            // already bold: <b>IV</b> → <br><b>IV</b>
                            .replace(
                              /<b>(II|III|IV|VI|VII|VIII|IX|X|V)<\/b>/g,
                              "<br><b>$1</b>"
                            )
                            // plain text: " IV " → <br><b>IV</b>
                            .replace(
                              /(?<![<>/\w])(II|III|IV|VI|VII|VIII|IX|X|V)(?=\s)/g,
                              "<br><b>$1</b>"
                            )
                          ),
                      }}
                    />
                  ) : (
                    <div className="text-sm text-gray-600 italic">No entry found</div>
                  )}
                </div>
              )}

              {showMuyassar && muyassarMatch && (
                <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-medium text-teal-400/80">Muyassar Gharib</div>
                    <div className="text-xs text-gray-500">
                      {surahRef(muyassarMatch.surah, muyassarMatch.ayah)}
                    </div>
                  </div>
                  <div dir="rtl" className="mb-2 font-amiri text-teal-300" style={{ fontSize: "1.2em" }}>
                    ﴿{muyassarMatch.quranicWord}﴾
                  </div>
                  <div className="mb-2 text-xs text-gray-500 italic">
                    Explanation of the word ﴾{muyassarMatch.quranicWord}﴿ in this specific context
                  </div>
                  <div dir="rtl" className="mb-3 leading-relaxed text-gray-300 font-amiri" style={{ fontSize: "1.2em" }}>
                    {muyassarMatch.explanation}
                  </div>
                  {muyassarVerseText && (
                    <div className="rounded-lg border border-teal-500/10 bg-teal-950/30 p-3">
                      <div className="mb-1 text-xs text-gray-500">{surahRef(muyassarMatch.surah, muyassarMatch.ayah)}</div>
                      <div dir="rtl" className="font-amiri leading-loose text-gray-300" style={{ fontSize: "1.2em" }}>
                        {highlightWordInVerse(muyassarVerseText, word.canonical_form)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {showExamples && word.examples.length > 0 && (
                <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                  <div className="mb-2 text-xs font-medium text-gray-500">Examples</div>
                  <div className="space-y-3">
                    {word.examples.slice(0, 3).map((ex, idx) => {
                      const key = `${ex.surah}:${ex.ayah}`;
                      const text = verseTexts[key];
                      return (
                        <div key={idx}>
                          <div className="text-xs text-gray-500 mb-1">
                            {surahRef(ex.surah, ex.ayah)}
                          </div>
                          {text ? (
                            <div
                              dir="rtl"
                              className="font-amiri leading-loose text-gray-300"
                              style={{ fontSize: "1.2em" }}
                            >
                              {highlightWordInVerse(text, word.canonical_form)}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-600 italic">Loading...</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isFlipped && (
        <div className="mt-6 grid grid-cols-4 gap-3">
          <button
            onClick={() => handleReview(1)}
            className="group flex flex-col items-center gap-2 rounded-xl bg-gradient-to-br from-red-600 to-red-700 px-4 py-4 font-medium text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
          >
            <span>Again</span>
            <span className="rounded bg-red-800/50 px-2 py-0.5 text-xs">1</span>
          </button>
          <button
            onClick={() => handleReview(2)}
            className="group flex flex-col items-center gap-2 rounded-xl bg-gradient-to-br from-orange-600 to-orange-700 px-4 py-4 font-medium text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
          >
            <span>Hard</span>
            <span className="rounded bg-orange-800/50 px-2 py-0.5 text-xs">2</span>
          </button>
          <button
            onClick={() => handleReview(3)}
            className="group flex flex-col items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 px-4 py-4 font-medium text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
          >
            <span>Good</span>
            <span className="rounded bg-emerald-800/50 px-2 py-0.5 text-xs">3</span>
          </button>
          <button
            onClick={() => handleReview(4)}
            className="group flex flex-col items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-4 font-medium text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
          >
            <span>Easy</span>
            <span className="rounded bg-blue-800/50 px-2 py-0.5 text-xs">4</span>
          </button>
        </div>
      )}
    </div>
  );
}
