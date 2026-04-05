"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function PlayPage() {
  const [roomCode, setRoomCode] = useState("");
  const newRoomCode = useMemo(() => generateRoomCode(), []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <div className="mx-auto max-w-md px-4 py-20">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold">Play</h1>
          <p className="mt-2 text-gray-400">
            Create a room or join a friend&apos;s. Pick your question types inside.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Create */}
          <Link
            href={`/play/${newRoomCode}`}
            className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-5 transition-colors hover:border-emerald-400 hover:bg-emerald-500/15"
          >
            <div>
              <p className="font-semibold text-white">Create Room</p>
              <p className="mt-0.5 text-sm text-gray-400">Start a new game and invite friends</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </Link>

          {/* Join */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 px-6 py-5">
            <p className="mb-3 font-semibold text-white">Join Room</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-center font-mono tracking-widest text-white placeholder-gray-600 outline-none focus:border-emerald-500"
              />
              <Link
                href={roomCode.length === 6 ? `/play/${roomCode}` : "#"}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                  roomCode.length === 6
                    ? "bg-gray-700 text-white hover:bg-gray-600"
                    : "cursor-not-allowed bg-gray-800 text-gray-600"
                }`}
              >
                Join
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
