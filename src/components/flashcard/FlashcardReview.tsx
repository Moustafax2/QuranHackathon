"use client";

import { useState, useEffect, useCallback } from "react";
import type { LexicalEntry, Rating } from "@/lib/types/flashcard";
import { CardType } from "@/lib/types/flashcard";

interface FlashcardReviewProps {
  word: LexicalEntry;
  onReview: (rating: Rating, durationMs: number) => void;
  showRoot?: boolean;
  showExamples?: boolean;
}

export function FlashcardReview({
  word,
  onReview,
  showRoot = true,
  showExamples = true,
}: FlashcardReviewProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [startTime] = useState(Date.now());

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
    if (word.type !== CardType.VERB || !word.forms || !("past" in word.forms)) return null;
    const forms = word.forms;

    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="mb-2 text-xs font-medium text-gray-500">Past / ماضي</div>
          <div className="font-amiri text-2xl text-white">{forms.past}</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="mb-2 text-xs font-medium text-gray-500">Present / مضارع</div>
          <div className="font-amiri text-2xl text-white">{forms.present}</div>
        </div>
        {forms.imperative && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <div className="mb-2 text-xs font-medium text-gray-500">Imperative / أمر</div>
            <div className="font-amiri text-2xl text-white">{forms.imperative}</div>
          </div>
        )}
        {forms.verbal_noun && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <div className="mb-2 text-xs font-medium text-gray-500">Verbal Noun / مصدر</div>
            <div className="font-amiri text-2xl text-white">{forms.verbal_noun}</div>
          </div>
        )}
      </div>
    );
  };

  const renderNounForms = () => {
    if (word.type !== CardType.NOUN || !word.forms || !("singular" in word.forms)) return null;
    const forms = word.forms;

    return (
      <div className="space-y-2 text-center">
        <div className="font-amiri text-4xl text-white">{forms.singular}</div>
        {forms.plural && (
          <div className="font-amiri text-2xl text-gray-400">({forms.plural})</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-[500px] w-full max-w-2xl flex-col">
      <div
        className="perspective-1000 relative flex-1 cursor-pointer"
        onClick={handleFlip}
      >
        <div
          className={`preserve-3d relative h-full w-full transition-transform duration-600 ${
            isFlipped ? "rotate-y-180" : ""
          }`}
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div
            className="backface-hidden absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-12 shadow-2xl"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="mb-6">{getCardTypeBadge()}</div>
            <div className="mb-8 font-amiri text-6xl font-bold text-white">
              {word.canonical_form}
            </div>
            <div className="text-sm text-gray-500">
              Click or press Space to reveal
            </div>
          </div>

          <div
            className="backface-hidden absolute inset-0 flex flex-col rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-gray-900 to-gray-950 p-8 shadow-2xl shadow-emerald-500/10"
            style={{
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

            <div className="mb-6 flex-1 space-y-6">
              {word.type === CardType.VERB && renderVerbForms()}
              {word.type === CardType.NOUN && renderNounForms()}
              {word.type === CardType.PARTICLE && (
                <div className="text-center font-amiri text-5xl text-white">
                  {word.canonical_form}
                </div>
              )}

              <div className="text-center text-xl font-medium text-emerald-400">
                {word.translation}
              </div>

              {showExamples && word.examples.length > 0 && (
                <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                  <div className="mb-2 text-xs font-medium text-gray-500">Examples</div>
                  <div className="space-y-1">
                    {word.examples.slice(0, 3).map((ex, idx) => (
                      <div key={idx} className="text-sm text-gray-400">
                        Surah {ex.surah}:{ex.ayah}
                      </div>
                    ))}
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

      <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .duration-600 {
          transition-duration: 600ms;
        }
      `}</style>
    </div>
  );
}
