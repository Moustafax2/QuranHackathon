"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const gameModes = [
  {
    id: "buzzer",
    title: "Buzzer — Next Ayah",
    difficulty: "Hard",
    difficultyColor: "text-red-400 bg-red-400/10 border-red-400/20",
    description:
      "An ayah is read aloud. First to buzz in and recite the next one correctly wins the point.",
    players: "2–8 players",
    icon: "⚡",
    available: true,
  },
  {
    id: "multiple-choice",
    title: "Next Ayah — Multiple Choice",
    difficulty: "Easy",
    difficultyColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    description:
      "Given a verse, pick the correct next ayah from four options. Great for beginners.",
    players: "2–8 players",
    icon: "🎯",
    available: true,
  },
  {
    id: "word-meaning",
    title: "Word Meaning Trivia",
    difficulty: "Medium",
    difficultyColor: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    description:
      "A word from the Quran appears — race to select the correct Arabic or English meaning.",
    players: "2–8 players",
    icon: "📖",
    available: false,
  },
  {
    id: "trivia",
    title: "Quran Trivia",
    difficulty: "Medium",
    difficultyColor: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    description:
      "Location questions, revelation facts, and more — scholar-reviewed questions.",
    players: "2–8 players",
    icon: "🏛️",
    available: false,
  },
];

export default function PlayPage() {
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const newRoomCode = useMemo(() => generateRoomCode(), []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold">Choose a Game Mode</h1>
          <p className="mt-2 text-gray-400">
            Select a mode, create a room, and share the code with friends.
          </p>
        </div>

        {/* Mode grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {gameModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => mode.available && setSelectedMode(mode.id)}
              disabled={!mode.available}
              className={`relative flex flex-col gap-3 rounded-2xl border p-5 text-left transition-all ${
                !mode.available
                  ? "cursor-not-allowed border-gray-800 opacity-50"
                  : selectedMode === mode.id
                  ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500"
                  : "border-gray-800 bg-gray-900 hover:border-gray-600"
              }`}
            >
              {!mode.available && (
                <span className="absolute right-4 top-4 rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-500">
                  Coming soon
                </span>
              )}
              <div className="flex items-center gap-3">
                <span className="text-2xl">{mode.icon}</span>
                <div>
                  <h3 className="font-semibold text-white">{mode.title}</h3>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${mode.difficultyColor}`}>
                      {mode.difficulty}
                    </span>
                    <span className="text-xs text-gray-500">{mode.players}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-400">{mode.description}</p>
            </button>
          ))}
        </div>

        {/* Room actions */}
        {selectedMode && (
          <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 font-semibold text-white">
              {gameModes.find((m) => m.id === selectedMode)?.title}
            </h2>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href={`/play/${newRoomCode}?mode=${selectedMode}`}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                Create Room
              </Link>
              <div className="flex flex-1 gap-2">
                <input
                  type="text"
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-center text-sm font-mono tracking-widest text-white placeholder-gray-600 outline-none focus:border-emerald-500"
                />
                <Link
                  href={roomCode.length === 6 ? `/play/${roomCode}` : "#"}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    roomCode.length === 6
                      ? "border-gray-600 bg-gray-800 text-white hover:border-gray-400"
                      : "cursor-not-allowed border-gray-800 text-gray-600"
                  }`}
                >
                  Join
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
