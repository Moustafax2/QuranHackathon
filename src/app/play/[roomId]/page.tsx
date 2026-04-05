"use client";

import { useState } from "react";
import Link from "next/link";
import { use } from "react";

interface Props {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ mode?: string }>;
}

const mockPlayers = [
  { id: "1", name: "You", score: 0, isHost: true, isYou: true },
  { id: "2", name: "Waiting...", score: 0, isHost: false, isYou: false },
  { id: "3", name: "Waiting...", score: 0, isHost: false, isYou: false },
];

export default function GameRoomPage({ params, searchParams }: Props) {
  const { roomId } = use(params);
  const { mode } = use(searchParams);
  const [started, setStarted] = useState(false);

  if (started) {
    return <GameInProgress roomId={roomId} mode={mode} />;
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
          <p className="mt-3 text-sm text-gray-500">
            Share this code with friends to join
          </p>
        </div>

        {/* Players */}
        <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Players ({mockPlayers.length}/8)
          </h2>
          <div className="space-y-2">
            {mockPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-xl bg-gray-800/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${player.isYou ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-700 text-gray-500"}`}>
                    {player.isYou ? player.name[0] : "?"}
                  </div>
                  <span className={`text-sm font-medium ${player.isYou ? "text-white" : "text-gray-500"}`}>
                    {player.name}
                    {player.isHost && (
                      <span className="ml-2 text-xs text-amber-400">Host</span>
                    )}
                  </span>
                </div>
                {player.isYou && (
                  <div className="flex h-2 w-2 items-center">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setStarted(true)}
            className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
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

function GameInProgress({ roomId, mode }: { roomId: string; mode?: string }) {
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const options = [
    "وَٱلضُّحَىٰ",
    "وَٱلَّيْلِ إِذَا سَجَىٰ",
    "مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ",
    "وَلَلْءَاخِرَةُ خَيْرٌ لَّكَ مِنَ ٱلْأُولَىٰ",
  ];
  const correctIndex = 1;

  function handleSelect(i: number) {
    if (answered) return;
    setSelected(i);
    setAnswered(true);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Score bar */}
        <div className="mb-8 flex items-center justify-between rounded-2xl border border-gray-800 bg-gray-900 px-5 py-3">
          <div className="text-sm">
            <span className="text-gray-500">Room </span>
            <span className="font-mono text-gray-300">{roomId}</span>
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold">
            <span className="text-emerald-400">You: 0</span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">Others: 0</span>
          </div>
        </div>

        {/* Prompt */}
        <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            What comes next?
          </p>
          <p dir="rtl" lang="ar" className="font-amiri text-3xl leading-loose text-white">
            وَٱلضُّحَىٰ
          </p>
          <p className="mt-2 text-sm text-gray-500">Surah Ad-Duha — 93:1</p>
        </div>

        {/* Options */}
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option, i) => {
            let style = "border-gray-800 bg-gray-900 hover:border-gray-600";
            if (answered) {
              if (i === correctIndex) style = "border-emerald-500 bg-emerald-500/10";
              else if (i === selected) style = "border-red-500 bg-red-500/10";
              else style = "border-gray-800 bg-gray-900 opacity-50";
            }
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={answered}
                className={`rounded-xl border p-4 text-right transition-all ${style}`}
              >
                <p dir="rtl" lang="ar" className="font-amiri text-xl leading-loose text-white">
                  {option}
                </p>
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-6 text-center">
            <p className={`text-lg font-semibold ${selected === correctIndex ? "text-emerald-400" : "text-red-400"}`}>
              {selected === correctIndex ? "Correct! +1 point" : "Wrong answer"}
            </p>
            <button
              onClick={() => { setAnswered(false); setSelected(null); }}
              className="mt-4 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Next Ayah
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
