"use client";

import { useState, useEffect, useCallback } from "react";
import type { LexicalEntry, Rating } from "@/lib/types/flashcard";
import { CardType } from "@/lib/types/flashcard";
import { ensureCompleteVerbForms } from "@/lib/corpus/verb-generator";

interface FlashcardReviewProps {
  word: LexicalEntry;
  onReview: (rating: Rating, durationMs: number) => void;
  showRoot?: boolean;
  showExamples?: boolean;
  showHansWehr?: boolean;
}

// Simple module-level cache so we don't re-fetch the same verse across cards
const verseTextCache = new Map<string, string>();

export function FlashcardReview({
  word,
  onReview,
  showRoot = true,
  showExamples = true,
  showHansWehr = false,
}: FlashcardReviewProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAlternateMeanings, setShowAlternateMeanings] = useState(false);
  const [startTime] = useState(Date.now());
  const [hansWehrDef, setHansWehrDef] = useState<string | null>(null);
  const [hansWehrLoading, setHansWehrLoading] = useState(false);
  const [verseTexts, setVerseTexts] = useState<Record<string, string>>({});

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
                          __html: hansWehrDef
                          // already bold: <b>IV</b> → <br><b>IV</b>
                          .replace(
                            /<b>(II|III|IV|VI|VII|VIII|IX|X|V)<\/b>/g,
                            "<br><b>$1</b>"
                          )
                          // plain text: " IV " → <br><b>IV</b>
                          .replace(
                            /(?<![<>/\w])(II|III|IV|VI|VII|VIII|IX|X|V)(?=\s)/g,
                            "<br><b>$1</b>"
                          ),
                      }}
                    />
                  ) : (
                    <div className="text-sm text-gray-600 italic">No entry found</div>
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
                            Surah {ex.surah}:{ex.ayah}
                          </div>
                          {text ? (
                            <div
                              dir="rtl"
                              className="font-amiri text-sm leading-loose text-gray-300"
                            >
                              {text}
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
