"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { use } from "react";
import type { GameSettings, GameQuestion, QuestionType } from "@/lib/types/game";

interface Props {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ mode?: string }>;
}

const mockPlayers = [
  { id: "1", name: "You", score: 0, isHost: true, isYou: true },
  { id: "2", name: "Waiting...", score: 0, isHost: false, isYou: false },
  { id: "3", name: "Waiting...", score: 0, isHost: false, isYou: false },
];

const ALL_JUZES = Array.from({ length: 30 }, (_, i) => i + 1);

const QUESTION_TYPE_META: {
  id: QuestionType;
  label: string;
  available: boolean;
}[] = [
  { id: "next-ayah-mc", label: "Next Ayah — Multiple Choice", available: true },
  { id: "word-meaning-mc", label: "Word Meaning Trivia", available: true },
  { id: "blank-word-mc", label: "Fill in the Blank", available: true },
];

const DISABLED_TYPES = [
  { label: "Buzzer — Next Ayah", available: false },
  { label: "Quran Trivia", available: false },
];

export default function GameRoomPage({ params, searchParams }: Props) {
  const { roomId } = use(params);
  use(searchParams); // mode available if needed later

  const [gameSettings, setGameSettings] = useState<GameSettings>({
    questionTypes: ["next-ayah-mc"],
    numQuestions: 10,
    juzes: ALL_JUZES,
  });
  const [started, setStarted] = useState(false);

  if (started) {
    return <GameInProgress roomId={roomId} settings={gameSettings} />;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Room header */}
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm text-gray-500">Room Code</p>
          <div className="inline-flex items-center gap-3 rounded-2xl border border-gray-700 bg-gray-900 px-6 py-3">
            <span className="font-mono text-3xl font-bold tracking-widest text-emerald-400">
              {roomId}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(roomId)}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
              title="Copy code"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
              </svg>
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-500">Share this code with friends to join</p>
        </div>

        {/* Players */}
        <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Players ({mockPlayers.length}/8)
          </h2>
          <div className="space-y-2">
            {mockPlayers.map((player) => (
              <div key={player.id} className="flex items-center justify-between rounded-xl bg-gray-800/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${player.isYou ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-700 text-gray-500"}`}>
                    {player.isYou ? player.name[0] : "?"}
                  </div>
                  <span className={`text-sm font-medium ${player.isYou ? "text-white" : "text-gray-500"}`}>
                    {player.name}
                    {player.isHost && <span className="ml-2 text-xs text-amber-400">Host</span>}
                  </span>
                </div>
                {player.isYou && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Game Settings */}
        <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-5">
          <h2 className="font-semibold text-white">Game Settings</h2>

          {/* Question Types */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-400">Question Types</p>
            <div className="space-y-2">
              {QUESTION_TYPE_META.map((qt) => (
                <label key={qt.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={gameSettings.questionTypes.includes(qt.id)}
                    onChange={(e) => {
                      setGameSettings((s) => ({
                        ...s,
                        questionTypes: e.target.checked
                          ? [...s.questionTypes, qt.id]
                          : s.questionTypes.filter((t) => t !== qt.id),
                      }));
                    }}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span className="text-sm text-white">{qt.label}</span>
                </label>
              ))}
              {DISABLED_TYPES.map((qt) => (
                <div key={qt.label} className="flex items-center gap-3 rounded-xl border border-gray-800 px-4 py-3 opacity-40">
                  <input type="checkbox" disabled className="h-4 w-4" />
                  <span className="text-sm text-gray-500">{qt.label}</span>
                  <span className="ml-auto rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-600">Soon</span>
                </div>
              ))}
            </div>
          </div>

          {/* Number of Questions */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-400">Number of Questions</p>
            <div className="flex items-center gap-3">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setGameSettings((s) => ({ ...s, numQuestions: n }))}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                    gameSettings.numQuestions === n
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Juz Selector */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-400">
                Juzes ({gameSettings.juzes.length}/30)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setGameSettings((s) => ({ ...s, juzes: ALL_JUZES }))}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  All
                </button>
                <span className="text-gray-700">·</span>
                <button
                  onClick={() => setGameSettings((s) => ({ ...s, juzes: [] }))}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-10 gap-1.5">
              {ALL_JUZES.map((juz) => {
                const selected = gameSettings.juzes.includes(juz);
                return (
                  <button
                    key={juz}
                    onClick={() =>
                      setGameSettings((s) => ({
                        ...s,
                        juzes: selected
                          ? s.juzes.filter((j) => j !== juz)
                          : [...s.juzes, juz].sort((a, b) => a - b),
                      }))
                    }
                    className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                      selected
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                        : "bg-gray-800 text-gray-500 hover:bg-gray-700"
                    }`}
                  >
                    {juz}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setStarted(true)}
            disabled={gameSettings.questionTypes.length === 0 || gameSettings.juzes.length === 0}
            className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start Game
          </button>
          <Link
            href="/play"
            className="rounded-xl border border-gray-700 px-4 py-3 text-sm font-semibold text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
          >
            Leave
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GameInProgress
// ---------------------------------------------------------------------------

function GameInProgress({ roomId, settings }: { roomId: string; settings: GameSettings }) {
  const [question, setQuestion] = useState<GameQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [questionNum, setQuestionNum] = useState(1);
  const [finished, setFinished] = useState(false);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    setAnswered(false);

    try {
      const juzesParam = settings.juzes.join(",");
      const type = settings.questionTypes[Math.floor(Math.random() * settings.questionTypes.length)];
      const res = await fetch(`/api/game/question?juzes=${juzesParam}&type=${type}`);
      if (!res.ok) throw new Error("Failed to fetch question");
      const data: GameQuestion = await res.json();
      setQuestion(data);
    } catch {
      setError("Failed to load question. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [settings.juzes, settings.questionTypes]);

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  function handleSelect(i: number) {
    if (answered || !question) return;
    setSelected(i);
    setAnswered(true);
    if (i === question.correctIndex) {
      setScore((s) => s + 1);
    }
  }

  function handleNext() {
    if (questionNum >= settings.numQuestions) {
      setFinished(true);
      return;
    }
    setQuestionNum((n) => n + 1);
    fetchQuestion();
  }

  // Finished screen
  if (finished) {
    const pct = Math.round((score / settings.numQuestions) * 100);
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-950 text-white">
        <div className="mx-auto max-w-md px-4 text-center">
          <div className="mb-6 text-6xl">{pct >= 70 ? "🎉" : pct >= 40 ? "📖" : "💪"}</div>
          <h1 className="mb-2 text-3xl font-bold">
            {score}/{settings.numQuestions}
          </h1>
          <p className="mb-1 text-gray-400">{pct}% correct</p>
          <p className="mb-8 text-sm text-gray-500">Room {roomId}</p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/play/${roomId}`}
              className="rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Play Again
            </Link>
            <Link
              href="/play"
              className="rounded-xl border border-gray-700 py-3 text-sm font-semibold text-gray-400 hover:border-gray-500 hover:text-white"
            >
              Back to Lobby
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Score bar */}
        <div className="mb-8 flex items-center justify-between rounded-2xl border border-gray-800 bg-gray-900 px-5 py-3">
          <div className="text-sm">
            <span className="text-gray-500">Q </span>
            <span className="font-semibold text-gray-300">{questionNum}</span>
            <span className="text-gray-500"> / {settings.numQuestions}</span>
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold">
            <span className="text-emerald-400">Score: {score}</span>
            <span className="text-gray-500">|</span>
            <span className="font-mono text-gray-500">{roomId}</span>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={fetchQuestion}
              className="mt-3 rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-400 hover:bg-red-500/30"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <>
            <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
              <div className="mx-auto mb-3 h-3 w-24 animate-pulse rounded-full bg-gray-800" />
              <div className="mx-auto h-10 w-3/4 animate-pulse rounded-xl bg-gray-800" />
              <div className="mx-auto mt-3 h-3 w-32 animate-pulse rounded-full bg-gray-800" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl border border-gray-800 bg-gray-900" />
              ))}
            </div>
          </>
        )}

        {/* Question */}
        {!loading && !error && question && (
          <>
            {/* Prompt card */}
            <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
              {question.type === "next-ayah-mc" && (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    What comes next?
                  </p>
                  <p
                    dir="rtl"
                    lang="ar"
                    translate="no"
                    className="font-amiri text-3xl leading-loose text-white"
                  >
                    {question.promptVerse.text_uthmani}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    {question.promptVerse.surah_name} · {question.promptVerse.verse_key}
                  </p>
                </>
              )}
              {question.type === "word-meaning-mc" && (
                <>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    What does this word mean?
                  </p>
                  <p
                    dir="rtl"
                    lang="ar"
                    translate="no"
                    className="font-amiri text-5xl leading-loose text-white"
                  >
                    {question.promptWord}
                  </p>
                  <p className="mt-3 text-sm text-gray-500">
                    {question.promptVerse.surah_name} · {question.promptVerse.verse_key}
                  </p>
                </>
              )}
              {question.type === "blank-word-mc" && (() => {
                const blankWord = question.options[question.correctIndex].text_uthmani;
                const fullText = question.promptVerse.text_uthmani;
                // Replace the blank word in the full ayah text with a placeholder token
                const PLACEHOLDER = "█████";
                const withBlank = answered ? fullText : fullText.replace(blankWord, PLACEHOLDER);
                const parts = withBlank.split(PLACEHOLDER);

                return (
                  <>
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Fill in the blank
                    </p>
                    <p
                      dir="rtl"
                      lang="ar"
                      translate="no"
                      className="font-amiri text-2xl leading-loose text-white"
                    >
                      {parts.length === 2 ? (
                        <>
                          {parts[0]}
                          <span className={`mx-1 inline-block rounded-lg px-2 font-bold ${
                            answered ? "bg-emerald-500/20 text-emerald-300" : "bg-gray-700 text-gray-600"
                          }`}>
                            {answered ? blankWord : "　　　"}
                          </span>
                          {parts[1]}
                        </>
                      ) : (
                        // Fallback if replace didn't find the word — show full text
                        fullText
                      )}
                    </p>
                    <p className="mt-3 text-sm text-gray-500">
                      {question.promptVerse.surah_name} · {question.promptVerse.verse_key}
                    </p>
                  </>
                );
              })()}
            </div>

            {/* Options */}
            <div className="grid gap-3 sm:grid-cols-2">
              {question.options.map((option, i) => {
                let style = "border-gray-800 bg-gray-900 hover:border-gray-600 cursor-pointer";
                if (answered) {
                  if (i === question.correctIndex) style = "border-emerald-500 bg-emerald-500/10 cursor-default";
                  else if (i === selected) style = "border-red-500 bg-red-500/10 cursor-default";
                  else style = "border-gray-800 bg-gray-900 opacity-40 cursor-default";
                }

                return (
                  <button
                    key={`${option.verse_key}-${i}`}
                    onClick={() => handleSelect(i)}
                    disabled={answered}
                    className={`rounded-xl border p-4 transition-all ${style} ${
                      question.type === "word-meaning-mc" ? "text-left" : "text-right"
                    }`}
                  >
                    {question.type === "next-ayah-mc" && (
                      <>
                        <p
                          dir="rtl"
                          lang="ar"
                          translate="no"
                          className="font-amiri text-xl leading-loose text-white"
                        >
                          {option.text_uthmani}
                        </p>
                        {answered && (
                          <p className="mt-1 text-left text-xs text-gray-500">{option.verse_key}</p>
                        )}
                      </>
                    )}
                    {question.type === "word-meaning-mc" && (
                      <p className="text-sm font-medium text-white">{option.meaning}</p>
                    )}
                    {question.type === "blank-word-mc" && (
                      <p
                        dir="rtl"
                        lang="ar"
                        translate="no"
                        className="font-amiri text-xl leading-loose text-white"
                      >
                        {option.text_uthmani}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className="mt-6 text-center">
                <p className={`text-lg font-semibold ${selected === question.correctIndex ? "text-emerald-400" : "text-red-400"}`}>
                  {selected === question.correctIndex ? "Correct! +1" : "Wrong"}
                </p>
                {selected !== question.correctIndex && (
                  <p className="mt-1 text-sm text-gray-500">
                    Correct answer:{" "}
                    <span
                      dir={question.type === "word-meaning-mc" ? "ltr" : "rtl"}
                      lang={question.type === "word-meaning-mc" ? undefined : "ar"}
                      translate={question.type === "word-meaning-mc" ? undefined : "no"}
                      className="font-amiri text-gray-300"
                    >
                      {question.type === "word-meaning-mc"
                        ? question.options[question.correctIndex].meaning
                        : question.options[question.correctIndex].text_uthmani}
                    </span>
                  </p>
                )}
                <button
                  onClick={handleNext}
                  className="mt-4 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  {questionNum >= settings.numQuestions ? "See Results" : "Next Question"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
